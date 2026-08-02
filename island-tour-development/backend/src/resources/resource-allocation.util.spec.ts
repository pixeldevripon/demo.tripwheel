import { ResourceConsumption } from '@prisma/client';
import {
  canClaim,
  claimant,
  consumed,
  effectiveCapacity,
  overlaps,
  type AllocDeparture,
  type AllocResource,
} from './resource-allocation.util';

const at = (hhmm: string) => new Date(`2026-08-02T${hhmm}:00.000Z`);

const departure = (over: Partial<AllocDeparture> = {}): AllocDeparture => ({
  id: 'd1',
  tourId: 't1',
  bookedCount: 0,
  capacity: 4,
  startUtc: at('09:00'),
  endUtc: at('12:00'),
  mode: ResourceConsumption.EXCLUSIVE_ON_FIRST,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  ...over,
});

/** The operator's four jet skis. */
const fleet = (departures: AllocDeparture[], capacity = 4): AllocResource => ({
  resourceId: 'r-fleet',
  capacity,
  departures,
});

describe('overlaps', () => {
  it('treats windows as half-open, so back-to-back slots do not collide', () => {
    const morning = { startUtc: at('09:00'), endUtc: at('12:00') };
    const afternoon = { startUtc: at('12:00'), endUtc: at('15:00') };
    expect(overlaps(morning, afternoon)).toBe(false);
  });

  it('detects a genuine overlap in either direction', () => {
    const a = { startUtc: at('09:00'), endUtc: at('12:00') };
    const b = { startUtc: at('11:00'), endUtc: at('14:00') };
    expect(overlaps(a, b)).toBe(true);
    expect(overlaps(b, a)).toBe(true);
  });
});

describe('consumed', () => {
  it('sums seats for shared consumption', () => {
    const r = fleet([
      departure({ id: 'a', bookedCount: 2 }),
      departure({ id: 'b', tourId: 't2', bookedCount: 1 }),
    ]);
    expect(consumed(r, departure())).toBe(3);
  });

  // The whole point of EXCLUSIVE: one sale removes the entire asset, not one unit.
  it('an EXCLUSIVE departure with any sale consumes the whole resource', () => {
    const r = fleet([
      departure({
        id: 'c',
        mode: ResourceConsumption.EXCLUSIVE,
        bookedCount: 1,
      }),
    ]);
    expect(consumed(r, departure())).toBe(4);
  });

  it('an EXCLUSIVE departure with nothing sold consumes nothing', () => {
    const r = fleet([
      departure({
        id: 'c',
        mode: ResourceConsumption.EXCLUSIVE,
        bookedCount: 0,
      }),
    ]);
    expect(consumed(r, departure())).toBe(0);
  });

  it('ignores departures outside the window', () => {
    const r = fleet([
      departure({
        id: 'evening',
        bookedCount: 4,
        startUtc: at('18:00'),
        endUtc: at('21:00'),
      }),
    ]);
    expect(consumed(r, departure())).toBe(0);
  });
});

