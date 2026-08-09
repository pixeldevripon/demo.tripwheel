import { AddOnUnit, Currency, PaymentModel, Prisma } from '@prisma/client';
import { retailWhole } from '@/fx/fx-rates.service';

/**
 * Pure booking-money computation (no I/O) - totals, deposit/balance split, and the
 * EUR-normalized commission snapshot. Kept pure so the (correctness-critical) money
 * math is exhaustively unit-testable.
 *
 * ## Money rules
 * - All amounts are `Decimal(10,2)` rounded to 2 dp at the boundary.
 * - Deposit/balance split is driven by `paymentModel` (master rule #21).
 * - Commission is snapshotted as a fraction (`commissionRate`) and an **EUR** amount
 *   (master rule #22). FX (USD→EUR) arrives in Phase 6; until then EUR bookings get a
 *   real `commissionAmount` and non-EUR bookings leave it null (filled at Phase 6).
 *
 * ## Pricing models (checklist §1.3, decisions D1/D1a)
 * - `PER_PERSON`: `lines` (age-band × qty) sum to the retail; one unit item per seat.
 * - `UNIT`: a single whole-unit charter price. Formula:
 *     `unitTotal = basePrice + max(0, guests - unitIncludedGuests) * extraPersonPrice`
 *   The surcharge only ever applies to GROUP charters; boat/vehicle/aircraft/package are
 *   flat, so the caller passes `unitIncludedGuests: null` / `extraPersonPrice: null` and the
 *   formula degrades to a flat `basePrice`. `guests` still expands to one unit item per seat
 *   (manifest + capacity headcount); the whole-unit retail rides on the first item.
 */

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const money = (v: Prisma.Decimal) =>
  v.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
/**
 * Traveller-facing retail: a whole currency unit, always UP (`retailWhole`).
 * `money()` (2dp) stays for the intermediate line maths, operator cost and the
 * EUR commission - see the note on `retailWhole`.
 */
const retail = retailWhole;

export interface PriceLineInput {
  ageBandId: string;
  quantity: number;
  priceRetail: Prisma.Decimal;
  priceNet: Prisma.Decimal | null;
  /** Age-band label, carried for the quote breakdown (unused by the money math). */
  label?: string;
}

/**
 * Whole-unit (charter) pricing input. `unitIncludedGuests` / `extraPersonPrice` are
 * non-null only for GROUP charters (D1a); for flat unit types they are null and the
 * total reduces to a flat `basePrice`.
 */
export interface UnitPricingInput {
  guests: number;
  basePrice: Prisma.Decimal;
  unitIncludedGuests: number | null;
  extraPersonPrice: Prisma.Decimal | null;
  /** Whole-unit net cost, if known (usually null until margin data exists). */
  priceNet: Prisma.Decimal | null;
}

export interface AddOnLineInput {
  addOnId: string | null;
  name: string;
  unit: AddOnUnit;
  quantity: number;
  unitPrice: Prisma.Decimal;
  /** Operator ceiling (`TourAddOn.maxQuantity`); folded into {@link addOnQuantityCap}. */
  maxQuantity?: number;
}

/**
 * Priced pickup input (master 5.8 "operator zones with prices"). `unitPrice` is the
 * PER-PERSON zone price in SOURCE currency; the line total is `unitPrice × pax`.
 * The caller passes this ONLY when the tour's pickupModel = PAID_ADDON and the
 * selected zone carries a positive price (INCLUDED/free zones never charge).
 */
export interface PickupLineInput {
  unitPrice: Prisma.Decimal;
}

export interface ExpandedPickup {
  unitPrice: Prisma.Decimal;
  totalPrice: Prisma.Decimal;
}

export interface ExpandedUnitItem {
  ageBandId: string | null;
  priceRetail: Prisma.Decimal;
  priceNet: Prisma.Decimal | null;
}

export interface ExpandedAddOn {
  addOnId: string | null;
  name: string;
  unit: AddOnUnit;
  quantity: number;
  unitPrice: Prisma.Decimal;
  totalPrice: Prisma.Decimal;
}

