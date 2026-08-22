import {
  Airplane01Icon,
  AnchorIcon,
  Bicycle01Icon,
  BinocularsIcon,
  BirdIcon,
  BoatIcon,
  Camera01Icon,
  Car01Icon,
  CaravanIcon,
  CargoShipIcon,
  Coffee01Icon,
  CompassIcon,
  CrabIcon,
  CrownIcon,
  DiamondIcon,
  DrinkIcon,
  DropletIcon,
  FastWindIcon,
  FishIcon,
  FlowerIcon,
  LifebuoyIcon,
  Location01Icon,
  MapsIcon,
  Mortarboard02Icon,
  MountainIcon,
  MusicNote01Icon,
  PaintBoardIcon,
  Restaurant01Icon,
  Restaurant02Icon,
  RouteIcon,
  SnowIcon,
  SparklesIcon,
  StarIcon,
  Sun03Icon,
  SunsetIcon,
  Tag01Icon,
  TentIcon,
  TheaterIcon,
  Ticket01Icon,
  Tree01Icon,
  Tree06Icon,
  WaterEnergyIcon,
  WorkoutRunIcon,
  ZapIcon,
} from '@hugeicons/core-free-icons';
import type { IconSvgElement } from '@hugeicons/react';

// Curated set of category-relevant icon names. The stored category `icon`
// value is one of these (historically Lucide PascalCase) names - the KEYS are
// a stable DB contract and must never change; the VALUES were remapped to
// Hugeicons equivalents in the 2026-07-17 icon migration. `Turtle` has no
// free-set equivalent and renders the nearest marine-wildlife glyph.
export const CATEGORY_ICON_COMPONENTS: Record<string, IconSvgElement> = {
  Ship: CargoShipIcon,
  Sailboat: BoatIcon,
  Anchor: AnchorIcon,
  Waves: WaterEnergyIcon,
  Fish: FishIcon,
  LifeBuoy: LifebuoyIcon,
  Turtle: CrabIcon,
  Bird: BirdIcon,
  Mountain: MountainIcon,
  MountainSnow: MountainIcon,
  TreePalm: Tree06Icon,
  Trees: Tree01Icon,
  Tent: TentIcon,
  Compass: CompassIcon,
  Map: MapsIcon,
  MapPin: Location01Icon,
  Binoculars: BinocularsIcon,
  Camera: Camera01Icon,
  Footprints: WorkoutRunIcon,
  Bike: Bicycle01Icon,
  Car: Car01Icon,
  Caravan: CaravanIcon,
  Plane: Airplane01Icon,
  Waypoints: RouteIcon,
  Sun: Sun03Icon,
  Sunset: SunsetIcon,
  Droplets: DropletIcon,
  Wind: FastWindIcon,
  Snowflake: SnowIcon,
  Zap: ZapIcon,
  Utensils: Restaurant01Icon,
  UtensilsCrossed: Restaurant02Icon,
  Wine: DrinkIcon,
  Coffee: Coffee01Icon,
  Ticket: Ticket01Icon,
  Sparkles: SparklesIcon,
  Drama: TheaterIcon,
  Music: MusicNote01Icon,
  Palette: PaintBoardIcon,
  GraduationCap: Mortarboard02Icon,
  Flower2: FlowerIcon,
  Gem: DiamondIcon,
  Crown: CrownIcon,
  Star: StarIcon,
  Tag: Tag01Icon,
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
 * Resolve an icon name for a category. Prefers the category's own `icon`
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

/** Resolve the icon data for a category icon name (falls back to Tag). */
export function getCategoryIconComponent(name: string | null | undefined): IconSvgElement {
  return (name && CATEGORY_ICON_COMPONENTS[name]) || CATEGORY_ICON_COMPONENTS.Tag;
}
