## Context

The public site streams data behind Suspense/`loading.tsx` boundaries, showing skeletons first. Today those skeletons are generic: every card placeholder is `flex flex-col gap-3` › `Bar.aspect-4/3 w-full rounded-xl` + two text bars (`h-4 w-3/4`, `h-4 w-1/2`), regardless of which card it stands in for. The real cards use different aspect ratios, radii, and a `@container`-responsive info block:

- `DefaultTourCard` & `CollectionCard`: image `aspect-[86/74]` → `@[220px]:aspect-[64/45]`, wrapper `rounded-[16px]` → `@[220px]:rounded-[24px]`, info `gap-1 pt-3 pb-1` → `@[220px]:gap-3 @[220px]:pt-4 @[220px]:pb-5`, fixed rating row `h-4` → `@[220px]:h-[22px]`.
- `RankedTourCard` (the collection tour card, rendered by `collection-tours-section.tsx`): surface `#f8f8f8`, image `aspect-[384/270]`, wrapper `gap-3 rounded-[16px] pb-3` → `@[220px]:gap-4 @[220px]:rounded-[24px] @[220px]:pb-4`, info `gap-2 px-2.5` → `@[220px]:gap-3 @[220px]:px-4`.
- `HubTourCard`: no `@container` (uses `md:`), image `aspect-177/148 rounded-[8px]` → `md:aspect-384/270 md:rounded-[16px]`, content `gap-1.5 pt-2` → `md:gap-3 md:pt-4`.

Because the placeholder box differs from the real box, content reflows on hydration. `components/skelitons/tour-card-skeleton.tsx` is a 0-byte stub. One skeleton (`HubTripsSkeleton`) is defined inline in `hub-page.tsx` and even uses a different grid than the real `HubTripsPanel` (`grid-cols-1 gap-6 sm:grid-cols-2` vs. the real `grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-10`).

Constraint (`CLAUDE.md`): Tailwind classes only (no inline `style`), tokenize colors via `--it-*`, `px` in arbitrary values, reuse `it-section`/`it-container`. Skeletons already follow the `animate-pulse rounded-md bg-it-heading/10` `Bar` convention.

## Goals / Non-Goals

**Goals:**
- Dedicated, pixel-faithful skeletons for the three named cards: `TourCard` (default), the collection tour card (`RankedTourCard`), and `HubTourCard` — each mirroring the real card's box, radii, aspect ratio, gaps, paddings, and fixed-height rows at every breakpoint/container width.
- Every place a card streams uses that card's skeleton, in the identical grid, so there is zero layout shift.
- Every skeleton lives in `components/skelitons/`, one file per mirrored component; no inlined placeholder markup remains in pages/components.
- Compound page skeletons (`tours-page`, `tour-page`, `destination-page`, `search-page`, `entity-page`) compose the per-component card skeletons instead of re-drawing card markup.

**Non-Goals:**
- No change to the real card components' markup or behavior (they are the source of truth).
- No backend/API/data changes.
- No redesign of the dashboard/profile/onboarding skeletons (already dedicated files, not tour-card based) beyond leaving them intact.
- Not adding an internal loading branch inside the card components — loading stays external.

## Decisions

### 1. One skeleton file per card, sharing small primitives
Create `tour-card-skeleton.tsx` (fill the empty stub), `hub-tour-card-skeleton.tsx`, and `collection-tour-card-skeleton.tsx` (the ranked/collection variant). Also add `collection-card-skeleton.tsx` for the collection grid card, since `CollectionCard`'s box differs from a tour card and it is currently stood in by a generic placeholder.
- **Why per-card, not one shared skeleton:** although `DefaultTourCard` and `CollectionCard` share the image box, their info blocks differ in height (rating+title+duration+price+cancellation vs. spacer+title+explore-link), and the ranked and hub cards differ entirely. A single "one size" skeleton is exactly the current bug.
- **DRY:** keep the existing `Bar` shimmer (`animate-pulse rounded-md bg-it-heading/10`) as the shared atom; optionally extract it to a `skeleton-bar.tsx` primitive so all card skeletons import one shimmer instead of redefining `Bar`. Alternative (rejected): a single mega-skeleton with props — too much conditional layout, drifts from the real cards.

