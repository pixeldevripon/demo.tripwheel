---
name: project_full_seo_audit_2026-07-29
description: Confirmed, unresolved findings from the 2026-07-29 full SEO audit of the core journey (destination/category/hub/collection/tour + sitemap/robots) - use as the starting point for any follow-up SEO fix task.
metadata:
  type: project
---

Full-site SEO audit run 2026-07-29 against a live dev server (localhost:3000) covering
`[locale]/page.tsx`, `[destination]/page.tsx`, `[slug]/page.tsx` (category/hub/collection/tour
dispatch), `[destination]/tours/page.tsx`, `[...path]/page.tsx`, and all private routes. Findings
below are code + curl verified, not theoretical. A fix task should re-verify against the dev
server before closing any item (some may have shifted).

## Open Critical
1. **Soft-404 confirmed live.** `destination/page.tsx`, `[slug]/page.tsx` (EntityDispatch ->
   Category/Hub/Collection/Tour), and their child components (`category-page.tsx`,
   `hub-page.tsx`, `collection-page.tsx`, `tour-detail-content.tsx`) all call `notFound()` from
   INSIDE the async component wrapped by the route's own `<Suspense>` shell. Confirmed via
   `curl -sI`: a nonexistent destination and a nonexistent tour slug both return `HTTP 200` with
   `x-nextjs-prerender: 1` and a not-found body. `tours/page.tsx` and `[...path]/page.tsx` do NOT
   have this bug (their `notFound()` calls run before any Suspense boundary) - use them as the
   reference pattern for the fix (resolve the entity/notFound check in the sync route shell,
   before returning `<Suspense>`, and only stream the parts that can't 404).
2. **Category gating threshold: code gates at ≥1 published tour, master doc says ≥3.**
   `backend/src/categories/categories.service.ts:299` throws 404 only at `publishedTourCount === 0`.
   This is a PRE-EXISTING, already-tracked conflict (`technical-doc/MASTER-CHECKLIST.md:1652`,
   `APPLICATION-FEATURES-AND-TASKS.md:603`), not new - but it is a live SEO defect (thin 1-2-tour
   category pages are indexable) and was re-confirmed here via `sitemap.service.ts` (which mirrors
   the ≥1 gate) and the categories service. Do not silently "fix" one side - the master doc calls
   the resolution direction ≥3, and any change must touch the category service AND the homepage
   featured-card gate in the same commit (they're deliberately mirrored today).

## Open High
3. **Every `DefaultTourCard` image is `priority` unconditionally.** `components/frontend/tour-card.tsx:218`
   passes bare `priority` to `TourCardCarousel` on every render - not gated by grid position. The
   component's own prop doc says "Mark the first image as LCP-priority (above-fold carousels)",
   i.e. it was meant to be conditional. Confirmed via curl on `/en/curacao/tours`: 6+ simultaneous
   `<link rel=preload as=image>` tags for card images (plus the destination/tour hero), all
   competing for bandwidth with the true LCP element. Affects All Tours, category grids, home
   carousels, search results, related-tours - everywhere `DefaultTourCard` (not `RankedTourCard`,
   which correctly omits `priority`) is used. Fix: thread an `index`/`isAboveFold` prop through and
   only pass `priority` for the first row (or first N cards).
4. **Pagination on the tours grid is JS-only.** `components/frontend/pagination.tsx` renders
   `<button onClick>` for every page number - no `href`, no real `<a>`. Page 2+ of All Tours /
   category listings is reachable only via client JS (`components/frontend/tours/tours-listing.tsx`
   `goToPage` -> `router.push`). Mitigated in practice because `app/sitemap.ts` /
   `backend/src/sitemap/sitemap.service.ts` enumerate every LIVE tour directly (not via pagination
   crawl), so tours aren't orphaned - but internal link equity doesn't flow past page 1 and a
   crawler without the sitemap can't reach deeper pages.

## Open Medium
5. **Twitter Card metadata never reflects page content.** Verified via curl: a tour page's
   `og:title`/`og:description` are correctly per-tour, but `twitter:title`/`twitter:description`
   render the sitewide generic values from `app/layout.tsx`'s `generateMetadata`. Cause: every
   page-level `generateMetadata` (tour/category/hub/collection/destination in
   `[slug]/page.tsx`, `[destination]/page.tsx`) sets `openGraph` but never sets a `twitter` key, and
   Next's metadata merge takes the whole `twitter` branch from the nearest ancestor that DOES set
   it (root layout) rather than deriving twitter title/description from that page's own title.
6. **`robots.txt` DISALLOW list omits `/*/traveller`.** `app/robots.txt/route.ts:18-29` blocks
   checkout/thank-you/cancel/review/bookings/wishlist/search/manage-cookies/account/api but not
   traveller, even though `/en/traveller` correctly serves `noindex,nofollow` in its meta tag (so
   the page won't be indexed either way - this is a crawl-budget/consistency gap, not an indexing
   risk).

## Correct as built (do not "fix")
- Canonical/hreflang (7 locales + x-default, reciprocal, self-referencing) verified live and
  correct on every indexable route type, sourced from the admin `canonicalUrl` setting via
  `lib/seo/site-url.ts` (hardcoded `FALLBACK_SITE_URL` is a last-resort only, never the primary
  source - this is compliant with the "not an env var" rule).
- Faceted nav (filters/sort/page on All Tours + category) canonicalizes to the bare path - no
  noindex needed in addition, matches Google's accepted pattern.
- Tour review Product/AggregateRating gating (`lib/seo/tour-review-jsonld.ts`) correctly requires
  `ratingSource==='tour'` + ≥3 own reviews + only visible (non-empty-body) reviews - no fabricated
  ratings.
- `<html lang>` is hardcoded `en` in the root layout and corrected client-side by
  `html-lang-sync.tsx` for non-English locales - this is a DELIBERATE, documented tradeoff (root
  layout sits above `[locale]`); hreflang (fully server-rendered) is what actually carries the
  localization signal to search engines, so this is informational only, not a defect to chase.
