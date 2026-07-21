/**
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │  THE CACHE-TAG CONTRACT - SOURCE OF TRUTH. DUPLICATED ACROSS TWO REPOS.   │
 * │                                                                           │
 * │  This file must stay IDENTICAL in:                                        │
 * │    - the dashboard repo   (tripwheel-x-islandtours-dashboard)  lib/cache-tags.ts
 * │    - the public site repo (island-tours frontend)              lib/cache-tags.ts
 * │                                                                           │
 * │  Same path in both, on purpose: drift is one command to detect.           │
 * │      diff <dashboard-repo>/lib/cache-tags.ts <public-repo>/lib/cache-tags.ts
 * │  Empty output = the contract holds. Any output = read §"WHY" below before  │
 * │  you touch anything else.                                                 │
 * │                                                                           │
 * │  FORMATTING IS PART OF THE CONTRACT. The public repo runs husky +         │
 * │  `eslint --fix` on commit; this repo has no such hook. If a linter ever   │
 * │  reformats ONE copy, `diff` starts reporting noise and stops being a      │
 * │  usable check. Re-sync by COPYING one file over the other - never by      │
 * │  hand-editing one side until they match.                                  │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * WHY THIS FILE EXISTS
 *
 * The dashboard and the public site are separate Next apps with separate caches.
 * A dashboard write cannot invalidate the public site's `'use cache'` entries
 * in-process, so it POSTs the affected tags to the public site's
 * `/api/revalidate`, which busts them there. That splits one vocabulary across
 * two independently-compiled codebases:
 *
 *   PRODUCER (dashboard)   lib/api/cache-revalidation.ts maps a write path -> tags
 *   CONSUMER (public site) lib/api/public/* calls cacheTag(...) with the same names
 *
 * Nothing mechanically aligns them. There is no shared package - and deliberately
 * so: a shared dependency would re-couple the two services that the split exists
 * to separate. So the alignment is this file plus two guards:
 *
 *   1. The public endpoint REJECTS unknown tags with a 400 (whole batch, nothing
 *      revalidated). This is the real enforcement, and it is why drift surfaces
 *      as a loud failure on the first write rather than as pages that are quietly
 *      wrong forever. Without it, renaming a tag on one side would mean the other
 *      keeps POSTing the old name, keeps getting 200, and keeps serving stale
 *      prices - green all the way down.
 *   2. This file being byte-identical, so `diff` is a complete check.
 *
 * HONEST LIMIT: there is NO CI guard, and cannot easily be one - a cross-repo
 * check needs both repos checked out, and the dashboard repo has no CI at all.
 * The 400 is a runtime feedback loop, not a compile-time one. It fires on the
 * first write after a bad deploy, which is fast, but it is not prevention.
 *
 * WHY THE TYPES ARE DERIVED FROM THE ARRAYS
 *
 * Before this file, each repo had HALF the contract in a different shape: the
 * dashboard had a hand-written type union with no runtime list, the public site
 * had a runtime Set with no type. Nothing stopped the two halves disagreeing
 * *within* a single repo. Deriving the types from the arrays means there is one
 * list per concept and the compiler enforces the rest.
 *
 * BOTH REPOS CARRY THE WHOLE FILE even though each mainly uses one half - the
 * dashboard needs the types to build tags, the public site needs the arrays to
 * validate them. Byte-identity is worth more than trimming a few unused exports:
 * the moment the files differ "harmlessly", `diff` stops being a check.
 *
 * TO CHANGE A TAG: edit this file in BOTH repos, in the same change, and ship the
 * public site FIRST (it must accept the new name before the dashboard sends it).
 * See `technical-doc/dashboard-extraction/02B-CACHE-REVALIDATION-SPEC.md` §5.
 */

/**
 * Coarse tags. Busting one regenerates every cached read carrying it - use for
 * aggregates (listings, search, facets) and cross-entity ripple (a tour appears
 * on many pages).
 */