### 2. Mirror the `@container` system, not the viewport
The tour/collection card skeletons MUST put `@container` on their root and use the same `@[220px]:` variants the real cards use, because the real cards switch on their own container width (compact carousel cell vs. wide grid cell), not the viewport. The hub card skeleton uses `md:` variants to match `HubTourCard`. Copy the exact arbitrary values (`aspect-[86/74]`, `aspect-[64/45]`, `aspect-[384/270]`, `aspect-177/148`, `aspect-384/270`, `rounded-[16px]`, `rounded-[24px]`, `rounded-[8px]`, `h-[22px]`) rather than approximating.

### 3. Render hover/rest state only
The real cards animate padding (0→16px), border-radius, and reveal carousel arrows/dots on hover via framer-motion. At rest those are the base values. Skeletons render the **rest** state (no horizontal info padding, full-radius image, no arrows/dots) and use no motion library — only `animate-pulse`. This is what occupies layout when the skeleton is on screen.

### 4. Grid skeletons reuse the real grid + card skeleton
Each list has a canonical grid; the skeleton renders N card skeletons inside the identical container:
- All-Tours (`tours-listing`) & collection & related: `grid grid-cols-2 gap-x-4 gap-y-4 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-3`.
- Search (`search-results-section`): `grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-10` (note `gap-y-8` on mobile).
- Hub (`hub-trips-panel`): `grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-10`.
Define each grid once (a `CardGridSkeleton`-style wrapper or a shared const per list) so the skeleton can never drift from the live grid.

### 5. Extract the inline `HubTripsSkeleton`
Move `HubTripsSkeleton` out of `hub-page.tsx` into `components/skelitons/hub-trips-panel-skeleton.tsx`, rebuild it from `HubTourCardSkeleton` in the real hub grid, and import it back into `hub-page.tsx`. This both fixes the wrong grid and satisfies the "no inlined skeletons" rule.

### 6. Recompose compound page skeletons
`ToursGridSkeleton`, `TourRelatedSkeleton`, `EntityPageSkeleton`, `SearchResultsSkeleton`, and the destination listings skeleton stop drawing `aspect-4/3` bars and instead render the appropriate card skeleton in the appropriate grid. The surrounding page chrome (breadcrumb, header, toolbar, trust strip) stays as-is where it already mirrors the page; only the card-grid portions are swapped to the shared card skeletons.

## Risks / Trade-offs

- **[`@container` context missing]** → The card skeletons rely on being placed inside a grid cell that establishes container width (the real cards do too). Keep `@container` on the skeleton root exactly as on the card; verify inside each grid that the `@[220px]` breakpoint fires at the same cell width.
- **[Destination page rail vs. grid]** → `DestinationListingsSkeleton` uses a mobile swipe-rail (`flex gap-4 overflow-hidden` → `lg:grid`). The real `DestinationLocalFavourites` / `DestinationCollectionsSection` layout must be confirmed and mirrored (rail widths `w-[82vw]` etc.) rather than assumed; the same skeleton currently backs both a tour-card section and a collection-card section, so it may need to split.
- **[Height drift from dynamic content]** → Real cards have variable text (title `line-clamp-2`, optional cancellation line). Skeletons render the maximal at-rest structure (fixed rating-row height + 2-line title + all rows) so the placeholder is never shorter than the shortest real card; minor within-grid height variance is inherent to `line-clamp` content and acceptable (rows align because gaps/paddings match).
- **[Regression risk across many files]** → Broad but mechanical. Mitigate by landing card skeletons first, then swapping consumers one page at a time, verifying each route visually.

## Migration Plan

1. Add the shared shimmer primitive (or keep per-file `Bar`) + the four card skeletons.
2. Swap `tours-listing`/collection/search/hub grids' fallbacks to the new card skeletons in the real grids.
3. Recompose the compound page skeletons (`tours-page`, `tour-page`, `entity-page`, `search-page`, `destination-page`).
4. Extract `HubTripsSkeleton` → `hub-trips-panel-skeleton.tsx`.
5. Verify each route (`/[destination]`, `/[destination]/tours`, `/[destination]/[slug]`, `/search`, hub, collection) for zero layout shift on stream-in.
Rollback is per-file (revert the swapped import); no data or schema migration.

## Open Questions

- Should `collection-card.tsx` (the collection **grid** card) get its own skeleton in this change, or is the scope strictly the three "tour card" skeletons the user named? (Leaning: include it, since its box differs and it is currently mocked generically.)
- Extract the shimmer `Bar` into a single `skeleton-bar.tsx` primitive, or leave the per-file `Bar` convention as-is? (Leaning: extract, to guarantee one shimmer definition.)
