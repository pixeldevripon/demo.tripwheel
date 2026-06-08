// Default Lucide icon (PascalCase name, a key of lucide-react's `icons` map) for each
// of the 19 canonical category slugs. Used to render a category icon when the category
// has no custom `icon` set. Pairs with the admin Category `icon` field + CategoryIconPicker.

export const CATEGORY_ICON_BY_SLUG: Record<string, string> = {
  'boat-tours': 'Ship',
  snorkeling: 'Waves',
  'scuba-diving': 'Anchor',
  'sunset-cruises': 'Sunset',
  'sightseeing-tours': 'Binoculars',
  'day-trips': 'Sun',
  'off-road-tours': 'Car',
  'jet-ski': 'Wind',
  parasailing: 'Wind',
  'water-sports': 'Waves',
  'fishing-trips': 'Fish',
  'nature-wildlife-tours': 'Bird',
  'hiking-tours': 'Mountain',
  'adventure-tours': 'Compass',
  'cultural-tours': 'Drama',
  'food-tours': 'Utensils',
  'attraction-tickets': 'Ticket',
  'luxury-experiences': 'Gem',
  'workshops-classes': 'GraduationCap',
};

/**
 * Resolve a Lucide icon name for a category. Prefers the category's own `icon`
 * (set in admin), then the canonical per-slug default, then a generic fallback.
 */
export function getCategoryIconName(
  slug: string | null | undefined,
  customIcon?: string | null,
  fallback = 'Tag',
): string {
  if (customIcon) return customIcon;
  if (slug && CATEGORY_ICON_BY_SLUG[slug]) return CATEGORY_ICON_BY_SLUG[slug];
  return fallback;
}