export interface BookingPricing {
  // Charged/display (booking) currency.
  totalRetail: Prisma.Decimal;
  totalNet: Prisma.Decimal | null;
  depositAmount: Prisma.Decimal;
  balanceAmount: Prisma.Decimal;
  // Original tour (source) currency snapshot (guide §20.2) - equal to the booking-currency
  // figures when source == booking (rate 1).
  sourceTotalRetail: Prisma.Decimal;
  sourceDepositAmount: Prisma.Decimal;
  sourceBalanceAmount: Prisma.Decimal;
  sourceFxRateToBooking: Prisma.Decimal;
  // Commission is always EUR (rule #22).
  commissionRate: Prisma.Decimal;
  commissionAmount: Prisma.Decimal | null;
  totalEur: Prisma.Decimal | null;
  fxRateToEur: Prisma.Decimal | null;
  unitItems: ExpandedUnitItem[]; // priced in BOOKING currency (guide §20.8.7)
  addOns: ExpandedAddOn[]; // priced in BOOKING currency
  pickup: ExpandedPickup | null; // priced in BOOKING currency; null = free/no pickup
  pax: number;
}

interface ComputeInput {
  /** Per-person path: age-band lines. Provide exactly one of `lines` / `unit`. */
  lines?: PriceLineInput[];
  /** Unit path: whole-unit charter. Provide exactly one of `lines` / `unit`. */
  unit?: UnitPricingInput;
  addOns?: AddOnLineInput[];
  /** Priced pickup zone (PAID_ADDON model only); charged per person. */
  pickup?: PickupLineInput | null;
  /** Tour (source) currency the age-band/base prices are expressed in. */
  sourceCurrency: Currency;
  /** Currency the traveler is charged/quoted in (== sourceCurrency when not converting). */
  bookingCurrency: Currency;
  /** Rate: sourceCurrency → bookingCurrency (1 when same). Snapshotted for audit. */
  sourceFxRateToBooking: Prisma.Decimal;
  /** Rate: bookingCurrency → EUR, or null when unresolved (commission then null). */
  fxRateToEur: Prisma.Decimal | null;
  paymentModel: PaymentModel;
  /** Tour deposit percentage (e.g. 20.0 = 20%). */
  depositPct: Prisma.Decimal;
  /** Tour commission tier percentage (e.g. 22.5 = 22.5%). */
  commissionTier: Prisma.Decimal;
}

