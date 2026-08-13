import { Prisma, PickupModel, TourBookingType } from '@prisma/client';

import { isOvernightCharter, OVERNIGHT_MIN_MINUTES } from '@/tours/overnight';

/**
 * Single-source-of-truth for tour attributes that DUPLICATE a first-class Tour
 * column. These are NEVER stored in `tour_attributes` and NEVER editable in the
 * Attributes tab - they are DERIVED on read from the tour's own fields (master
 * E.3: `cancellation_hours` is canonical and supersedes `cancellation_window_hours`;
 * `free_cancellation` is "always true, derivable, drop it"; `pickup_model`
 * supersedes the boolean `pickup_available`).
 *
 * Any read that surfaces a tour's attributes (dashboard editor, public filter
 * facets, cards, hub comparison) must strip these keys from stored rows and merge
 * in `deriveTourAttributes(tour)` so the tour's Details are the only place they
 * are set.
 */
export const DERIVED_ATTRIBUTE_KEYS: ReadonlySet<string> = new Set([
  'booking_type',
  'duration_minutes',
  'sleep_aboard',
  'pickup_available',
  'instant_confirmation',
  'free_cancellation',
  'guide_languages',
  'wheelchair_accessible',
  'family_friendly',
  'suitable_for_beginners',
  'cancellation_window_hours',
  'maximum_travelers',
  'minimum_age',
  'meeting_point',
]);

export function isDerivedAttributeKey(key: string): boolean {
  return DERIVED_ATTRIBUTE_KEYS.has(key);
}

/** ISO 639-1 code -> the `guide_languages` attribute value (matches the dictionary's allowedValues). */
const ISO_TO_GUIDE_LANG: Record<string, string> = {
  en: 'english',
  es: 'spanish',
  nl: 'dutch',
  fr: 'french',
  de: 'german',
  pt: 'portuguese',
};

/** `guide_languages` attribute value -> ISO 639-1 code (reverse of the above), for filtering. */
const GUIDE_LANG_TO_ISO: Record<string, string> = Object.fromEntries(
  Object.entries(ISO_TO_GUIDE_LANG).map(([iso, name]) => [name, iso]),
);

/** The exact Tour columns needed to derive every attribute above. */
export const derivedAttributeTourSelect = {
  cancellationHours: true,
  durationMinutesFrom: true,
  sleepAboard: true,
  pickupModel: true,
  instantConfirmation: true,
  bookingType: true,
  minAgeYears: true,
  maxPartySize: true,
  departureCity: true,
  wheelchairAccessible: true,
  familyFriendly: true,
  suitableForBeginners: true,
  languages: { select: { language: true } },
} satisfies Prisma.TourSelect;

export type DerivedAttributeTour = Prisma.TourGetPayload<{
  select: typeof derivedAttributeTourSelect;
}>;

export interface DerivedAttribute {
  key: string;
  /** Stored-string form (scalar, or JSON array string for ENUM_MULTI) so it renders like a real row. */
  value: string;
}

/**
 * Compute the derived attribute values for a tour from its first-class columns.
 * A key is omitted when the source field is null/empty (e.g. no `minAgeYears`)
 * so it behaves exactly like an unset attribute. Booleans that are always
 * meaningful (accessibility flags, free cancellation) are always emitted.
 */
export function deriveTourAttributes(
  tour: DerivedAttributeTour,
): DerivedAttribute[] {
  const out: DerivedAttribute[] = [];
  const bool = (key: string, v: boolean) =>
    out.push({ key, value: v ? 'true' : 'false' });
  const num = (key: string, v: number | null | undefined) => {
    if (v != null) out.push({ key, value: String(v) });
  };
  const text = (key: string, v: string | null | undefined) => {
    if (v != null && v.trim() !== '') out.push({ key, value: v.trim() });
  };

  num('cancellation_window_hours', tour.cancellationHours);
  // Free cancellation is a listing requirement (master 6.2), so it is always true.
  bool('free_cancellation', true);
  num('duration_minutes', tour.durationMinutesFrom);
  // The VERDICT (flag OR >=16h), not the raw column: a 3-day charter must
  // match the "Sleep aboard" filter even when the operator never touched the
  // toggle (which the dashboard only shows below the 16h auto-line).
  bool('sleep_aboard', isOvernightCharter(tour));
  bool('pickup_available', tour.pickupModel !== PickupModel.NONE);
  bool('instant_confirmation', tour.instantConfirmation);
  if (tour.bookingType) {
    out.push({ key: 'booking_type', value: tour.bookingType.toLowerCase() });
  }
  num('minimum_age', tour.minAgeYears);
  num('maximum_travelers', tour.maxPartySize);
  const langs = (tour.languages ?? [])
    .map((l) => ISO_TO_GUIDE_LANG[l.language])
    .filter((v): v is string => Boolean(v));
  if (langs.length) {
    out.push({ key: 'guide_languages', value: JSON.stringify(langs) });
  }
  text('meeting_point', tour.departureCity);
  bool('wheelchair_accessible', tour.wheelchairAccessible);
  bool('family_friendly', tour.familyFriendly);
  bool('suitable_for_beginners', tour.suitableForBeginners);

  return out;
}

