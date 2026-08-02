import type { Locale } from '@/types/locale';

/**
 * The Pages system (WordPress-like permalinks: the legal/policy pages today,
 * marketing pages later). Shapes mirror backend `src/pages/dto/pages.dto.ts`.
 */

export type PageStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export const PAGE_STATUS_VALUES: PageStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

export const PAGE_STATUS_LABELS: Record<PageStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

/** One row in the Pages list. */
export interface PageListItem {
  id: string;
  slug: string;
  status: PageStatus;
  publishedAt: string | null;
  updatedAt: string;
  /** The English title (base locale), for the list column. */
  title: string | null;
}

/**
 * A row in the Pages TABLE, which is the page list plus the homepage.
 *
 * The homepage is a singleton owned by its own backend module (`/home-page`),
 * not a `pages` record - it has no id, no permalink of its own, and cannot be
 * created or destroyed. It is still one of the site's pages to the person
 * editing it, so it rides along as a synthetic first row rather than getting a
 * second top-level nav item.
 *
 * `updatedAt` is nullable here only because of that row: the `/home-page`
 * payload carries no timestamp, so the column renders a dash instead of a
 * fabricated date.
 */
export interface PagesTableRow extends Omit<PageListItem, 'updatedAt'> {
  updatedAt: string | null;
  /** True for the pinned homepage row - it is edited and viewed, never published or deleted. */
  isHomepage?: boolean;
}

/** Sentinel row id for the homepage; never a real `pages.id`. */
export const HOMEPAGE_ROW_ID = '__homepage__';

/** One locale's stored content. */
export interface PageTranslationEntry {
  locale: Locale;
  title: string;
  /** Sanitized HTML - the backend sanitizes on every write. */
  body: string;
  metaTitle: string | null;
  metaDescription: string | null;
  isMachineTranslated: boolean;
  updatedAt: string;
}

/** The full admin view: base row plus every stored locale. */
export interface PageDetail {
  id: string;
  slug: string;
  status: PageStatus;
  publishedAt: string | null;
  ogImage: string | null;
  createdAt: string;
  updatedAt: string;
  translations: PageTranslationEntry[];
  /** Old permalinks that 301 to this page. */
  redirectFromSlugs: string[];
}

export interface CreatePagePayload {
  title: string;
  slug?: string;
  body?: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  ogImage?: string | null;
}

export interface UpdatePagePayload {
  /** Renaming a PUBLISHED page automatically 301s the old permalink. */
  slug?: string;
  ogImage?: string | null;
}

export interface UpsertPageTranslationPayload {
  fields: {
    title?: string;
    body?: string;
    metaTitle?: string | null;
    metaDescription?: string | null;
  };
  isMachineTranslated?: boolean;
}