export function computeBookingPricing(input: ComputeInput): BookingPricing {
  const {
    lines,
    unit,
    addOns = [],
    pickup = null,
    sourceFxRateToBooking,
    fxRateToEur,
    paymentModel,
    depositPct,
    commissionTier,
  } = input;

  if ((lines?.length ?? 0) === 0 && !unit) {
    throw new Error('computeBookingPricing requires either lines or unit');
  }

  // Convert a SOURCE-currency amount into BOOKING currency, rounded HALF_UP to 2dp at the
  // line boundary (guide §20.5 rounding policy). Same-currency uses rate 1 → identity.
  // Operator cost (`priceNet`) only - see `toRetail` for anything a traveller reads.
  const toBooking = (v: Prisma.Decimal) =>
    money(v.times(sourceFxRateToBooking));

  /**
   * A traveller-facing seat / add-on / pickup price: converted, then taken to a
   * WHOLE currency unit, always up.
   *
   * This is applied PER UNIT PRICE and the total is the sum of them, which is a
   * change of order from "sum at 2dp, then ceil the total". The old order was
   * right while the breakdown displayed cents - it stopped a fraction-of-a-unit
   * gain stacking per seat. It stopped being right the moment the unit prices
   * themselves became whole (Pastel #41): the card offered "Adult EUR 128" and
   * "Child EUR 77" for three each and then totalled them at EUR 614, because 614
   * is `ceil(3 x 127.88 + 3 x 76.728)` while the rows a traveller can add up say
   * 615. The checkout summary, which sums the rows, said 615 - the same booking
   * priced two ways one navigation apart (founder, 2026-08-06).
   *
   * Sum-of-wholes is the only order that agrees with a whole-unit breakdown, so
   * the quote now prices exactly what the rows say. It can only ever round in
   * the traveller-safe direction (never below the operator's own price).
   */
  const toRetail = (v: Prisma.Decimal) => retailWhole(toBooking(v));

  // ── Participant expansion in SOURCE currency: one unit item per seat ──
  const src = unit
    ? computeUnitLines(unit)
    : computePerPersonLines(lines ?? []);
  const pax = src.pax;

  // ── Convert each participant seat to booking currency; sum for retail ──
  // The SOURCE sum is re-accumulated from the same whole-unit rule rather than
  // taken from `src.unitsRetail` (raw), so a same-currency booking still has
  // `sourceTotalRetail === totalRetail` at rate 1.
  let unitsRetail = D(0);
  let sourceUnitsRetail = D(0);
  const unitItems: ExpandedUnitItem[] = src.unitItems.map((u) => {
    const priceRetail = toRetail(u.priceRetail);
    unitsRetail = unitsRetail.plus(priceRetail);
    sourceUnitsRetail = sourceUnitsRetail.plus(retailWhole(u.priceRetail));
    return {
      ageBandId: u.ageBandId,
      priceRetail,
      priceNet: u.priceNet != null ? toBooking(u.priceNet) : null,
    };
  });
  const unitsNet = toBooking(src.unitsNet);

  // ── Add-ons: convert the unit price, then charge the quantity ASKED FOR ──
  //
  // The quantity IS the number of units, and the unit is whatever the price line
  // says (Pastel #58, founder 2026-08-07). "$22 per person" means one step is
  // one person, so one open bar is $22 whatever the party size; two open bars
  // for two adults is the traveller's choice to make, not ours to assume.
  //
  // This used to multiply a PER_PERSON add-on by `pax` on top of the quantity
  // the traveller picked, so the same extra was counted twice: two adults
  // adding one open bar were charged $44. `unit` still matters - it decides the
  // CAP (`assertAddOnQuantities`) and the price-line wording - but never the
  // multiplier.
  const expandedAddOns: ExpandedAddOn[] = [];
  let addOnsRetail = D(0);
  let sourceAddOnsRetail = D(0);
  for (const a of addOns) {
    sourceAddOnsRetail = sourceAddOnsRetail.plus(
      retailWhole(a.unitPrice).times(a.quantity),
    );
    const unitPrice = toRetail(a.unitPrice);
    const totalPrice = unitPrice.times(a.quantity);
    addOnsRetail = addOnsRetail.plus(totalPrice);
    // Built field by field, not spread: `maxQuantity` is an input-side ceiling
    // and has no business riding along into the persisted booking line.
    expandedAddOns.push({
      addOnId: a.addOnId,
      name: a.name,
      unit: a.unit,
      quantity: a.quantity,
      unitPrice,
      totalPrice,
    });
  }

  // ── Pickup: per-person zone price × pax (master 5.8; PAID_ADDON model only) ──
  let expandedPickup: ExpandedPickup | null = null;
  let pickupRetail = D(0);
  let sourcePickupRetail = D(0);
  if (pickup && pickup.unitPrice.greaterThan(0)) {
    sourcePickupRetail = retailWhole(pickup.unitPrice).times(pax);
    const unitPrice = toRetail(pickup.unitPrice);
    const totalPrice = unitPrice.times(pax);
    pickupRetail = totalPrice;
    expandedPickup = { unitPrice, totalPrice };
  }

  // ── Totals: booking currency (charged) + source currency (audit snapshot) ──
  // Extras = add-ons + priced pickup. They ride in the full booking total but
  // are EXCLUDED from the deposit-% and commission-% bases (founder decision
  // 2026-07-25; LD18 "purchaseable in advance"): the percentages apply to the
  // TOUR price only, while extras are charged 100% up front.
  const extrasRetail = money(addOnsRetail.plus(pickupRetail));
  const sourceExtrasRetail = money(sourceAddOnsRetail.plus(sourcePickupRetail));
  const tourRetail = money(unitsRetail);
  // The TOTAL is rounded first and the split is derived from it (founder,
  // 2026-08-05: "round the total first, then derive the deposit and balance
  // from it, so the lines add up"). Rounding each line instead would stack a
  // cent-to-a-unit gain per seat and per add-on, and the parts would no longer
  // sum to the whole.
  const totalRetail = retail(tourRetail.plus(extrasRetail));
  const totalNet = src.anyNetMissing ? null : money(unitsNet);
  const sourceTourRetail = money(sourceUnitsRetail);
  const sourceTotalRetail = retail(sourceTourRetail.plus(sourceExtrasRetail));

  // ── Deposit / balance split (master rule #21), computed in each currency.
  // The deposit % applies to the tour price only; on the deposit models the
  // extras ride on the operator-collected balance in full. ──
  const { depositAmount, balanceAmount } = splitDeposit(
    totalRetail,
    tourRetail,
    paymentModel,
    depositPct,
  );
  const source = splitDeposit(
    sourceTotalRetail,
    sourceTourRetail,
    paymentModel,
    depositPct,
  );

  // ── Commission snapshot (master rule #22 - always EUR). The rate applies to
  // the TOUR price only (extras excluded); totalEur stays the FULL booking
  // (master E.8 booking_total_eur = "volledige booking"). ──
  const commissionRate = commissionTier.dividedBy(100).toDecimalPlaces(4);
  const totalEur = fxRateToEur ? money(totalRetail.times(fxRateToEur)) : null;
  const tourEur = fxRateToEur ? money(tourRetail.times(fxRateToEur)) : null;
  const commissionAmount = tourEur
    ? money(tourEur.times(commissionRate))
    : null;

  return {
    totalRetail,
    totalNet,
    depositAmount,
    balanceAmount,
    sourceTotalRetail,
    sourceDepositAmount: source.depositAmount,
    sourceBalanceAmount: source.balanceAmount,
    sourceFxRateToBooking,
    commissionRate,
    commissionAmount,
    totalEur,
    fxRateToEur,
    unitItems,
    addOns: expandedAddOns,
    pickup: expandedPickup,
    pax,
  };
}