describe('claimant', () => {
  it('is null while nothing has sold', () => {
    expect(
      claimant(fleet([departure({ bookedCount: 0 })]), departure()),
    ).toBeNull();
  });

  it('names the departure holding the window', () => {
    const r = fleet([
      departure({ id: 'a', tourId: 't-safari', bookedCount: 1 }),
    ]);
    expect(claimant(r, departure())?.tourId).toBe('t-safari');
  });

  // Should be impossible; can exist in rows predating the feature. Resolve
  // deterministically and SAY it was ambiguous rather than guessing quietly.
  it('breaks a two-tour tie by creation time and flags it', () => {
    const r = fleet([
      departure({
        id: 'later',
        tourId: 't2',
        bookedCount: 1,
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
      }),
      departure({
        id: 'earlier',
        tourId: 't1',
        bookedCount: 1,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ]);
    const owner = claimant(r, departure());
    expect(owner?.departureId).toBe('earlier');
    expect(owner?.ambiguous).toBe(true);
  });

  it('is not ambiguous when one tour holds several of its own departures', () => {
    const r = fleet([
      departure({ id: 'a', tourId: 't1', bookedCount: 1 }),
      departure({ id: 'b', tourId: 't1', bookedCount: 1 }),
    ]);
    expect(claimant(r, departure())?.ambiguous).toBe(false);
  });
});

describe('canClaim', () => {
  /**
   * THE regression test. Live data: Private Jet Ski Island Tour and Palm Beach
   * Jet Ski Safari, same operator, same date, same 09:00, four machines.
   * Today both sell to capacity because they are separate `departures` rows
   * with separate counters and nothing between them.
   */
  it('refuses a private charter once the shared safari has sold seats', () => {
    const safari = departure({
      id: 'safari',
      tourId: 't-safari',
      bookedCount: 3,
    });
    const charter = departure({
      id: 'charter',
      tourId: 't-charter',
      mode: ResourceConsumption.EXCLUSIVE,
      bookedCount: 0,
    });

    const decision = canClaim(fleet([safari, charter]), charter, 1);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed)
      expect(decision.reason).toBe('CLAIMED_BY_OTHER_TOUR');
  });

  // The mirror image, which the capacity sum alone would also have missed.
  it('refuses shared seats once the fleet is chartered', () => {
    const charter = departure({
      id: 'charter',
      tourId: 't-charter',
      mode: ResourceConsumption.EXCLUSIVE,
      bookedCount: 4,
    });
    const safari = departure({
      id: 'safari',
      tourId: 't-safari',
      bookedCount: 0,
    });

    const decision = canClaim(fleet([charter, safari]), safari, 1);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed)
      expect(decision.reason).toBe('CLAIMED_BY_OTHER_TOUR');
  });

  // A charter is all-or-nothing: it is gone even to the party who took it.
  it('refuses a second sale on an already-chartered departure', () => {
    const charter = departure({
      id: 'charter',
      mode: ResourceConsumption.EXCLUSIVE,
      bookedCount: 4,
    });
    const decision = canClaim(fleet([charter]), charter, 1);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed)
      expect(decision.reason).toBe('EXCLUSIVE_ALREADY_TAKEN');
  });

  it('lets the claiming tour keep filling its own departure', () => {
    const safari = departure({
      id: 'safari',
      tourId: 't-safari',
      bookedCount: 2,
    });
    expect(canClaim(fleet([safari]), safari, 2).allowed).toBe(true);
  });

  it('stops the claiming tour at the resource ceiling, not its own', () => {
    // The departure would allow 4; the fleet only has 3 left free.
    const safari = departure({ id: 'safari', bookedCount: 1, capacity: 4 });
    const other = departure({ id: 'other', tourId: 't2', bookedCount: 0 });
    const decision = canClaim(fleet([safari, other], 3), safari, 3);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toBe('NO_CAPACITY');
  });

  it('allows a first booking on a free asset', () => {
    const safari = departure({ bookedCount: 0 });
    expect(canClaim(fleet([safari]), safari, 2).allowed).toBe(true);
  });

  it('ignores commitments in a non-overlapping window', () => {
    const evening = departure({
      id: 'evening',
      tourId: 't2',
      bookedCount: 4,
      startUtc: at('18:00'),
      endUtc: at('21:00'),
    });
    const morning = departure({ id: 'morning', bookedCount: 0 });
    expect(canClaim(fleet([evening, morning]), morning, 4).allowed).toBe(true);
  });

  it('never leaks another traveller or tour in the operator-facing message', () => {
    const safari = departure({
      id: 'safari',
      tourId: 't-safari',
      bookedCount: 3,
    });
    const charter = departure({
      id: 'charter',
      tourId: 't-charter',
      mode: ResourceConsumption.EXCLUSIVE,
    });
    const decision = canClaim(fleet([safari, charter]), charter, 1);
    if (!decision.allowed) {
      expect(decision.message).not.toMatch(/t-safari|safari|d1/i);
    }
  });
});