/** Derived attributes as a key -> stored-value map (for merging into per-tour attribute maps). */
export function deriveTourAttributeMap(
  tour: DerivedAttributeTour,
): Map<string, string> {
  return new Map(deriveTourAttributes(tour).map((d) => [d.key, d.value]));
}

/**
 * Translate a filter on a DERIVED attribute key into a Tour column `where` clause
 * (single source of truth: filter the first-class field, never `tour_attributes`).
 * `values` are the raw filter values (OR within the key). Returns null when the
 * key is not a filterable derived key or the values yield no constraint.
 */
export function buildDerivedAttributeWhere(
  key: string,
  values: string[],
): Prisma.TourWhereInput | null {
  // Boolean column: honor a filter only when exactly one of true/false is asked
  // for (both, or neither, means "no constraint").
  const boolField = (
    field:
      | 'instantConfirmation'
      | 'wheelchairAccessible'
      | 'familyFriendly'
      | 'suitableForBeginners',
  ): Prisma.TourWhereInput | null => {
    const wantTrue = values.includes('true');
    const wantFalse = values.includes('false');
    if (wantTrue === wantFalse) return null;
    return { [field]: wantTrue };
  };

  switch (key) {
    case 'instant_confirmation':
      return boolField('instantConfirmation');
    case 'wheelchair_accessible':
      return boolField('wheelchairAccessible');
    case 'family_friendly':
      return boolField('familyFriendly');
    case 'suitable_for_beginners':
      return boolField('suitableForBeginners');
    // Mirrors the derive above: overnight verdict, not the raw column.
    case 'sleep_aboard': {
      const wantTrue = values.includes('true');
      const wantFalse = values.includes('false');
      if (wantTrue === wantFalse) return null;
      return wantTrue
        ? {
            OR: [
              { sleepAboard: true },
              { durationMinutesFrom: { gte: OVERNIGHT_MIN_MINUTES } },
            ],
          }
        : {
            sleepAboard: false,
            OR: [
              { durationMinutesFrom: null },
              { durationMinutesFrom: { lt: OVERNIGHT_MIN_MINUTES } },
            ],
          };
    }
    // Free cancellation is always true (listing requirement) - filtering is a no-op.
    case 'free_cancellation':
      return null;
    case 'pickup_available': {
      const wantTrue = values.includes('true');
      const wantFalse = values.includes('false');
      if (wantTrue === wantFalse) return null;
      return wantTrue
        ? { pickupModel: { not: PickupModel.NONE } }
        : { pickupModel: PickupModel.NONE };
    }
    case 'booking_type': {
      const map: Record<string, TourBookingType> = {
        private: TourBookingType.PRIVATE,
        shared: TourBookingType.SHARED,
      };
      const enums = values
        .map((v) => map[v])
        .filter((e): e is TourBookingType => Boolean(e));
      return enums.length ? { bookingType: { in: enums } } : null;
    }
    case 'guide_languages': {
      const isos = values
        .map((v) => GUIDE_LANG_TO_ISO[v])
        .filter((v): v is string => Boolean(v));
      return isos.length
        ? { languages: { some: { language: { in: isos } } } }
        : null;
    }
    case 'minimum_age': {
      const nums = values.map(Number).filter((n) => Number.isInteger(n));
      return nums.length ? { minAgeYears: { in: nums } } : null;
    }
    case 'duration_minutes': {
      const nums = values.map(Number).filter((n) => Number.isInteger(n));
      return nums.length ? { durationMinutesFrom: { in: nums } } : null;
    }
    default:
      return null;
  }
}
