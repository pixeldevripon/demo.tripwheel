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
 * It advertises a CATEGORY. The island is not on the card: the whole banner is
 * themed to one island (`editorialDestinationId`), and a card's URL is that
 * island plus this category - so a card can never open a different island from
 * the button beside it.
 *
 * The caption is NOT here on purpose: it is the category's own translated name,
 * so all 7 locales come for free and the card can never disagree with the page
 * it opens. A card with no category keeps the bundled label.
 */
export interface EditorialCard {
  id: string;
  imageUrl: string;
  categoryId: string | null;
  /** The hub this card advertises. At most one of categoryId/hubId is set. */
  hubId: string | null;
  /** Whether the card is clickable. Off = named but not linked. */
  isLink: boolean;
  /** 0, 1, 2 - left, middle, front in fan order. */
  displayOrder: number;
  /**
   * Whether the target page would open on the island the banner points at (a
   * category page needs at least 3 LIVE tours there - master §2.4; a hub must
   * be published, active and belong to that island). False means the public
   * site serves the card WITHOUT its link - shown in the editor rather than
   * left to be discovered on the live site.
   *
   * Named for the older "has any live tour" rule it once was; the wire name is
   * kept so the two repos stay in step. It answers "would this page open".
   */
  hasLiveTours: boolean;
}

/** The admin view: locale-agnostic fields plus every stored locale. */
export interface HomePageContent {
  heroImage: string | null;
  /** Up to three fanned CTA cards, in fan order. */
  editorialCards: EditorialCard[];
  /** Island the editorial CTA links to; null = let the site resolve it. */
  editorialDestinationId: string | null;
  /** The island the cards are gated against - the pinned one, else the fallback. */
  resolvedDestinationSlug: string | null;
  ogImage: string | null;
  translations: HomePageTranslation[];
}

/** One card on the way out. Its slot is its index in the array. */
export interface EditorialCardInput {
  imageUrl: string;
  categoryId?: string | null;
  /** At most one of categoryId/hubId - the backend keeps the category if both. */
  hubId?: string | null;
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

/**
 * A standalone presentation card (founder, 2026-08-04): an admin-typed label
 * + poster + optional video. No category/hub reference, no link - the reel is
 * a mood board, not navigation. The label is a single admin-entered string,
 * not translated across locales.
 */
export interface FeaturedExperience {
  id: string;
  title: string;
  videoUrl: string | null;
  /**
   * Card poster; doubles as the video poster. The public site drops a card
   * with no poster (a grey rectangle is not a card).
   */
  posterUrl: string | null;
  displayOrder: number;
  isActive: boolean;
}

export interface CreateFeaturedExperiencePayload {
  title: string;
  videoUrl?: string | null;
  posterUrl?: string | null;
  displayOrder?: number;
  isActive?: boolean;
}

export type UpdateFeaturedExperiencePayload =
  Partial<CreateFeaturedExperiencePayload>;
