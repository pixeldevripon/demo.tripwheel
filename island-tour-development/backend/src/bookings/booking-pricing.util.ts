import { AddOnUnit, Currency, PaymentModel, Prisma } from '@prisma/client';

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
  pax: number;
}

interface ComputeInput {
  /** Per-person path: age-band lines. Provide exactly one of `lines` / `unit`. */
  lines?: PriceLineInput[];
  /** Unit path: whole-unit charter. Provide exactly one of `lines` / `unit`. */
  unit?: UnitPricingInput;
  addOns?: AddOnLineInput[];
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
  const toBooking = (v: Prisma.Decimal) =>
    money(v.times(sourceFxRateToBooking));

  // ── Participant expansion in SOURCE currency: one unit item per seat ──
  const src = unit
    ? computeUnitLines(unit)
    : computePerPersonLines(lines ?? []);
  const pax = src.pax;

  // ── Convert each participant seat to booking currency; sum for retail ──
  let unitsRetail = D(0);
  const unitItems: ExpandedUnitItem[] = src.unitItems.map((u) => {
    const priceRetail = toBooking(u.priceRetail);
    unitsRetail = unitsRetail.plus(priceRetail);
    return {
      ageBandId: u.ageBandId,
      priceRetail,
      priceNet: u.priceNet != null ? toBooking(u.priceNet) : null,
    };
  });
  const unitsNet = toBooking(src.unitsNet);

  // ── Add-ons: convert unit price, then PER_PERSON multiplies by pax; FLAT does not ──
  const expandedAddOns: ExpandedAddOn[] = [];
  let addOnsRetail = D(0);
  let sourceAddOnsRetail = D(0);
  for (const a of addOns) {
    const multiplier =
      a.unit === AddOnUnit.PER_PERSON ? a.quantity * pax : a.quantity;
    sourceAddOnsRetail = sourceAddOnsRetail.plus(a.unitPrice.times(multiplier));
    const unitPrice = toBooking(a.unitPrice);
    const totalPrice = money(unitPrice.times(multiplier));
    addOnsRetail = addOnsRetail.plus(totalPrice);
    expandedAddOns.push({ ...a, unitPrice, totalPrice });
  }

  // ── Totals: booking currency (charged) + source currency (audit snapshot) ──
  const totalRetail = money(unitsRetail.plus(addOnsRetail));
  const totalNet = src.anyNetMissing ? null : money(unitsNet);
  const sourceTotalRetail = money(src.unitsRetail.plus(sourceAddOnsRetail));

  // ── Deposit / balance split (master rule #21), computed in each currency ──
  const { depositAmount, balanceAmount } = splitDeposit(
    totalRetail,
    paymentModel,
    depositPct,
  );
  const source = splitDeposit(sourceTotalRetail, paymentModel, depositPct);

  // ── Commission snapshot (master rule #22 - always EUR) ──
  const commissionRate = commissionTier.dividedBy(100).toDecimalPlaces(4);
  const totalEur = fxRateToEur ? money(totalRetail.times(fxRateToEur)) : null;
  const commissionAmount = totalEur
    ? money(totalEur.times(commissionRate))
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
    pax,
  };
}

interface ParticipantExpansion {
  unitItems: ExpandedUnitItem[];
  unitsRetail: Prisma.Decimal;
  unitsNet: Prisma.Decimal;
  anyNetMissing: boolean;
  pax: number;
}

/** PER_PERSON: expand each age-band line to one item per seat and sum retail/net. */
function computePerPersonLines(lines: PriceLineInput[]): ParticipantExpansion {
  const unitItems: ExpandedUnitItem[] = [];
  let unitsRetail = D(0);
  let unitsNet = D(0);
  let anyNetMissing = false;
  let pax = 0;
  for (const l of lines) {
    pax += l.quantity;
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
  return { unitItems, unitsRetail, unitsNet, anyNetMissing, pax };
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
  };
}

function splitDeposit(
  totalRetail: Prisma.Decimal,
  paymentModel: PaymentModel,
  depositPct: Prisma.Decimal,
): { depositAmount: Prisma.Decimal; balanceAmount: Prisma.Decimal } {
  switch (paymentModel) {
    case PaymentModel.PAID_IN_FULL:
      // Platform collects the whole amount up front.
      return { depositAmount: totalRetail, balanceAmount: money(D(0)) };
    case PaymentModel.OPERATOR_LINK:
    case PaymentModel.ON_ARRIVAL: {
      // Deposit models (master §2 / guide §20.6): platform captures the deposit up
      // front, operator collects the balance on site. ON_ARRIVAL is a deposit model,
      // NOT zero-upfront - the deposit secures the booking and the commission.
      const depositAmount = money(totalRetail.times(depositPct).dividedBy(100));
      return {
        depositAmount,
        balanceAmount: money(totalRetail.minus(depositAmount)),
      };
    }
    case PaymentModel.OPERATOR_FULL:
    default:
      // No up-front charge; full amount settled with the operator. (OPERATOR_FULL is
      // dropped for v1 and rejected at reserve - kept here only for exhaustiveness.)
      return { depositAmount: money(D(0)), balanceAmount: totalRetail };
  }
}
