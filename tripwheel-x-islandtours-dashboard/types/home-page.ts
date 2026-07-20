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
  isMachineTranslated: boolean;
}

/** The admin view: locale-agnostic fields plus every stored locale. */
export interface HomePageContent {
  heroImage: string | null;
  /** Up to three fanned CTA card images, in fan order. */
  editorialImages: string[];
  /** Island the editorial CTA links to; null = let the site resolve it. */
  editorialDestinationId: string | null;
  ogImage: string | null;
  translations: HomePageTranslation[];
}

/** PATCH /home-page - only the named fields are touched; null clears one. */
export interface UpdateHomePagePayload {
  heroImage?: string | null;
  editorialImages?: string[];
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
  displayOrder: number;
  isActive: boolean;
  /**
   * Name of the referenced category/hub. NULL means the target no longer
   * exists - the public site drops such a row silently, so the admin list has
   * to show it or the card just vanishes with no explanation.
   */
  entityName: string | null;
}

export interface CreateFeaturedExperiencePayload {
  entityType: FeaturedEntityType;
  entityId: string;
  destinationId?: string | null;
  videoUrl?: string | null;
  displayOrder?: number;
  isActive?: boolean;
}

export type UpdateFeaturedExperiencePayload =
  Partial<CreateFeaturedExperiencePayload>;
