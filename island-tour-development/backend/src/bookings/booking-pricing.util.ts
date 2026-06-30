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
 */

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const money = (v: Prisma.Decimal) =>
  v.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

export interface PriceLineInput {
  ageBandId: string;
  quantity: number;
  priceRetail: Prisma.Decimal;
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
  ageBandId: string;
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
  totalRetail: Prisma.Decimal;
  totalNet: Prisma.Decimal | null;
  depositAmount: Prisma.Decimal;
  balanceAmount: Prisma.Decimal;
  commissionRate: Prisma.Decimal;
  commissionAmount: Prisma.Decimal | null;
  totalEur: Prisma.Decimal | null;
  fxRateToEur: Prisma.Decimal | null;
  unitItems: ExpandedUnitItem[];
  addOns: ExpandedAddOn[];
  pax: number;
}

interface ComputeInput {
  lines: PriceLineInput[];
  addOns?: AddOnLineInput[];
  currency: Currency;
  paymentModel: PaymentModel;
  /** Tour deposit percentage (e.g. 20.0 = 20%). */
  depositPct: Prisma.Decimal;
  /** Tour commission tier percentage (e.g. 22.5 = 22.5%). */
  commissionTier: Prisma.Decimal;
}

export function computeBookingPricing(input: ComputeInput): BookingPricing {
  const {
    lines,
    addOns = [],
    currency,
    paymentModel,
    depositPct,
    commissionTier,
  } = input;

  const pax = lines.reduce((s, l) => s + l.quantity, 0);

  // ── Unit lines: expand to one item per seat; sum retail/net ──
  const unitItems: ExpandedUnitItem[] = [];
  let unitsRetail = D(0);
  let unitsNet = D(0);
  let anyNetMissing = false;
  for (const l of lines) {
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

  // ── Add-ons: PER_PERSON multiplies by pax; FLAT does not ──
  const expandedAddOns: ExpandedAddOn[] = [];
  let addOnsRetail = D(0);
  for (const a of addOns) {
    const multiplier =
      a.unit === AddOnUnit.PER_PERSON ? a.quantity * pax : a.quantity;
    const totalPrice = money(a.unitPrice.times(multiplier));
    addOnsRetail = addOnsRetail.plus(totalPrice);
    expandedAddOns.push({ ...a, totalPrice });
  }

  const totalRetail = money(unitsRetail.plus(addOnsRetail));
  const totalNet = anyNetMissing ? null : money(unitsNet);

  // ── Deposit / balance split (master rule #21) ──
  const { depositAmount, balanceAmount } = splitDeposit(
    totalRetail,
    paymentModel,
    depositPct,
  );

  // ── Commission snapshot (master rule #22 - EUR) ──
  const commissionRate = commissionTier.dividedBy(100).toDecimalPlaces(4);
  const fxRateToEur = currency === Currency.EUR ? D(1) : null;
  const totalEur = fxRateToEur ? totalRetail : null;
  const commissionAmount = totalEur
    ? money(totalEur.times(commissionRate))
    : null;

  return {
    totalRetail,
    totalNet,
    depositAmount,
    balanceAmount,
    commissionRate,
    commissionAmount,
    totalEur,
    fxRateToEur,
    unitItems,
    addOns: expandedAddOns,
    pax,
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
    case PaymentModel.OPERATOR_LINK: {
      // Platform takes the deposit; operator collects the balance on site.
      const depositAmount = money(totalRetail.times(depositPct).dividedBy(100));
      return {
        depositAmount,
        balanceAmount: money(totalRetail.minus(depositAmount)),
      };
    }
    case PaymentModel.ON_ARRIVAL:
    case PaymentModel.OPERATOR_FULL:
    default:
      // No up-front charge; full amount settled with the operator.
      return { depositAmount: money(D(0)), balanceAmount: totalRetail };
  }
}