describe('effectiveCapacity', () => {
  // The common case, and the one that must cost nothing.
  it('is the departure capacity when no resource is attached', () => {
    expect(effectiveCapacity(departure({ capacity: 12 }), [])).toBe(12);
  });

  /**
   * F4 - the finding most likely to become debt. A four-seat safari on a
   * chartered fleet still reports `capacity = 4` while being unsellable. Every
   * read path has to use THIS number: the widget, the listing gate, the CHANNEL
   * iCal export (which publishes to an OTA) and OCTO.
   */
  it('is zero for a sibling tour once the fleet is chartered', () => {
    const charter = departure({
      id: 'charter',
      tourId: 't-charter',
      mode: ResourceConsumption.EXCLUSIVE,
      bookedCount: 4,
    });
    const safari = departure({
      id: 'safari',
      tourId: 't-safari',
      bookedCount: 0,
    });
    expect(effectiveCapacity(safari, [fleet([charter, safari])])).toBe(0);
  });

  it('never drops below seats already sold - closing does not cancel anyone', () => {
    const safari = departure({
      id: 'safari',
      tourId: 't-safari',
      bookedCount: 2,
    });
    const charter = departure({
      id: 'charter',
      tourId: 't-charter',
      mode: ResourceConsumption.EXCLUSIVE,
      bookedCount: 4,
      createdAt: new Date('2025-01-01T00:00:00.000Z'), // claims first
    });
    expect(effectiveCapacity(safari, [fleet([charter, safari])])).toBe(2);
  });

  /**
   * EXCLUSIVE_ON_FIRST means the first product to sell OWNS the window - the
   * others do not get to share what is left. Two tours drawing on the same
   * fleet simultaneously would be PER_SEAT, which is deliberately not built:
   * it is a pooled-shuttle shape, not a boat or jet-ski one.
   */
  it('closes a sibling tour outright once another has claimed the fleet', () => {
    const other = departure({
      id: 'a-other',
      tourId: 't2',
      bookedCount: 2,
      createdAt: new Date('2025-01-01T00:00:00.000Z'), // claims first
    });
    const safari = departure({
      id: 'b-safari',
      tourId: 't1',
      bookedCount: 1,
      capacity: 4,
    });
    // Not "4 - 2 = 2 left" - the window belongs to t2, so t1 sells nothing more.
    expect(effectiveCapacity(safari, [fleet([safari, other])])).toBe(1);
  });

  it('is capped by the fleet when the departure alone wants more than exists', () => {
    // A 10-seat departure on a 4-unit fleet can only ever sell 4.
    const dep = departure({ id: 'd', bookedCount: 0, capacity: 10 });
    expect(effectiveCapacity(dep, [fleet([dep])])).toBe(4);
  });

  it('lets the claiming tour fill to the fleet ceiling', () => {
    const dep = departure({ id: 'd', bookedCount: 2, capacity: 10 });
    expect(effectiveCapacity(dep, [fleet([dep])])).toBe(4);
  });

  it('takes the tightest of several resources', () => {
    const dep = departure({ id: 'd', bookedCount: 0, capacity: 10 });
    const boat: AllocResource = {
      resourceId: 'boat',
      capacity: 8,
      departures: [dep],
    };
    const guide: AllocResource = {
      resourceId: 'guide',
      capacity: 3,
      departures: [dep],
    };
    expect(effectiveCapacity(dep, [boat, guide])).toBe(3);
  });

  // A capacity edit after bookings exist must not produce a negative number.
  it('floors at zero when a resource is over-consumed', () => {
    const a = departure({ id: 'a', tourId: 't1', bookedCount: 3 });
    const b = departure({ id: 'b', tourId: 't2', bookedCount: 3 });
    expect(effectiveCapacity(a, [fleet([a, b], 2)])).toBeGreaterThanOrEqual(0);
  });
});
