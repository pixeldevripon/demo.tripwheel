/**
 * Bridges dashboard mutations to the public site's `'use cache'` layer.
 *
 * Every authenticated dashboard write goes through `apiFetch` (`lib/api/fetch.ts`).
 * After a write succeeds, `apiFetch` calls `revalidatePublicForPath(path, method)`,
 * which maps the endpoint to the cache tags it affects and fires the
 * `revalidateCacheTags` Server Action to bust them - so an edit shows up on the
 * public site instantly instead of waiting out the `cacheLife` window.
 *
 * Granularity (Level A): a mutation busts the specific entity's tag (`tour:<id>`)
 * so only THAT entity's detail/render page regenerates, plus the coarse tags for
 * the aggregates it appears in (listings, search, facets). Detail reads in
 * `lib/api/public/*` are tagged `type:<id>` to match; aggregate/embedding reads
 * keep the coarse tag. The entity id is read straight from the mutation path.
 *
 * Path segments with no mapping (media library, per-user wishlist, read-only
 * slug-registry lookups) trigger no revalidation. Settings is a partial
 * exception: only `/settings/site` backs a public read (see that case).
 */
import { revalidateCacheTags, type CacheTag } from '@/app/_actions/revalidate';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * Lifecycle sub-route verbs (`/entity/:id/<verb>`) that can change whether a slug
 * resolves (publish/archive => page appears/404s). Covers tour lifecycle (POST
 * verbs) and collection status (`PATCH /collections/:id/status`) alike.
 */
const LIFECYCLE_VERBS = new Set(['status', 'publish', 'pause', 'unpause', 'archive', 'restore']);

/**
 * Whether this mutation can create / delete / rename / (de)activate an entity -
 * i.e. change what the router's slug resolver returns. True ONLY for root-entity
 * writes (`POST /entity`, `DELETE|PATCH /entity/:id`) and lifecycle sub-routes
 * (`/entity/:id/<verb>`). Content-only sub-resource writes (page-content,
 * translations, FAQs, images, highlights, ...) do NOT churn the routing cache.
 */
function affectsSlugRegistry(parts: string[], method: string): boolean {
  if (parts.length === 1 && method === 'POST') return true; // POST /entity (create)
  if (parts.length === 2 && (method === 'DELETE' || method === 'PATCH')) return true; // /entity/:id
  if (parts.length === 3 && LIFECYCLE_VERBS.has(parts[2])) return true; // /entity/:id/<verb>
  return false;
}

/**
 * Map a completed mutation (path + method) to the cache tags it invalidates.
 * Returns `[]` for endpoints that back no cached public page.
 */
