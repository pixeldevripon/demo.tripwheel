import { AvailabilityStatus } from '@prisma/client';

/** Vacancies at/below this flip a departure to LIMITED (demand/urgency signal). */
export const LOW_VACANCY_THRESHOLD = 3;

/** A tour is "bookable" if it has ≥1 AVAILABLE departure within this horizon. */
export const BOOKABLE_HORIZON_DAYS = 30;

interface ComputeStatusInput {
  vacancies: number;
  capacity: number;
  utcCutoffAt: Date;
  now: Date;
  /** A manual CLOSED/FREESALE override is sticky and never recomputed. */
  manualStatus?: AvailabilityStatus | null;
}

/**
 * Live departure status (spec: vacancies + cutoff drive the OCTO status).
 *
 * Past the booking cutoff → CLOSED. Otherwise: 0 vacancies → SOLD_OUT,
 * ≤ {@link LOW_VACANCY_THRESHOLD} → LIMITED, else AVAILABLE. A manually set
 * CLOSED or FREESALE is honoured (operators can hard-close or open freesale).
 */
export function computeAvailabilityStatus({
  vacancies,
  capacity,
  utcCutoffAt,
  now,
  manualStatus,
}: ComputeStatusInput): AvailabilityStatus {
  if (manualStatus === AvailabilityStatus.CLOSED) return AvailabilityStatus.CLOSED;
  if (manualStatus === AvailabilityStatus.FREESALE) {
    // Freesale stays open until cutoff regardless of the (unbounded) counter.
    return now >= utcCutoffAt
      ? AvailabilityStatus.CLOSED
      : AvailabilityStatus.FREESALE;
  }
  if (now >= utcCutoffAt) return AvailabilityStatus.CLOSED;
  if (vacancies <= 0) return AvailabilityStatus.SOLD_OUT;
  if (vacancies <= Math.min(LOW_VACANCY_THRESHOLD, Math.max(1, capacity - 1))) {
    return AvailabilityStatus.LIMITED;
  }
  return AvailabilityStatus.AVAILABLE;
}

/**
 * Whether a departure can currently take a booking. LIMITED is "few seats left" -
 * still bookable; only SOLD_OUT and CLOSED are not.
 */
export function isDepartureBookable(status: AvailabilityStatus): boolean {
  return (
    status === AvailabilityStatus.AVAILABLE ||
    status === AvailabilityStatus.LIMITED ||
    status === AvailabilityStatus.FREESALE
  );
}
