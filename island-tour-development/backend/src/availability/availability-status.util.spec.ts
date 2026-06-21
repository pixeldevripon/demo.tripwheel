import { AvailabilityStatus } from '@prisma/client';
import {
  computeAvailabilityStatus,
  isDepartureBookable,
} from './availability-status.util';

const future = new Date('2030-01-01T12:00:00.000Z');
const past = new Date('2020-01-01T12:00:00.000Z');
const now = new Date('2026-06-21T12:00:00.000Z');

describe('computeAvailabilityStatus', () => {
  it('CLOSED once past the cutoff', () => {
    expect(
      computeAvailabilityStatus({ vacancies: 5, capacity: 10, utcCutoffAt: past, now }),
    ).toBe(AvailabilityStatus.CLOSED);
  });

  it('SOLD_OUT at zero vacancies', () => {
    expect(
      computeAvailabilityStatus({ vacancies: 0, capacity: 10, utcCutoffAt: future, now }),
    ).toBe(AvailabilityStatus.SOLD_OUT);
  });

  it('LIMITED at/below the low-vacancy threshold', () => {
    expect(
      computeAvailabilityStatus({ vacancies: 2, capacity: 10, utcCutoffAt: future, now }),
    ).toBe(AvailabilityStatus.LIMITED);
  });

  it('AVAILABLE with ample vacancies', () => {
    expect(
      computeAvailabilityStatus({ vacancies: 8, capacity: 10, utcCutoffAt: future, now }),
    ).toBe(AvailabilityStatus.AVAILABLE);
  });

  it('honours a sticky manual CLOSED even with vacancies', () => {
    expect(
      computeAvailabilityStatus({
        vacancies: 8,
        capacity: 10,
        utcCutoffAt: future,
        now,
        manualStatus: AvailabilityStatus.CLOSED,
      }),
    ).toBe(AvailabilityStatus.CLOSED);
  });

  it('keeps FREESALE open until the cutoff, then CLOSED', () => {
    expect(
      computeAvailabilityStatus({
        vacancies: 0,
        capacity: 10,
        utcCutoffAt: future,
        now,
        manualStatus: AvailabilityStatus.FREESALE,
      }),
    ).toBe(AvailabilityStatus.FREESALE);
    expect(
      computeAvailabilityStatus({
        vacancies: 0,
        capacity: 10,
        utcCutoffAt: past,
        now,
        manualStatus: AvailabilityStatus.FREESALE,
      }),
    ).toBe(AvailabilityStatus.CLOSED);
  });

  it('treats a small-capacity slot sensibly (capacity 2)', () => {
    // threshold = min(3, max(1, capacity-1)) = 1
    expect(
      computeAvailabilityStatus({ vacancies: 2, capacity: 2, utcCutoffAt: future, now }),
    ).toBe(AvailabilityStatus.AVAILABLE);
    expect(
      computeAvailabilityStatus({ vacancies: 1, capacity: 2, utcCutoffAt: future, now }),
    ).toBe(AvailabilityStatus.LIMITED);
  });
});

describe('isDepartureBookable', () => {
  it('is true for AVAILABLE, LIMITED and FREESALE; false for SOLD_OUT/CLOSED', () => {
    expect(isDepartureBookable(AvailabilityStatus.AVAILABLE)).toBe(true);
    expect(isDepartureBookable(AvailabilityStatus.FREESALE)).toBe(true);
    expect(isDepartureBookable(AvailabilityStatus.LIMITED)).toBe(true);
    expect(isDepartureBookable(AvailabilityStatus.SOLD_OUT)).toBe(false);
    expect(isDepartureBookable(AvailabilityStatus.CLOSED)).toBe(false);
  });
});
