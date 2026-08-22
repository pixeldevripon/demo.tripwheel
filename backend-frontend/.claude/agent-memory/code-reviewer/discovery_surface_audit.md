---
name: discovery_surface_audit
description: Full-audit findings for the public-site discovery surface (tours listing, search, filters, wishlist) across frontend + backend, 2026-07-29
metadata:
  type: project
---

Full audit of the discovery surface (All Tours / category / hub / collection listing,
global search, filter modal, wishlist) — frontend `components/frontend/tours/*`,
`search/*`, `tour-card.tsx`; backend `search/`, `wishlist/`, `tours/`, `attributes/`,
`slug-registry/`. Not a diff review — read every file in scope.

**Why kept**: several findings are silent policy divergences that won't show up in a
normal diff review because each individual file looks correct in isolation; only
cross-file comparison surfaces them.

## Confirmed real findings (verified via Read/grep, not assumed)

1. **Bookability gate (`status: LIVE, isActive: true, isBookable: true`) is
   inconsistently applied.** `ToursService.findAll`/`search`/`suggest`/`findPublicByIds`
   all apply it (commented "master §7.2 — excluded from every ranked result set").
   Two call sites silently drop `isBookable`:
   - `AttributesService.buildFilters` (`backend/src/attributes/attributes.service.ts`
     ~line 217-223) — the filter-modal facets (price/duration ranges, attribute
     counts) are computed over a wider tour set than the listing actually returns, so
     the modal can offer a filter combination that yields zero results.
   - `WishlistService.resolveByIds` (`backend/src/wishlist/wishlist.service.ts`
     ~line 89-91) — arguably intentional (a saved tour shouldn't vanish from My
     Wishlist just because it's temporarily non-bookable) but undocumented; every
     other call site has a §7.2 comment, this one has none.

2. **Wishlist is two unconnected systems, not one with a merge.** The live product
   is 100% cookie-based (`it.wishlist`, `lib/wishlist-cookie.ts` +
   `wishlist-provider.tsx`, resolved via the `@Public()` `GET /wishlist/resolve`).
   The backend also has a fully-built, session-authenticated, per-user wishlist
   (`GET /wishlist`, `GET /wishlist/ids`, `POST`/`DELETE /wishlist/:tourId`, backed by
   the `Wishlist` Prisma model) — confirmed via repo-wide grep that NOTHING in the
   frontend calls these four routes, and the traveller account area
   (`components/frontend/traveller/`) has no wishlist tab. There is no
   anonymous→authenticated merge anywhere because the authenticated half is simply
   never invoked. Either wire it into the traveller account area or note it as
   deliberately deferred — right now it reads as orphaned backend work.
   Related stale doc: `tour-header-actions.tsx:20` JSDoc says "guests are routed to
   /login by the provider" — the current provider never checks auth or redirects.

3. **DRY: duplicated Prisma OR-clause for tour text search.** `ToursService.search()`
   (`tours.service.ts` ~527-539) and `ToursService.suggest()` (~660-670) hand-maintain
   two near-identical `OR` arrays (name / translations title-overview-description /
   category name / hub name / highlight text). No shared helper; a future field added
   to one will silently miss the other.

4. **God Service**: `ToursService` (~109KB, 30+ public/private methods) bundles
   discovery (search/suggest/findAll/facets-adjacent helpers), full admin CRUD +
   lifecycle workflow (submit/approve/reject/publish/pause/archive/restore), and
   quality-score/demand-signal computation in one class. `SearchController` has no
   service of its own — it's a thin wrapper entirely over `ToursService`. Not urgent
   (nothing is broken), but it's the single biggest SRP debt item in this module.

5. **Frontend grid drift**: `collection-tours-section.tsx:38` renders
   `grid-cols-2 sm:grid-cols-3` (caps at 3 columns on large screens) while its OWN
   comment on line 37 says "2-col mobile, 3-col sm, 4-col lg" and every other tour
   grid on the site (`tours-listing.tsx`, `wishlist-view.tsx`,
   `search-results-section.tsx`, `tour-related-section.tsx`, `hub-trips-panel.tsx`,
   `thank-you-related-tours.tsx`) carries `lg:grid-cols-4`. Concrete, easy fix.

6. **Hardcoded `$` in the price filter**: `tours-filter-modal.tsx` `PriceRange`
   section, lines ~452-453 (`<span>${draft.price[0]}</span>`) — literal dollar sign,
   violates the project's "no hardcoded currency symbols" rule. Every other price
   display in the codebase goes through `resolveDisplayPrice`/`priceDisplay`.

7. **Wishlist heart button duplicated 3x** (not a Figma-driven variant, plain
   copy-paste): the exact toggle-with-stopPropagation/aria-pressed/heart-icon-swap
   block appears in `tour-card.tsx` `DefaultTourCard`, `tour-card.tsx`
   `RankedTourCard`, and `hub/hub-tour-card.tsx`. Candidate for a shared
   `<WishlistHeartButton>` primitive. (`HubTourCard` as a whole is a DELIBERATE
   Figma-distinct card design, documented in its own docblock — do not suggest
   merging it with `TourCard`, only the heart-button sub-piece.)

8. **`ToursFilterBar`** (`tours-filter-bar.tsx`, 738 lines) is a single component
   owning 5 independent pieces of toolbar state (date popover, guest stepper,
   filters-modal trigger, category pills, sort dropdown). Real SRP/long-function
   smell, but low urgency — it's presentational JSX, no logic bugs found in it.

## Confirmed CLEAN / positive (checked, not padded)

- `pagination.tsx` vs `search-pagination.tsx`: NOT duplication — the latter is a
  thin URL-driven wrapper composing the former. Good example of composition over
  duplication; cite as the reference pattern when this comes up again.
- `ToursListingSection` is shared by the All Tours page AND the category page via
  the `lockedCategory` prop — no parallel listing implementation. Filter state is
  isomorphic (`lib/tours/filters.ts`: `parseToursFilters`/`buildToursHref`/
  `filtersToTourQuery`), used identically by server section and client toolbar — the
  URL is genuinely the single source of truth, exactly as it should be.
  `EMPTY_FILTERS`/attribute passthrough correctly survive navigation.
- Backend controllers in scope (`tours.controller.ts`, `attributes.controller.ts`,
  `search.controller.ts`, `slug-registry.service.ts`) are clean, thin, correct static-
  before-dynamic route order, consistent `@Public()`/`@RequirePermissions()`.
  `SlugRegistryService.resolve` is a good small-SRP reference example.
- `FxRatesService.attachMoney` is the one true currency-conversion implementation;
  both `ToursService` and `WishlistService` delegate to it rather than reimplementing
  — no money-formatting drift found.
