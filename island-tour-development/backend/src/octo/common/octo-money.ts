import { Prisma } from '@prisma/client';
import type { Currency } from '@prisma/client';

/**
 * OCTO money encoding (spec §2 "Money encoding", §5.2 Pricing).
 *
 * ## What it does
 * OCTO transmits every monetary amount as an **integer in the currency's minor
 * units** with a sibling `currencyPrecision` (consumer recovers the real value
 * via `amount / 10^currencyPrecision`). Our DB stores money as `Decimal(10,2)`.
 * This module converts at the OCTO boundary — never leak floats/decimals.
 *
 * ## Usage
 * `toMinorUnits(decimal)` for a single amount; `buildPricing({...})` to assemble
 * a full OCTO `Pricing` object (used by `pricingFrom` on options/units and, later,
 * by availability/booking totals).
 */

/** USD and EUR are both 2-decimal currencies; OCTO needs this alongside the integer. */
export const CURRENCY_PRECISION: Record<Currency, number> = {
  USD: 2,
  EUR: 2,
};

export function currencyPrecision(currency: Currency): number {
  return CURRENCY_PRECISION[currency] ?? 2;
}

type DecimalLike = Prisma.Decimal | number | string | null | undefined;

/**
 * Convert a DB decimal amount to OCTO integer minor units.
 * Returns `null` for null/undefined input (OCTO treats absent prices as null).
 */
export function toMinorUnits(
  amount: DecimalLike,
  precision = 2,
): number | null {
  if (amount === null || amount === undefined) return null;
  const value =
    amount instanceof Prisma.Decimal ? amount.toNumber() : Number(amount);
  if (Number.isNaN(value)) return null;
  return Math.round(value * 10 ** precision);
}

/** One OCTO included-tax line (minor units). */
export interface OctoTax {
  name: string;
  retail: number;
  original?: number | null;
  net?: number | null;
}

/** OCTO Pricing object (spec §5.2). */
export interface OctoPricing {
  original: number;
  retail: number;
  net: number | null;
  currency: Currency;
  currencyPrecision: number;
  includedTaxes: OctoTax[];
}

interface BuildPricingInput {
  retail: DecimalLike;
  /** List / undiscounted price; falls back to `retail` when absent. */
  original?: DecimalLike;
  /** Supplier net; OCTO allows null. */
  net?: DecimalLike;
  currency: Currency;
  /** Optional raw `taxes` JSON ([{ name, retail, original?, net? }]); omitted for age bands. */
  taxes?: unknown;
}

/** Assemble an OCTO Pricing object from DB decimals. */
export function buildPricing({
  retail,
  original,
  net,
  currency,
  taxes,
}: BuildPricingInput): OctoPricing {
  const precision = currencyPrecision(currency);
  const retailMinor = toMinorUnits(retail, precision) ?? 0;
  const originalMinor = toMinorUnits(original, precision) ?? retailMinor;
  return {
    original: originalMinor,
    retail: retailMinor,
    net: toMinorUnits(net, precision),
    currency,
    currencyPrecision: precision,
    includedTaxes: normalizeTaxes(taxes, precision),
  };
}

/**
 * Normalize the stored `taxes` JSON (decimal amounts) into OCTO tax lines
 * (minor units). Stored shape: `[{ name, retail, original?, net? }]`.
 */
function normalizeTaxes(taxes: unknown, precision: number): OctoTax[] {
  if (!Array.isArray(taxes)) return [];
  const out: OctoTax[] = [];
  for (const raw of taxes) {
    if (!raw || typeof raw !== 'object') continue;
    const t = raw as Record<string, unknown>;
    const name = typeof t.name === 'string' ? t.name : null;
    const retail = toMinorUnits(t.retail as DecimalLike, precision);
    if (name === null || retail === null) continue;
    out.push({
      name,
      retail,
      original: toMinorUnits(t.original as DecimalLike, precision),
      net: toMinorUnits(t.net as DecimalLike, precision),
    });
  }
  return out;
}
