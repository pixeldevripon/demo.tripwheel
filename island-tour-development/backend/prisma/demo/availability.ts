// DEMO SEED — availability schedules, a few date exceptions, and materialized
// departures (the bookable inventory) for the next 60 days. Bookings claim seats
// against these departures.

import {
  AvailabilityExceptionType,
  AvailabilityScheduleStatus,
  DepartureSource,
  DepartureStatus,
  Prisma,
} from '@prisma/client';
import {
  DEMO_TOUR_REF,
  dayOffset,
  isoWeekday,
  log,
  prisma,
  section,
  timeOf,
  today,
} from './_shared';

const HORIZON_DAYS = 60;
const PAST_DAYS = 45; // also materialize recent past so completed bookings + reviews have real departures

export async function seedAvailability(): Promise<void> {
  section('Availability + departures');

  const tours = await prisma.tour.findMany({
    where: { reference: DEMO_TOUR_REF },
    select: {
      id: true,
      slug: true,
      startTimes: true,
      maxPartySize: true,
      operatorId: true,
    },
  });
  if (tours.length === 0) {
    log('No demo tours found — skipping availability.');
    return;
  }
  // Owner userId per operator: seeded exceptions carry `createdBy` so the
  // audit surfaces ("Closed by Maria · Jul 28, 14:02", the Date Changes
  // register) demo with a real name instead of "By your team".
  const operators = await prisma.operator.findMany({
    where: { id: { in: [...new Set(tours.map((t) => t.operatorId))] } },
    select: { id: true, userId: true },
  });
  const ownerByOperator = new Map(operators.map((o) => [o.id, o.userId]));
  // Per-tour idempotency: seed only tours that have no schedule yet, so demo
  // tours added in a later seed pass (e.g. a hub's tours) still get availability.
  // A global "any exist -> skip all" guard would starve them. `:clean` wipes
  // everything for a full rebuild.
  const seededTourIds = new Set(
    (
      await prisma.availabilitySchedule.findMany({
        where: { tour: { reference: DEMO_TOUR_REF } },
        select: { tourId: true },
        distinct: ['tourId'],
      })
    ).map((s) => s.tourId),
  );
  const pending = tours.filter((t) => !seededTourIds.has(t.id));
  if (pending.length === 0) {
    log('Availability already seeded for all demo tours — skipping.');
    return;
  }

  let schedRows = 0;
  let exceptionRows = 0;
  let departureRows = 0;

  for (const [idx, tour] of pending.entries()) {
    const capacity = tour.maxPartySize ?? 20;
    const startTimes = tour.startTimes.length ? tour.startTimes : ['09:00'];
    const createdBy = ownerByOperator.get(tour.operatorId) ?? null;
    // Most tours run all week; close one weekday on every 3rd tour for variety.
    const closedWeekday = idx % 3 === 0 ? idx % 7 : -1;
    const weekdays = [0, 1, 2, 3, 4, 5, 6].filter((w) => w !== closedWeekday);
    // One "seasonal" tour per seed pass: its weekly schedule starts 45 days
    // out, so the tour is LIVE with an EMPTY 30-day horizon - the F13
    // delisting warning banner and the summary's zero state have a live demo
    // subject. Everything else starts today.
    const seasonal = pending.length > 3 && idx === pending.length - 1;
    const validFrom = seasonal ? dayOffset(45) : today();

    // Schedules: one row per weekday × startTime.
    const scheduleData: Prisma.AvailabilityScheduleCreateManyInput[] = [];
    for (const w of weekdays) {
      for (const st of startTimes) {
        scheduleData.push({
          tourId: tour.id,
          weekday: w,
          startTime: timeOf(st),
          capacityOverride: null,
          validFrom,
          validUntil: null,
          status: AvailabilityScheduleStatus.ACTIVE,
        });
      }
    }
    const sched = await prisma.availabilitySchedule.createMany({
      data: scheduleData,
      skipDuplicates: true,
    });
    schedRows += sched.count;

    // Exceptions: a CLOSE_DATE (maintenance) + a SET_CAPACITY (reduced) on a
    // couple of tours, plus a near-term CLOSE_SLOT so the agenda's "Closed by
    // {owner}, HH:MM · note · [Reopen]" row state has a subject.
    const closeDateOffset = 10 + (idx % 14); // some day inside the horizon
    const capDateOffset = 5 + (idx % 9);
    const closeSlotOffset = 2 + (idx % 4); // near-term: visible on the agenda
    const exceptions: Prisma.AvailabilityExceptionCreateManyInput[] = [];
    if (idx % 4 === 0 && !seasonal) {
      exceptions.push({
        tourId: tour.id,
        date: dayOffset(closeDateOffset),
        startTime: null,
        type: AvailabilityExceptionType.CLOSE_DATE,
        capacity: null,
        note: 'Annual maintenance / crew day off',
        createdBy,
      });
    }
    if (idx % 5 === 0 && !seasonal) {
      exceptions.push({
        tourId: tour.id,
        date: dayOffset(capDateOffset),
        startTime: timeOf(startTimes[0]),
        type: AvailabilityExceptionType.SET_CAPACITY,
        capacity: Math.max(2, Math.floor(capacity / 2)),
        note: 'Reduced capacity (second boat in service)',
        createdBy,
      });
    }
    if (idx % 7 === 1 && !seasonal) {
      exceptions.push({
        tourId: tour.id,
        date: dayOffset(closeSlotOffset),
        startTime: timeOf(startTimes[0]),
        type: AvailabilityExceptionType.CLOSE_SLOT,
        capacity: null,
        note: 'Weather - swell too high',
        createdBy,
      });
    }
    if (exceptions.length) {
      const ex = await prisma.availabilityException.createMany({
        data: exceptions,
        skipDuplicates: true,
      });
      exceptionRows += ex.count;
    }
    const closedDates = new Set(
      exceptions
        .filter((e) => e.type === AvailabilityExceptionType.CLOSE_DATE)
        .map((e) => (e.date as Date).getTime()),
    );
    const capOverrides = new Map(
      exceptions
        .filter(
          (e) =>
            e.type === AvailabilityExceptionType.SET_CAPACITY &&
            e.capacity != null,
        )
        .map((e) => [`${(e.date as Date).getTime()}`, e.capacity as number]),
    );
    // Slot-level closures: the departure still exists, marked CLOSED (that is
    // what the engine's CLOSE_SLOT produces - stop-sell, not deletion).
    const closedSlots = new Set(
      exceptions
        .filter((e) => e.type === AvailabilityExceptionType.CLOSE_SLOT)
        .map((e) => `${(e.date as Date).getTime()}|${startTimes[0]}`),
    );

    // Materialize departures for the horizon. The seasonal tour's schedule
    // starts beyond it, so it correctly gets none (the engine would agree).
    const departureData: Prisma.DepartureCreateManyInput[] = [];
    if (!seasonal) {
      for (let d = -PAST_DAYS; d <= HORIZON_DAYS; d++) {
        if (d === 0) continue;
        const date = dayOffset(d);
        if (closedDates.has(date.getTime())) continue;
        const wd = isoWeekday(date);
        if (!weekdays.includes(wd)) continue;
        for (const st of startTimes) {
          const cap = capOverrides.get(`${date.getTime()}`) ?? capacity;
          const slotClosed = closedSlots.has(`${date.getTime()}|${st}`);
          departureData.push({
            tourId: tour.id,
            date,
            startTime: timeOf(st),
            capacity: cap,
            bookedCount: 0,
            status: slotClosed ? DepartureStatus.CLOSED : DepartureStatus.OPEN,
            source: DepartureSource.SCHEDULE,
          });
        }
      }
      // A guaranteed near-term sell-out on every 6th tour: an extra "private
      // hire" departure tomorrow, full. Gives the sold-out state (grid dot,
      // agenda chip, soldOutAt line) a subject even before organic bookings
      // fill anything.
      if (idx % 6 === 2) {
        departureData.push({
          tourId: tour.id,
          date: dayOffset(1),
          startTime: timeOf('18:30'),
          capacity: 2,
          bookedCount: 2,
          status: DepartureStatus.SOLD_OUT,
          soldOutAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
          source: DepartureSource.EXCEPTION,
          manuallyEdited: true,
        });
        // Written directly - the batch createMany above has already run.
        const added = await prisma.availabilityException.createMany({
          data: [
            {
              tourId: tour.id,
              date: dayOffset(1),
              startTime: timeOf('18:30'),
              type: AvailabilityExceptionType.ADD_SLOT,
              capacity: 2,
              note: 'Private sunset hire',
              createdBy,
            },
          ],
          skipDuplicates: true,
        });
        exceptionRows += added.count;
      }
    }
    if (departureData.length) {
      const dep = await prisma.departure.createMany({
        data: departureData,
        skipDuplicates: true,
      });
      departureRows += dep.count;
    }

    await prisma.tour.update({
      where: { id: tour.id },
      data: {
        isBookable: !seasonal,
        // Stale on purpose (yesterday evening): the agenda's freshness card
        // should open with something to confirm, not a pre-confirmed ✓.
        availabilityConfirmedAt: new Date(Date.now() - 18 * 60 * 60 * 1000),
        spotsRemaining: seasonal ? 0 : capacity,
      },
    });
  }

  log(
    `Availability: ${schedRows} schedules, ${exceptionRows} exceptions, ${departureRows} departures across ${pending.length} tours.`,
  );
}
