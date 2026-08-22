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
  // Island Tours' post-booking recommendations (thank-you page / email promo).
  // Only EXTERNAL recommendations carry copy; internal ones follow their entity.
  'recommendation',
  // Media library copy (alt text / title / description). The ONE type whose
  // entityId is not a single entity: it is either a media uuid (the manual
  // per-asset button) or a `bucket:<hex>` key standing for up to
  // MEDIA_BUCKET_SIZE assets. See `mediaBucketOf`.
  'media',
] as const;

export type ContentEntityType = (typeof CONTENT_ENTITY_TYPES)[number];

/**
 * How many assets one `media` job translates.
 *
 * THIS IS THE WHOLE REASON MEDIA IS BATCHED. `ContentTranslationService` issues
 * exactly ONE provider call per locale per entity, no matter how many units the
 * entity has. Per-asset jobs would therefore cost 6 calls each - 1,000 assets =
 * 6,000 calls, which is dead on arrival against a ~1k requests/day free tier.
 * Fifty assets per job turns that into ~120 calls for the same 1,000 assets.
 *
 * Fifty is safe on payload size too: three short fields per asset is roughly 2k
 * tokens, nowhere near a context limit.
 */
export const MEDIA_BUCKET_SIZE = 50;

/** Prefix marking an entityId as a media bucket rather than a media uuid. */
export const MEDIA_BUCKET_PREFIX = 'bucket:';

/**
 * The bucket an asset belongs to: the first hex character of its uuid, giving 16
 * stable buckets.
 *
 * Stable is the point. Every metadata save enqueues its asset's bucket, and the
 * queue de-duplicates on `jobId = '<type>:<entityId>'` - so a burst of edits
 * across a bucket collapses into ONE job instead of one per asset, and the
 * bucket an asset maps to never changes as the library grows.
 */
export function mediaBucketOf(mediaId: string): string {
  return `${MEDIA_BUCKET_PREFIX}${mediaId.slice(0, 1)}`;
}

/**
 * Every media bucket, for the nightly sweep. A uuid's first character is one hex
 * digit, so the whole library is covered by these 16 keys.
 */
export const MEDIA_BUCKET_KEYS: string[] = [...'0123456789abcdef'].map(
  (c) => `${MEDIA_BUCKET_PREFIX}${c}`,
);

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
