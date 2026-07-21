/**
 * Homepage content + Top Island Experiences - mirrors the backend DTOs
 * (`src/home-page/dto/home-page.dto.ts`, `src/featured-experiences/dto/`).
 *
 * The homepage is a SINGLETON: there is one row, keyed `default`. Every content
 * field is nullable, and null means the public site keeps its built-in
 * dictionary default - so clearing a field restores the shipped copy rather
 * than blanking the section.
 */

import type { Locale } from '@/types/locale';

/** Per-locale homepage copy. Null on a field = use the bundled default. */
export interface HomePageTranslation {
  locale: Locale;
  heroTitle: string | null;
  heroSubtitle: string | null;
  experiencesTitle: string | null;
  editorialTitleLine1: string | null;
  editorialTitleLine2: string | null;
  editorialBody: string | null;
  editorialCta: string | null;
  faqTitle: string | null;
  faqSubtitle: string | null;
  /**
   * The search-engine listing for `/{locale}/`. It rides on the translation
   * record rather than a page-content record because the homepage singleton has
   * none - the SEO tab edits English here and the Console handles the rest.
   */
  metaTitle: string | null;
  metaDescription: string | null;
  isMachineTranslated: boolean;
}

/**
 * One fanned CTA card, as stored.
 *
 * The caption is NOT here on purpose: it is the linked island's own translated
 * name, so all 7 locales come for free and the card can never disagree with the
 * page it opens. A card with no island keeps the bundled label.
 */
export interface EditorialCard {
  id: string;
  imageUrl: string;
  destinationId: string | null;
  /** Whether the card is clickable. Off = the island is named but not linked. */
  isLink: boolean;
  /** 0, 1, 2 - left, middle, front in fan order. */
  displayOrder: number;
}

/** The admin view: locale-agnostic fields plus every stored locale. */
export interface HomePageContent {
  heroImage: string | null;
  /** Up to three fanned CTA cards, in fan order. */
  editorialCards: EditorialCard[];
  /** Island the editorial CTA links to; null = let the site resolve it. */
  editorialDestinationId: string | null;
  ogImage: string | null;
  translations: HomePageTranslation[];
}

/** One card on the way out. Its slot is its index in the array. */
export interface EditorialCardInput {
  imageUrl: string;
  destinationId?: string | null;
  isLink?: boolean;
}

/** PATCH /home-page - only the named fields are touched; null clears one. */
export interface UpdateHomePagePayload {
  heroImage?: string | null;
  /** WHOLESALE REPLACE of the deck; [] clears it to the bundled photos. */
  editorialCards?: EditorialCardInput[];
  editorialDestinationId?: string | null;
  ogImage?: string | null;
}

/** Copy fields, wrapped exactly like every other translatable entity. */
export type HomePageTranslationFields = Partial<
  Omit<HomePageTranslation, 'locale' | 'isMachineTranslated'>
>;

export interface UpsertHomePageTranslationPayload {
  fields: HomePageTranslationFields;
  isMachineTranslated?: boolean;
}

// ── Top Island Experiences ───────────────────────────────────────────────────

/** Categories and hubs only - a tour is never featured here (master). */
export type FeaturedEntityType = 'CATEGORY' | 'HUB';

export interface FeaturedExperience {
  id: string;
  entityType: FeaturedEntityType;
  entityId: string;
  /** Null = show everywhere. */
  destinationId: string | null;
  videoUrl: string | null;
  /**
   * Card poster override. Null = the card shows `entityImage`. The carousel
   * slot is a portrait crop that neither an entity hero nor an og image fits,
   * which is why a per-card poster exists at all.
   */
  posterUrl: string | null;
  displayOrder: number;
  isActive: boolean;
  /**
   * Name of the referenced category/hub. NULL means the target no longer
   * exists - the public site drops such a row silently, so the admin list has
   * to show it or the card just vanishes with no explanation.
   */
  entityName: string | null;
  /** The target's own photo - what the card falls back to with no poster. */
  entityImage: string | null;
}

export interface CreateFeaturedExperiencePayload {
  entityType: FeaturedEntityType;
  entityId: string;
  destinationId?: string | null;
  videoUrl?: string | null;
  posterUrl?: string | null;
  displayOrder?: number;
  isActive?: boolean;
}

export type UpdateFeaturedExperiencePayload =
  Partial<CreateFeaturedExperiencePayload>;