function tagsForMutation(path: string, method: string): CacheTag[] {
  // Strip any query string / fragment first so a `?locale=…` never leaks into a
  // path segment (which would throw off the length-based rules below), then split.
  const parts = path.split(/[?#]/, 1)[0].replace(/^\/+/, '').split('/').filter(Boolean);
  const [seg0, seg1, seg2] = parts;
  const tags: CacheTag[] = [];
  const slug: CacheTag[] = affectsSlugRegistry(parts, method) ? ['slug-registry'] : [];

  switch (seg0) {
    // A tour appears (with price/rating baked in) on every discovery surface, so
    // its own detail busts `tour:<id>` while listings/search/renders that embed
    // it bust coarse `tours`/`search`. FAQ/translation/page-content sub-routes
    // (`/tours/:id/...`) also carry the id at seg1. This also covers the editorial
    // `PATCH /tours/:id/locals-favourite` toggle: the destination "Locals'
    // favourites" grid (`getDestinationTours`) is tagged `tours`, so it regenerates.
    case 'tours':
      if (seg1 && seg1 !== 'slug') tags.push(`tour:${seg1}`);
      tags.push('tours', 'search', ...slug);
      break;

    // Recurring schedules / date exceptions. No cached public availability read
    // exists (it is fetched dynamically), but date-filtered tour listings cache
    // under `tours`, so bust those. `POST /availability/check` is a READ shaped
    // as a POST (the public date-availability lookup) - revalidating on it loops:
    // bust -> RSC refresh -> new props -> the hub date filter re-fires the check.
    case 'availability':
      if (seg1 === 'check') break;
      tags.push('tours', 'search');
      break;

    // Tier change / spotlight. `/tiers/tours/:tourId/...` carries the tour id;
    // admin spotlight approve/reject (`/tiers/admin/spotlight/:id`) does not.
    case 'tiers':
      if (seg1 === 'tours' && seg2) tags.push(`tour:${seg2}`);
      tags.push('tours', 'search');
      break;

    // Attribute definitions drive tour filters/facets and per-tour attribute
    // display; per-tour attribute values are hit at `/tours/:id/...` (handled
    // above), so this branch is the dictionary itself.
    case 'attributes':
      tags.push('tours', 'search');
      break;

    // Operator company name/logo appear on the tour detail page (tagged
    // `operator:<id>` there) and feed the per-user dashboard profile
    // (getUserProfile reads operator company-info / social-media). `tours`/
    // `search` too, defensively, in case a listing card ever surfaces operator.
    case 'operators':
      if (seg1) tags.push(`operator:${seg1}`);
      tags.push('tours', 'search', 'user-profile');
      break;

    case 'destinations':
      if (seg1) tags.push(`destination:${seg1}`);
      tags.push('destinations', ...slug);
      break;

    case 'categories':
      if (seg1) tags.push(`category:${seg1}`);
      tags.push('categories', ...slug);
      break;

    case 'collections':
      if (seg1) tags.push(`collection:${seg1}`);
      tags.push('collections', ...slug);
      break;

    case 'hubs':
      if (seg1) tags.push(`hub:${seg1}`);
      tags.push('hubs', ...slug);
      break;

    // Review moderation (approve/edit/delete). `getTourReviews` is tagged
    // `reviews` (+ `tour:<id>`), and tour cards carry the rating aggregate via
    // `tours`/`search`, so bust all three. NOTE: the tour DETAIL rating aggregate
    // (`getTourBySlug`, tagged `tour:<id>`) is only refreshed here if the review
    // write is nested under `/tours/:tourId/reviews/...` (handled by the `tours`
    // branch, which pushes `tour:<tourId>`). If reviews get a top-level
    // `/reviews/:id` write path instead, add `tour:<tourId>` busting when the
    // reviews module lands (the write client knows the tourId).
    case 'reviews':
      tags.push('reviews', 'tours', 'search');
      break;

    // Profile edits hit `/users/me` (name/phone/location/timezone); getUserProfile
    // (tag `user-profile`) is the per-user dashboard profile cache. Not public.
    case 'users':
      tags.push('user-profile');
      break;

    // Admin social media (`/settings/social-media`) also feeds getUserProfile;
    // other platform settings are harmless to fold in (cheap per-user regen).
    //
    // On top of that, site/seo/social-media/company writes back public reads on
    // the marketing site (the `settings/public/*` projections: logo + WhatsApp,
    // meta/OG tags, footer social links, footer legal block), all cached under
    // the coarse `site-info` tag with `cacheLife('days')`. SMTP/Stripe/Mollie
    // stay out - no cached public page reads them.
    //
    // Both live in ONE case on purpose: a second `case 'settings'` below this one
    // is unreachable (the first match wins), which is exactly how `site-info` went
    // un-busted for `cacheLife('days')` at a time.
    case 'settings':
      tags.push('user-profile');
      if (
        seg1 === 'site' ||
        seg1 === 'seo' ||
        seg1 === 'social-media' ||
        seg1 === 'company'
      ) {
        tags.push('site-info');
      }
      break;

    default:
      break; // media-gallery, operator-settings, wishlist, read-only lookups, ...
  }

  // De-dupe (e.g. a POST already pushed 'slug-registry' once).
  return [...new Set(tags)];
}

/**
 * Bust the cache tags affected by a just-completed mutation. No-op for GETs and
 * for endpoints that back no cached public page. Fire-and-forget: a revalidation
 * hiccup must never fail or slow down the write the user just made.
 */
export function revalidatePublicForPath(path: string, method?: string): void {
  const verb = (method ?? 'GET').toUpperCase();
  if (!MUTATING_METHODS.has(verb)) return;

  const tags = tagsForMutation(path, verb);
  if (!tags.length) return;

  void revalidateCacheTags(tags).catch(() => {
    // Swallow: the mutation already succeeded; stale cache self-heals on the
    // next cacheLife window even if this RPC fails.
  });
}
