import { ResourceConsumption } from '@prisma/client';

/**
 * Resource allocation arithmetic. Pure - no Prisma, no I/O, no clock.
 *
 * This file answers one question: **given everything already committed on a
 * physical asset, may this departure sell n more?** It is deliberately separate
 * from the booking service so it can be exhaustively tested without a database,
 * and so the rules live in one readable place rather than inline in a
 * transaction.
 *
 * ## Nothing here is stored
 * Consumption is DERIVED from `departures.bookedCount` every time it is asked
 * for. There is no allocation ledger, and that is the load-bearing decision: a
 * ledger would need updating on booking, cancellation, hold expiry, restore,
 * date-change, no-show and capacity edit - seven places to drift. Deriving it
 * means cancelling a booking frees the asset automatically and drift is not
 * possible, because there is no second copy of the truth.
 *
 * ## The check is two-part, and the order matters
 * `EXCLUSIVE_ON_FIRST` is an **identity** ("this window belongs to product X"),
 * not a quantity, so a pure capacity sum gets it wrong: with 3 of 4 jet skis
 * sold on the safari, `consumed = 3` would happily let a private charter take
 * "the remaining one" - which is not what a charter is. Claimant is therefore
 * checked BEFORE capacity, never merged into it.
 *
 * Frozen design: `technical-doc/02-architecture/RESOURCE-ARCHITECTURE-REVIEW-VERDICT.md`
 */

/** A departure as the allocator needs to see it, resolved to absolute instants. */
export interface AllocDeparture {
  id: string;
  tourId: string;
  /** Seats already committed. Includes holds - a hold is a real claim on the asset. */
  bookedCount: number;
  /** The departure's OWN capacity, before any resource constraint. */
  capacity: number;
  /** Half-open window `[startUtc, endUtc)`, already resolved from local time. */
  startUtc: Date;
  endUtc: Date;
  /** How this departure's tour consumes the resource. */
  mode: ResourceConsumption;
  /** Only used to break a claimant tie deterministically. */
  createdAt: Date;
}

/** Everything committed on one resource across the range being considered. */
export interface AllocResource {
  resourceId: string;
  /** Total simultaneous units: 4 jet skis, 60 seats, 1 guide. */
  capacity: number;
  departures: AllocDeparture[];
}

export interface AllocWindow {
  startUtc: Date;
  endUtc: Date;
}

/** Who currently owns a window, when a departure has committed the asset. */
export interface Claimant {
  departureId: string;
  tourId: string;
  mode: ResourceConsumption;
  /** True when a second, contradictory claimant was found (data predating the feature). */
  ambiguous: boolean;
}

export type AllocDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason:
        | 'CLAIMED_BY_OTHER_TOUR'
        | 'EXCLUSIVE_ALREADY_TAKEN'
        | 'NO_CAPACITY';
      /** Operator-legible, safe to surface. Never names another traveller. */
      message: string;
    };

/**
 * Half-open overlap: a departure ending exactly when another starts does not
 * collide. Back-to-back slots are the normal way an asset is scheduled, so
 * treating the boundary as a conflict would block ordinary operation.
 */
export function overlaps(a: AllocWindow, b: AllocWindow): boolean {
  return a.startUtc < b.endUtc && a.endUtc > b.startUtc;
}

/** Departures on this resource whose window intersects `window`. */
function overlapping(
  resource: AllocResource,
  window: AllocWindow,
): AllocDeparture[] {
  return resource.departures.filter((d) => overlaps(d, window));
}

/**
 * Units of the asset committed across `window`.
 *
 * `EXCLUSIVE` with anything sold takes the WHOLE asset - that is what a private
 * charter means, and it is why the value is `resource.capacity` rather than the
 * departure's own count. An EXCLUSIVE departure with nothing sold consumes
 * nothing: it is merely on offer, and the asset is still free.
 */
export function consumed(
  resource: AllocResource,
  window: AllocWindow,
  /** Optional override, used to price a hypothetical claim without mutating. */
  override?: { departureId: string; bookedCount: number },
): number {
  let total = 0;
  for (const departure of overlapping(resource, window)) {
    const booked =
      override && override.departureId === departure.id
        ? override.bookedCount
        : departure.bookedCount;

    if (departure.mode === ResourceConsumption.EXCLUSIVE) {
      if (booked > 0) total += resource.capacity;
      continue;
    }
    total += booked;
  }
  return total;
}

