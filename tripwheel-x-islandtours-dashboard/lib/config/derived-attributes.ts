/**
 * Mirror of the backend `DERIVED_ATTRIBUTE_KEYS` (backend/src/attributes/
 * derived-attributes.ts). These attributes DUPLICATE a first-class tour field
 * and are the single source of truth of the tour's Details - the backend
 * computes them on read and rejects any attempt to set them, so the dashboard
 * Attributes tab hides them entirely (they're managed on the Details tab).
 * Keep this list in sync with the backend.
 */
export const DERIVED_ATTRIBUTE_KEYS: ReadonlySet<string> = new Set([
  'booking_type',
  'duration_minutes',
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

export function isDerivedAttribute(key: string): boolean {
  return DERIVED_ATTRIBUTE_KEYS.has(key);
}
