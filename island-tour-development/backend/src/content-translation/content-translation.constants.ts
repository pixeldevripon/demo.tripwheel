import { FaqPageType } from '@prisma/client';

/** BullMQ queue name for the content-translation worker. */
export const CONTENT_TRANSLATION_QUEUE = 'content-translation';

/**
 * The Translation-Console entity types this pipeline covers. The hub type
 * includes its Curation/Page-Content surfaces (our-picks, comparison,
 * HubContentSection - blocks matched across locales by (sectionType,
 * displayOrder)). Excluded on purpose (v1): the Pages module (TipTap).
 */
export const CONTENT_ENTITY_TYPES = [
  'tour',
  'destination',
  'hub',
  'category',
  'collection',
  'homepage',
] as const;

export type ContentEntityType = (typeof CONTENT_ENTITY_TYPES)[number];

/**
 * FaqPageType -> entity type, for the FAQ / page-content-section choke points
 * (they know their pageType, not the console's entity vocabulary). `tour` is
 * deliberately absent: tours have NO FAQs (hard house rule) and no sections -
 * the enqueuer ignores unmapped page types.
 */
export const PAGE_TYPE_TO_ENTITY: Partial<
  Record<FaqPageType, ContentEntityType>
> = {
  [FaqPageType.category]: 'category',
  [FaqPageType.hub]: 'hub',
  [FaqPageType.destination]: 'destination',
  [FaqPageType.collection]: 'collection',
  [FaqPageType.homepage]: 'homepage',
};

/** Job payload on CONTENT_TRANSLATION_QUEUE. */
export interface ContentTranslationJobData {
  entityType: ContentEntityType;
  entityId: string;
}

/**
 * Debounce window for background jobs: rapid en-saves during an editing
 * session collapse into ONE delayed job (same jobId while delayed = no-op).
 */
export const ENQUEUE_DELAY_MS = 60_000;