interface ParticipantExpansion {
  unitItems: ExpandedUnitItem[];
  unitsRetail: Prisma.Decimal;
  unitsNet: Prisma.Decimal;
  anyNetMissing: boolean;
  pax: number;
  /**
   * Seats on a priced band - the ceiling for a PER_PERSON add-on (Pastel #58:
   * "cap a per-person extra at the number of paying travelers"). A free band
   * (infants) takes a seat and counts toward capacity, but nobody buys an open
   * bar for a two-year-old.
   */
  payingPax: number;
}

/** PER_PERSON: expand each age-band line to one item per seat and sum retail/net. */
function computePerPersonLines(lines: PriceLineInput[]): ParticipantExpansion {
  const unitItems: ExpandedUnitItem[] = [];
  let unitsRetail = D(0);
  let unitsNet = D(0);
  let anyNetMissing = false;
  let pax = 0;
  let payingPax = 0;
  for (const l of lines) {
    pax += l.quantity;
    if (l.priceRetail.greaterThan(0)) payingPax += l.quantity;
    for (let i = 0; i < l.quantity; i++) {
      unitItems.push({
        ageBandId: l.ageBandId,
        priceRetail: l.priceRetail,
        priceNet: l.priceNet,
      });
    }
    unitsRetail = unitsRetail.plus(l.priceRetail.times(l.quantity));
    if (l.priceNet === null) anyNetMissing = true;
    else unitsNet = unitsNet.plus(l.priceNet.times(l.quantity));
  }
  return { unitItems, unitsRetail, unitsNet, anyNetMissing, pax, payingPax };
}

/**
 * UNIT: one flat whole-unit charter total (D1). The surcharge only applies to GROUP
 * charters (D1a) - flat unit types pass null included/extra and reduce to `basePrice`.
 * `guests` expands to one item per seat for the manifest/capacity headcount; the whole
 * retail rides on the first seat (the rest are 0) so the item sum equals the unit total.
 */
