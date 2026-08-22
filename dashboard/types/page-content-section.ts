import type { Locale } from '@/types/locale';

// Shared page-content-section types. A logical section is one sectionGroupId whose
// per-locale rows are translations of each other; the English row is the base and
// carries the group-level attributes (displayOrder, isActive, sectionKey).
// Same shape as the grouped-FAQ types next door.

export interface PageContentSectionTranslation {
  id: string;
  heading: string;
  body: string;
  locale: Locale;
}

export interface PageContentSectionGroup {
  sectionGroupId: string;
  /**
   * Stable editorial slug on seeded sections, null on admin-created ones. Read
   * only - the dashboard never sets it; the seed uses it to re-upsert its own
   * rows and the public site to map a section back to the bundled label it
   * replaced.
   */
  sectionKey: string | null;
  displayOrder: number;
  isActive: boolean;
  translations: PageContentSectionTranslation[];
}

export interface CreatePageContentSectionPayload {
  heading: string;
  body: string;
  displayOrder?: number;
}

export interface UpdatePageContentSectionPayload {
  displayOrder?: number;
  isActive?: boolean;
}

export interface UpsertPageContentSectionTranslationPayload {
  heading: string;
  body: string;
}
