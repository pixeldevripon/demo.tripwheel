/**
 * Shared price-unit labelling so every surface (listing cards, hub cards, the
 * tour-detail widget, checkout) speaks the same unit language. PER_PERSON reads
 * "per person"; UNIT reads a per-unit_type noun (per boat / vehicle / group /
 * aircraft / package). No server/client-only imports - safe in both bundles.
 */

/** The i18n key for a tour's price-unit suffix, resolved from its pricing model + unit type. */
export type PriceUnitKey =
  | 'per'
  | 'perGroup'
  | 'perBoat'
  | 'perVehicle'
  | 'perAircraft'
  | 'perPackage';

/** The set of localized price-unit strings a surface passes in. */
export type PriceUnitLabels = Record<PriceUnitKey, string>;

/**
 * Which price-unit key applies to a tour. PER_PERSON -> "per"; UNIT -> the key
 * for its `wholeUnitType` (GROUP is the default/fallback for a unit tour with no
 * type set).
 */
export function priceUnitKey(input: {
  pricingModel?: string | null;
  wholeUnitType?: string | null;
}): PriceUnitKey {
  if (input.pricingModel !== 'UNIT') return 'per';
  switch (input.wholeUnitType) {
    case 'BOAT':
      return 'perBoat';
    case 'VEHICLE':
      return 'perVehicle';
    case 'AIRCRAFT':
      return 'perAircraft';
    case 'PACKAGE':
      return 'perPackage';
    case 'GROUP':
    default:
      return 'perGroup';
  }
}

/** The localized price-unit suffix for a tour (e.g. "/per boat"). */
export function priceUnitLabel(
  input: { pricingModel?: string | null; wholeUnitType?: string | null },
  labels: PriceUnitLabels,
): string {
  return labels[priceUnitKey(input)];
}