/**
 * Which departure, if any, has taken the asset for this window.
 *
 * Both modes claim on first sale - the difference is what happens next, which
 * is `canClaim`'s business, not this function's. A window with nothing sold has
 * no claimant and is free to anyone.
 *
 * Two contradictory claimants should be impossible, but can exist in rows
 * predating this feature or after a manual capacity edit. Rather than guess, we
 * pick deterministically (earliest `createdAt`, then id) and flag `ambiguous` so
 * the caller can log a real inconsistency instead of silently resolving it.
 */
export function claimant(
  resource: AllocResource,
  window: AllocWindow,
): Claimant | null {
  const holders = overlapping(resource, window)
    .filter((d) => d.bookedCount > 0)
    .sort(
      (a, b) =>
        a.createdAt.getTime() - b.createdAt.getTime() ||
        a.id.localeCompare(b.id),
    );

  if (holders.length === 0) return null;

  const [first] = holders;
  return {
    departureId: first.id,
    tourId: first.tourId,
    mode: first.mode,
    ambiguous: holders.some((h) => h.tourId !== first.tourId),
  };
}

/**
 * May `target` sell `seats` more on this resource?
 *
 * Claimant first, capacity second. See the file docblock for why they cannot be
 * collapsed into one comparison.
 */
export function canClaim(
  resource: AllocResource,
  target: AllocDeparture,
  seats: number,
): AllocDecision {
  const owner = claimant(resource, target);

  if (owner) {
    // Someone else already holds the asset for this window.
    if (owner.departureId !== target.id) {
      return {
        allowed: false,
        reason: 'CLAIMED_BY_OTHER_TOUR',
        message:
          'Another tour has already committed this equipment at this time.',
      };
    }
    // The asset is held by THIS departure. Under EXCLUSIVE that still closes it:
    // a chartered fleet is gone, including to the charterer.
    if (target.mode === ResourceConsumption.EXCLUSIVE) {
      return {
        allowed: false,
        reason: 'EXCLUSIVE_ALREADY_TAKEN',
        message: 'This departure is already booked as an exclusive charter.',
      };
    }
  }

  // Price the post-claim world and compare once. Expressing the hypothetical as
  // an override rather than recomputing by hand keeps EXCLUSIVE's "takes the
  // whole asset" rule in exactly one place.
  const after =
    target.mode === ResourceConsumption.EXCLUSIVE
      ? target.capacity // any sale flips it to fully consumed
      : target.bookedCount + seats;

  const projected = consumed(resource, target, {
    departureId: target.id,
    bookedCount: after,
  });

  if (projected > resource.capacity) {
    return {
      allowed: false,
      reason: 'NO_CAPACITY',
      message: 'There is not enough equipment left at this time.',
    };
  }

  return { allowed: true };
}

/**
 * How many seats this departure can ACTUALLY sell, once shared assets are taken
 * into account.
 *
 * This is the number every read path should show. `departures.capacity` alone
 * stops being the truth the moment a resource is attached: a four-seat safari
 * on a chartered fleet still says `capacity = 4` while being completely
 * unsellable. Widgets, the listing gate, the CHANNEL iCal export and OCTO all
 * have to agree on this, or we publish availability that does not exist - to an
 * OTA, in the export's case.
 *
 * Returns the departure's own capacity unchanged when it has no resources,
 * which is the overwhelmingly common case and costs nothing.
 */
export function effectiveCapacity(
  departure: AllocDeparture,
  resources: AllocResource[],
): number {
  if (resources.length === 0) return departure.capacity;

  let effective = departure.capacity;

  for (const resource of resources) {
    const owner = claimant(resource, departure);

    // Held elsewhere, or exclusively held by this departure: nothing more can
    // be sold, but seats already committed remain valid - closing never
    // destroys a booking.
    if (
      owner &&
      (owner.departureId !== departure.id ||
        departure.mode === ResourceConsumption.EXCLUSIVE)
    ) {
      effective = Math.min(effective, departure.bookedCount);
      continue;
    }

    const headroom =
      resource.capacity - consumed(resource, departure) + departure.bookedCount;
    effective = Math.min(effective, headroom);
  }

  // A resource that is over-consumed (a capacity edit after the fact) must not
  // produce a negative capacity.
  return Math.max(0, effective);
}
