import {
  Ship, Sailboat, Anchor, Waves, Fish, LifeBuoy, Turtle, Bird,
  Mountain, MountainSnow, TreePalm, Trees, Tent, Compass, Map, MapPin,
  Binoculars, Camera, Footprints, Bike, Car, Caravan, Plane, Waypoints,
  Sun, Sunset, Droplets, Wind, Snowflake, Zap,
  Utensils, UtensilsCrossed, Wine, Coffee, Ticket, Sparkles,
  Drama, Music, Palette, GraduationCap, Flower2, Gem, Crown, Star, Tag,
  type LucideIcon,
} from 'lucide-react';

// Curated set of category-relevant Lucide icon names (PascalCase). The stored
// category `icon` value is one of these names. Only these icons are bundled
// (named imports - tree-shakeable), instead of the full lucide manifest.
export const CATEGORY_ICON_COMPONENTS: Record<string, LucideIcon> = {
  Ship, Sailboat, Anchor, Waves, Fish, LifeBuoy, Turtle, Bird,
  Mountain, MountainSnow, TreePalm, Trees, Tent, Compass, Map, MapPin,
  Binoculars, Camera, Footprints, Bike, Car, Caravan, Plane, Waypoints,
  Sun, Sunset, Droplets, Wind, Snowflake, Zap,
  Utensils, UtensilsCrossed, Wine, Coffee, Ticket, Sparkles,
  Drama, Music, Palette, GraduationCap, Flower2, Gem, Crown, Star, Tag,
};

export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICON_COMPONENTS).filter(
  n => n !== 'Tag',
);

// Default icon (a key of CATEGORY_ICON_COMPONENTS) for each of the 19 canonical
// category slugs. Used when a category has no custom `icon`.
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

/** Resolve the Lucide component for a category icon name (falls back to Tag). */
export function getCategoryIconComponent(name: string | null | undefined): LucideIcon {
  return (name && CATEGORY_ICON_COMPONENTS[name]) || Tag;
}
