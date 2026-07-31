import type { FaqPageType } from '@prisma/client';
import {
  PAGE_TYPE_TO_ENTITY,
  type ContentEntityType,
} from './content-translation.constants';

/**
 * The `TranslationUnit.key` vocabulary, in one place.
 *
 * A unit key names "one translatable row per locale": the entity's main copy,
 * its About/SEO page content, one FAQ group, one hub our-pick, one tour
 * highlight. `EntityRegistry` stamps these onto the units it collects, and the
 * Translation Console's clear endpoints write the SAME string into
 * `translation_clear_marks`. If the two ever disagreed, a clear would silently
 * stop suppressing re-translation - so neither side builds keys by hand.
 *
 * Keys are also used as the JSON prefix in a provider payload
 * (`"<unitKey>.<field>"`), which is why no part of a key contains a dot.
 */
export const translationUnitKeys = {
  /** The entity's own translation row (tour/category/destination/hub/...). */
  main: (): string => 'main',
  /** The About/SEO page-content record. */
  pageContent: (): string => 'pc',

  faq: (groupId: string): string => `faq:${groupId}`,
  section: (groupId: string): string => `section:${groupId}`,
  /** A collection's per-tour "why we picked this" note. */
  rationale: (collectionTourId: string): string =>
    `rationale:${collectionTourId}`,

  highlight: (id: string): string => `highlight:${id}`,
  inclusion: (id: string): string => `inclusion:${id}`,
  exclusion: (id: string): string => `exclusion:${id}`,
  feature: (id: string): string => `feature:${id}`,
  location: (id: string): string => `location:${id}`,
  pickup: (id: string): string => `pickup:${id}`,

  ourPick: (id: string): string => `ourpick:${id}`,
  comparisonGroup: (id: string): string => `compgroup:${id}`,
  comparisonTour: (id: string): string => `comptour:${id}`,
  /**
   * HubContentSection has no FK group key - a block's identity across locales
   * is (sectionType, displayOrder), the same pair the dashboard editor groups
   * by and the route exposes as path params.
   */
  hubSection: (sectionType: string, displayOrder: number): string =>
    `hubsection:${sectionType}:${displayOrder}`,
  /**
   * One media-library asset. Unlike every other key, a single `media` job
   * carries MANY of these - a bucket of up to MEDIA_BUCKET_SIZE assets shares
   * one provider call per locale, which is what makes a library of thousands
   * affordable.
   */
  media: (mediaId: string): string => `media:${mediaId}`,
} as const;

/**
 * Entity type for a pageType-shaped caller (the shared FAQ / section services
 * know their `FaqPageType`, not the console's entity vocabulary). Undefined
 * for `tour` - tours have no FAQs and no sections, so nothing to mark.
 */
export function entityTypeForPageType(
  pageType: FaqPageType,
): ContentEntityType | undefined {
  return PAGE_TYPE_TO_ENTITY[pageType];
}
