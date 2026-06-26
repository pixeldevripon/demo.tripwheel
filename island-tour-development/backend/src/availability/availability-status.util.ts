import { DepartureStatus } from '@prisma/client';

/** A tour is "bookable" if it has >=1 OPEN, non-cutoff departure within this horizon. */
export const BOOKABLE_HORIZON_DAYS = 30;

/**
 * Master read contract (§4): `remaining` (capacity - bookedCount) is surfaced to the
 * traveler ONLY when below this threshold - the "Only N left" message. Above it,
 * remaining is hidden (ethical CRO: no manufactured scarcity).
 */
export const REMAINING_DISCLOSURE_THRESHOLD = 5;

/**
 * The stored status a departure should hold given its fill, EXCLUDING the sticky
 * operator/admin states (CLOSED / CANCELLED, which the caller must preserve). A full
 * departure is SOLD_OUT; otherwise OPEN.
 */
export function storedStatusForFill(
  capacity: number,
  bookedCount: number,
): DepartureStatus {
  return bookedCount >= capacity ? DepartureStatus.SOLD_OUT : DepartureStatus.OPEN;
}

interface LiveStatusInput {
  /** The persisted DepartureStatus. */
  status: DepartureStatus;
  capacity: number;
  bookedCount: number;
  /** now >= (localStart - bookingCutoffMinutes); computed live, never stored (§4). */
  cutoffPassed: boolean;
}

/**
 * The customer-facing departure status (master §4). CANCELLED and CLOSED are sticky
 * operator/admin states. Otherwise a full departure is SOLD_OUT, and an open one past
 * its booking cutoff renders CLOSED at read time (the cutoff is never materialized).
 */
export function liveDepartureStatus({
  status,
  capacity,
  bookedCount,
  cutoffPassed,
}: LiveStatusInput): DepartureStatus {
  if (status === DepartureStatus.CANCELLED) return DepartureStatus.CANCELLED;
  if (status === DepartureStatus.CLOSED) return DepartureStatus.CLOSED;
  if (bookedCount >= capacity) return DepartureStatus.SOLD_OUT;
  if (cutoffPassed) return DepartureStatus.CLOSED;
  return DepartureStatus.OPEN;
}

/** Only an OPEN (live) departure can take a booking. */
export function isDepartureBookable(live: DepartureStatus): boolean {
  return live === DepartureStatus.OPEN;
}

/** Whether to surface "Only N left" - master §4 anti-scarcity disclosure rule. */
export function discloseRemaining(remaining: number): boolean {
  return remaining > 0 && remaining < REMAINING_DISCLOSURE_THRESHOLD;
}
