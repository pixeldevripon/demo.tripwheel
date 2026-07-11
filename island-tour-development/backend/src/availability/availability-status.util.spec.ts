import { DepartureStatus } from '@prisma/client';
import {
  cutoffReached,
  discloseRemaining,
  isDepartureBookable,
  isDepartureLiveBookable,
  liveDepartureStatus,
  storedStatusForFill,
} from './availability-status.util';

/** A @db.Date storage value. */
const day = (d: string) => new Date(`${d}T00:00:00.000Z`);
/** A @db.Time(0) storage value (time-only, epoch day). */
const time = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(1970, 0, 1, h, m, 0));
};

describe('liveDepartureStatus', () => {
  const base = { capacity: 10, bookedCount: 4, cutoffPassed: false };

  it('OPEN when there is room and the cutoff has not passed', () => {
    expect(liveDepartureStatus({ ...base, status: DepartureStatus.OPEN })).toBe(
      DepartureStatus.OPEN,
    );
  });

  it('SOLD_OUT when full, regardless of cutoff', () => {
    expect(
      liveDepartureStatus({
        status: DepartureStatus.OPEN,
        capacity: 10,
        bookedCount: 10,
        cutoffPassed: false,
      }),
    ).toBe(DepartureStatus.SOLD_OUT);
  });

  it('CLOSED (live) once the cutoff has passed', () => {
    expect(
      liveDepartureStatus({
        ...base,
        status: DepartureStatus.OPEN,
        cutoffPassed: true,
      }),
    ).toBe(DepartureStatus.CLOSED);
  });

  it('keeps a sticky CLOSED even with room', () => {
    expect(
      liveDepartureStatus({ ...base, status: DepartureStatus.CLOSED }),
    ).toBe(DepartureStatus.CLOSED);
  });

  it('keeps a sticky CANCELLED above everything', () => {
    expect(
      liveDepartureStatus({
        status: DepartureStatus.CANCELLED,
        capacity: 10,
        bookedCount: 0,
        cutoffPassed: true,
      }),
    ).toBe(DepartureStatus.CANCELLED);
  });
});

describe('storedStatusForFill', () => {
  it('is OPEN with room and SOLD_OUT when full', () => {
    expect(storedStatusForFill(10, 9)).toBe(DepartureStatus.OPEN);
    expect(storedStatusForFill(10, 10)).toBe(DepartureStatus.SOLD_OUT);
    expect(storedStatusForFill(10, 11)).toBe(DepartureStatus.SOLD_OUT);
  });
});

describe('isDepartureBookable', () => {
  it('is true only for a live OPEN status', () => {
    expect(isDepartureBookable(DepartureStatus.OPEN)).toBe(true);
    expect(isDepartureBookable(DepartureStatus.SOLD_OUT)).toBe(false);
    expect(isDepartureBookable(DepartureStatus.CLOSED)).toBe(false);
    expect(isDepartureBookable(DepartureStatus.CANCELLED)).toBe(false);
  });
});

describe('cutoffReached', () => {
  it('is true once local now reaches (start - cutoff)', () => {
    // start = 1_000_000ms, cutoff 1 min → threshold 940_000ms
    expect(cutoffReached(1_000_000, 939_000, 1)).toBe(false);
    expect(cutoffReached(1_000_000, 940_000, 1)).toBe(true);
    expect(cutoffReached(1_000_000, 999_999, 1)).toBe(true);
  });
});

describe('isDepartureLiveBookable', () => {
  const base = {
    status: DepartureStatus.OPEN,
    capacity: 10,
    bookedCount: 4,
    startTime: time('09:00'),
    timeZone: 'America/Curacao',
    bookingCutoffMinutes: 120,
  };

  it('is true for an open, roomy, far-future departure', () => {
    expect(isDepartureLiveBookable({ ...base, date: day('2030-06-05') })).toBe(
      true,
    );
  });

  it('is false once the cutoff has passed (past date)', () => {
    expect(isDepartureLiveBookable({ ...base, date: day('2020-01-01') })).toBe(
      false,
    );
  });

  it('is false when sold out even in the future', () => {
    expect(
      isDepartureLiveBookable({
        ...base,
        date: day('2030-06-05'),
        bookedCount: 10,
      }),
    ).toBe(false);
  });

  it('is false when fewer seats remain than required', () => {
    expect(
      isDepartureLiveBookable({
        ...base,
        date: day('2030-06-05'),
        bookedCount: 8,
        requiredSeats: 3, // only 2 left
      }),
    ).toBe(false);
  });

  it('respects an explicit evaluation instant', () => {
    // A departure "today" is bookable well before, but not after, its cutoff.
    const dep = { ...base, date: day('2030-06-05') };
    // 06:00 Curaçao local (UTC-4) on the day → before 07:00 cutoff → bookable.
    expect(
      isDepartureLiveBookable({
        ...dep,
        now: new Date('2030-06-05T10:00:00.000Z'),
      }),
    ).toBe(true);
    // 08:00 Curaçao local → past the 07:00 cutoff → not bookable.
    expect(
      isDepartureLiveBookable({
        ...dep,
        now: new Date('2030-06-05T12:00:00.000Z'),
      }),
    ).toBe(false);
  });
});

describe('discloseRemaining', () => {
  it('surfaces "Only N left" only below the threshold (anti-scarcity)', () => {
    expect(discloseRemaining(0)).toBe(false); // sold out: nothing to disclose
    expect(discloseRemaining(1)).toBe(true);
    expect(discloseRemaining(4)).toBe(true);
    expect(discloseRemaining(5)).toBe(false);
    expect(discloseRemaining(20)).toBe(false);
  });
});