export const COARSE_CACHE_TAGS = [
    'tours',
    'search',
    'hubs',
    'categories',
    'collections',
    'destinations',
    'reviews',
    // Guards the router's slug -> entity resolver.
    'slug-registry',
    // Public SiteInfo (logo, WhatsApp number + flag, Instagram). Read by the
    // footer and every NeedHelp surface, so a Settings > General save has to bust
    // it or the site serves the old number until the cacheLife expires.
    'site-info',
    // Third-party platform reviews (Trustpilot/Google) - homepage testimonials.
    'platform-reviews',
    // The brand Instagram grid (handle row + curated tiles) on destination
    // pages. Deliberately not folded into `site-info`: that tag carries the
    // footer and every NeedHelp surface, and curating one tile should not
    // regenerate all of them.
    //
    // The kill switch (`SiteInfo.enableInstagram`) is stored on site-info but
    // SURFACES here: `/instagram/public/feed` returns it as `enabled`, the single
    // gate the section obeys. So a `/settings/site` write must bust BOTH tags -
    // it did not, which is why toggling the section off left it rendering for a
    // full cacheLife('days'). Following the URL instead of the data is the bug.
    'instagram',
    // Admin-managed homepage content (hero copy/image, editorial CTA, section
    // headings). Coarse rather than granular because there is exactly one
    // homepage - a per-id tag would carry the constant 'default' forever.
    'homepage',
    // Platform-wide list of media URLs flagged `excludeFromIndexing`, read by
    // `getExcludedMediaUrls` to keep them out of og:image, structured data and
    // sitemaps. It used to lean on `cacheLife('hours')` alone ("propagates
    // without a revalidation bridge"), which meant a toggle could sit unapplied
    // for an hour; media-gallery writes now bust it outright.
    'media-indexing',
    // VESTIGIAL, AND KNOWINGLY KEPT. Nothing calls `cacheTag('user-profile')` in
    // either repo: it belonged to the dashboard's `getUserProfile`, which was
    // deliberately moved off `'use cache'` onto React `cache()` (caching a
    // transient auth failure would bounce a logged-in user to /portal). The
    // dashboard still maps `/users/me` and `/settings/*` writes to it, so it
    // still crosses the wire - and busting it has been a no-op since long before
    // the split. Listed so the 400 guard does not reject a harmless legacy tag.
    // Remove from BOTH repos together, or not at all.
    'user-profile',
] as const;

/**
 * Prefixes of per-entity tags (`tour:<uuid>`), so editing ONE entity regenerates
 * only that entity's page rather than every page of its type. The id is the
 * entity UUID, which the dashboard's mutation path already carries.
 *
 * NOT INCLUDED: `slug:<destinationSlug>:<slug>` (public `lib/api/slug-registry.ts`).
 * It has three segments, and the dashboard never emits it - a slug change arrives
 * as the coarse `slug-registry`. Adding it would mean loosening the two-segment
 * rule in `isKnownCacheTag` for a tag no producer sends.
 */
export const GRANULAR_CACHE_TAG_PREFIXES = [
    'tour',
    'destination',
    'hub',
    'category',
    'collection',
    // Operator company name/logo is embedded on the tour detail page (only there,
    // not on cards); an operator edit busts exactly that operator's tour pages
    // without touching every tour.
    'operator',
] as const;

/**
 * Cap on one batch. Generous on purpose - the widest mapping emits 4, so
 * anything near this is a bug, not a workload.
 */
export const MAX_TAGS_PER_BATCH = 32;

export type CoarseCacheTag = (typeof COARSE_CACHE_TAGS)[number];

export type GranularCacheTagPrefix = (typeof GRANULAR_CACHE_TAG_PREFIXES)[number];

/** Distributes to `tour:${string}` | `destination:${string}` | ... */
export type GranularCacheTag = `${GranularCacheTagPrefix}:${string}`;

export type CacheTag = CoarseCacheTag | GranularCacheTag;

const COARSE_LOOKUP: ReadonlySet<string> = new Set(COARSE_CACHE_TAGS);
const GRANULAR_LOOKUP: ReadonlySet<string> = new Set(GRANULAR_CACHE_TAG_PREFIXES);

/**
 * Whether a tag is one this contract allows. The public endpoint's 400 guard is
 * built on this; it is the runtime half of the type above.
 *
 * A tag is valid if it is coarse, or splits on `:` into exactly two non-empty
 * parts whose prefix is granular. `split` takes no limit, so `tour:a:b` yields
 * three parts and is correctly rejected.
 */
export function isKnownCacheTag(tag: string): boolean {
    if (COARSE_LOOKUP.has(tag)) return true;

    const parts = tag.split(':');
    return (
        parts.length === 2 &&
        GRANULAR_LOOKUP.has(parts[0]) &&
        parts[1].length > 0
    );
}
