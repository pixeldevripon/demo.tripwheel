import { DepartureStatus } from '@prisma/client';
import {
  discloseRemaining,
  isDepartureBookable,
  liveDepartureStatus,
  storedStatusForFill,
} from './availability-status.util';

describe('liveDepartureStatus', () => {
  const base = { capacity: 10, bookedCount: 4, cutoffPassed: false };

  it('OPEN when there is room and the cutoff has not passed', () => {
    expect(liveDepartureStatus({ ...base, status: DepartureStatus.OPEN })).toBe(
      DepartureStatus.OPEN,
    );
  });

  it('SOLD_OUT when full, regardless of cutoff', () => {
    expect(
      liveDepartureStatus({ status: DepartureStatus.OPEN, capacity: 10, bookedCount: 10, cutoffPassed: false }),
    ).toBe(DepartureStatus.SOLD_OUT);
  });

  it('CLOSED (live) once the cutoff has passed', () => {
    expect(
      liveDepartureStatus({ ...base, status: DepartureStatus.OPEN, cutoffPassed: true }),
    ).toBe(DepartureStatus.CLOSED);
  });

  it('keeps a sticky CLOSED even with room', () => {
    expect(liveDepartureStatus({ ...base, status: DepartureStatus.CLOSED })).toBe(
      DepartureStatus.CLOSED,
    );
  });

  it('keeps a sticky CANCELLED above everything', () => {
    expect(
      liveDepartureStatus({ status: DepartureStatus.CANCELLED, capacity: 10, bookedCount: 0, cutoffPassed: true }),
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

describe('discloseRemaining', () => {
  it('surfaces "Only N left" only below the threshold (anti-scarcity)', () => {
    expect(discloseRemaining(0)).toBe(false); // sold out: nothing to disclose
    expect(discloseRemaining(1)).toBe(true);
    expect(discloseRemaining(4)).toBe(true);
    expect(discloseRemaining(5)).toBe(false);
    expect(discloseRemaining(20)).toBe(false);
  });
});