function computeUnitLines(unit: UnitPricingInput): ParticipantExpansion {
  const guests = Math.max(1, unit.guests);
  const included = unit.unitIncludedGuests ?? guests; // null => everyone included (flat)
  const extraGuests = Math.max(0, guests - included);
  const surcharge = unit.extraPersonPrice
    ? unit.extraPersonPrice.times(extraGuests)
    : D(0);
  const unitTotal = money(unit.basePrice.plus(surcharge));

  const unitItems: ExpandedUnitItem[] = Array.from(
    { length: guests },
    (_, i) => ({
      ageBandId: null,
      priceRetail: i === 0 ? unitTotal : money(D(0)),
      priceNet: i === 0 ? unit.priceNet : null,
    }),
  );

  return {
    unitItems,
    unitsRetail: unitTotal,
    unitsNet: unit.priceNet ?? D(0),
    anyNetMissing: unit.priceNet === null,
    pax: guests,
    // A charter has no free band: every guest is covered by the price paid.
    payingPax: guests,
  };
}

/**
 * The most of an add-on one booking may hold (Pastel #58, founder 2026-08-07).
 *
 * The quantity is a count of UNITS, and the unit is whatever the price line
 * says. So a `PER_PERSON` extra tops out at the number of paying travellers -
 * nobody buys five open bars for four people - and a `FLAT` (per-booking) extra
 * tops out at one, because the same booking cannot hold two of a thing that is
 * sold per booking. The operator's own `maxQuantity` still applies on top and
 * can only make the ceiling lower.
 *
 * Shared by the reserve/quote guard and mirrored by the widget's stepper, so a
 * quantity the card refuses to offer is also one the API refuses to price.
 */
export function addOnQuantityCap(
  unit: AddOnUnit,
  maxQuantity: number,
  payingPax: number,
): number {
  const byUnit = unit === AddOnUnit.PER_PERSON ? payingPax : 1;
  return Math.max(0, Math.min(maxQuantity, byUnit));
}

/**
 * Split an ALREADY-ROUNDED total into deposit + balance.
 *
 * `totalRetail` is the whole-unit total; `tourRetail` is the unrounded tour
 * portion, which is the base the deposit percentage applies to (extras are
 * excluded - see below). The balance is always `total - deposit`, so the two
 * lines add up to the total exactly, whatever the rounding did.
 */
function splitDeposit(
  totalRetail: Prisma.Decimal,
  tourRetail: Prisma.Decimal,
  paymentModel: PaymentModel,
  depositPct: Prisma.Decimal,
): { depositAmount: Prisma.Decimal; balanceAmount: Prisma.Decimal } {
  switch (paymentModel) {
    case PaymentModel.PAID_IN_FULL:
      // Platform collects the whole amount (tour + extras) up front.
      return {
        depositAmount: totalRetail,
        balanceAmount: money(D(0)),
      };
    case PaymentModel.OPERATOR_LINK:
    case PaymentModel.ON_ARRIVAL: {
      // Deposit models (master §2 / guide §20.6): platform captures the deposit up
      // front, operator collects the balance. The deposit % applies to the TOUR
      // price only, and extras (add-ons + priced pickup) ride ON THE BALANCE in
      // full - the traveler pays only the tour deposit today (founder decision
      // 2026-07-25, superseding the LD18 "purchaseable in advance" reading).
      // Deposit rounds UP like every other retail figure, then the balance is
      // whatever is left of the total - never computed independently, or the
      // two would stop summing to the total.
      const pctPart = retail(tourRetail.times(depositPct).dividedBy(100));
      return {
        depositAmount: pctPart,
        balanceAmount: totalRetail.minus(pctPart),
      };
    }
    case PaymentModel.OPERATOR_FULL:
    default:
      // No up-front charge; full amount settled with the operator. (OPERATOR_FULL is
      // dropped for v1 and rejected at reserve - kept here only for exhaustiveness.)
      return {
        depositAmount: money(D(0)),
        balanceAmount: totalRetail,
      };
  }
}
