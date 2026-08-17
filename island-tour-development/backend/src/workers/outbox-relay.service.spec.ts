import { OutboxRelayService } from './outbox-relay.service';
import {
  ADS_ADJUSTMENT_DELAY_MS,
  PLATFORM_JOBS,
  REMINDER_LEAD_MS,
} from './platform-queue';

/**
 * Unit tests for the transactional-outbox relay (B6). Prisma + queue mocked;
 * the contract under test: undispatched rows fan out to the right named jobs
 * with DETERMINISTIC jobIds, rows are stamped only after a clean enqueue, and
 * a Redis failure leaves the row undispatched for the next tick.
 */
describe('OutboxRelayService', () => {
  let prisma: {
    outboxEvent: { findMany: jest.Mock; update: jest.Mock };
  };
  let queue: { add: jest.Mock };
  let svc: OutboxRelayService;

  const row = (over: Record<string, unknown> = {}) => ({
    id: 'evt1',
    aggregate: 'booking',
    aggregateId: 'b1',
    type: 'booking.confirmed',
    payload: { bookingId: 'b1', tourStartDateTime: null },
    dispatchedAt: null,
    createdAt: new Date('2030-06-01T00:00:00Z'),
    ...over,
  });

  beforeEach(() => {
    prisma = {
      outboxEvent: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    queue = { add: jest.fn().mockResolvedValue({}) };
    svc = new OutboxRelayService(prisma as never, queue as unknown as never);
  });

  it('fans booking.confirmed out to email/notice/CAPI with deterministic jobIds and stamps dispatchedAt', async () => {
    prisma.outboxEvent.findMany.mockResolvedValue([row()]);

    await svc.dispatchPending();

    const names = queue.add.mock.calls.map((c) => c[0]);
    expect(names).toEqual([
      PLATFORM_JOBS.CONFIRMATION_EMAIL,
      PLATFORM_JOBS.OPERATOR_NOTICE,
      PLATFORM_JOBS.CAPI_CONVERSION,
    ]);
    // Deterministic jobIds: a crashed tick re-enqueues the SAME ids, which
    // BullMQ absorbs as duplicates instead of double-running the jobs.
    expect(queue.add).toHaveBeenCalledWith(
      PLATFORM_JOBS.CONFIRMATION_EMAIL,
      { bookingId: 'b1' },
      expect.objectContaining({
        // No `:` in the id - BullMQ rejects custom job ids containing it.
        jobId: `b1__${PLATFORM_JOBS.CONFIRMATION_EMAIL}`,
        attempts: 5,
      }),
    );
    expect(prisma.outboxEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'evt1' },
        data: { dispatchedAt: expect.any(Date) },
      }),
    );
  });

  it('adds a DELAYED pre-tour reminder when the start is more than 24h away', async () => {
    const start = new Date(Date.now() + 48 * 3_600_000).toISOString();
    prisma.outboxEvent.findMany.mockResolvedValue([
      row({ payload: { bookingId: 'b1', tourStartDateTime: start } }),
    ]);

    await svc.dispatchPending();

    const reminder = queue.add.mock.calls.find(
      (c) => c[0] === PLATFORM_JOBS.PRE_TOUR_REMINDER,
    );
    expect(reminder).toBeDefined();
    // Fires ~24h before start (= ~24h from now for a 48h-out start).
    expect(reminder![2].delay).toBeGreaterThan(23 * 3_600_000);
    expect(reminder![2].delay).toBeLessThanOrEqual(REMINDER_LEAD_MS);
  });

  it('skips the reminder entirely for a booking made inside the 24h window', async () => {
    const start = new Date(Date.now() + 3 * 3_600_000).toISOString();
    prisma.outboxEvent.findMany.mockResolvedValue([
      row({ payload: { bookingId: 'b1', tourStartDateTime: start } }),
    ]);

    await svc.dispatchPending();

    const names = queue.add.mock.calls.map((c) => c[0]);
    expect(names).not.toContain(PLATFORM_JOBS.PRE_TOUR_REMINDER);
  });

  it('maps booking.refund-owed to the durable refund job', async () => {
    prisma.outboxEvent.findMany.mockResolvedValue([
      row({ type: 'booking.refund-owed', payload: { bookingId: 'b1' } }),
    ]);

    await svc.dispatchPending();

    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith(
      PLATFORM_JOBS.REFUND_EXECUTE,
      { bookingId: 'b1' },
      expect.objectContaining({
        jobId: `b1__${PLATFORM_JOBS.REFUND_EXECUTE}`,
      }),
    );
  });

  it('fans booking.cancelled out to the Meta refund (instant) + delayed Ads retraction (ad-conversion PRD)', async () => {
    prisma.outboxEvent.findMany.mockResolvedValue([
      row({
        type: 'booking.cancelled',
        payload: { bookingId: 'b1', publicRef: 'p1', refund: 'FULL' },
      }),
    ]);

    await svc.dispatchPending();

    expect(queue.add).toHaveBeenCalledTimes(2);
    expect(queue.add).toHaveBeenCalledWith(
      PLATFORM_JOBS.META_REFUND,
      { bookingId: 'b1' },
      expect.objectContaining({
        jobId: `b1__${PLATFORM_JOBS.META_REFUND}`,
      }),
    );
    // The Ads retraction waits out Google's order_id ingest lag (24h).
    expect(queue.add).toHaveBeenCalledWith(
      PLATFORM_JOBS.ADS_ADJUSTMENT,
      { bookingId: 'b1' },
      expect.objectContaining({
        jobId: `b1__${PLATFORM_JOBS.ADS_ADJUSTMENT}`,
        delay: ADS_ADJUSTMENT_DELAY_MS,
      }),
    );
  });

  it('fans operator.first-tour-live out to the OB-5 onboarding email job (D-17)', async () => {
    prisma.outboxEvent.findMany.mockResolvedValue([
      row({
        aggregate: 'operator',
        aggregateId: 'op1',
        type: 'operator.first-tour-live',
        payload: { operatorId: 'op1', tourId: 't1' },
      }),
    ]);

    await svc.dispatchPending();

    expect(queue.add).toHaveBeenCalledTimes(1);
    // The aggregateId is the OPERATOR here - the payload must be the §2.6
    // onboarding shape, never a bookingId.
    expect(queue.add).toHaveBeenCalledWith(
      PLATFORM_JOBS.ONBOARDING_EMAIL,
      { operatorId: 'op1', templateKey: 'OB5_TOUR_LIVE' },
      expect.objectContaining({
        jobId: `op1__${PLATFORM_JOBS.ONBOARDING_EMAIL}`,
      }),
    );
    expect(prisma.outboxEvent.update).toHaveBeenCalledTimes(1);
  });

  it('a failed enqueue leaves the row UNDISPATCHED for the next tick', async () => {
    prisma.outboxEvent.findMany.mockResolvedValue([row()]);
    queue.add.mockRejectedValue(new Error('redis down'));

    await expect(svc.dispatchPending()).rejects.toThrow('redis down');
    expect(prisma.outboxEvent.update).not.toHaveBeenCalled();
  });

  it('stamps unknown event types without enqueuing anything (forward compat)', async () => {
    prisma.outboxEvent.findMany.mockResolvedValue([
      row({ type: 'booking.some-future-event' }),
    ]);

    await svc.dispatchPending();

    expect(queue.add).not.toHaveBeenCalled();
    expect(prisma.outboxEvent.update).toHaveBeenCalledTimes(1);
  });
});
