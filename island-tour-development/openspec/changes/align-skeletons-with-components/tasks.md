## 1. Shared skeleton primitives

- [ ] 1.1 Add a shared shimmer atom `components/skelitons/skeleton-bar.tsx` exporting `Bar` (`animate-pulse rounded-md bg-it-heading/10`, accepts `className`), replacing the per-file `Bar` definitions incrementally.
- [ ] 1.2 Define the canonical card-grid class strings once (constants or a `CardGridSkeleton` wrapper) for: tours/collection/related grid (`grid grid-cols-2 gap-x-4 gap-y-4 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-3`), search grid (`grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-10`), and hub grid (`grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-10`).

## 2. Card skeletons (exact mirrors)

- [ ] 2.1 Fill `components/skelitons/tour-card-skeleton.tsx` with `TourCardSkeleton` mirroring `DefaultTourCard`: root `@container flex flex-col rounded-[16px] @[220px]:rounded-[24px] overflow-hidden`; image `aspect-[86/74] w-full @[220px]:aspect-[64/45] rounded-[16px] @[220px]:rounded-[24px]`; info `flex flex-col gap-1 pt-3 pb-1 @[220px]:gap-3 @[220px]:pt-4 @[220px]:pb-5` with a fixed rating row `h-4 @[220px]:h-[22px]`, a 2-line title block, duration row, price row, and cancellation line as shimmer bars. No hover arrows/dots/padding.
- [ ] 2.2 Add `components/skelitons/collection-tour-card-skeleton.tsx` (`CollectionTourCardSkeleton`) mirroring `RankedTourCard`: root `@container flex flex-col gap-3 overflow-hidden rounded-[16px] pb-3 @[220px]:gap-4 @[220px]:rounded-[24px] @[220px]:pb-4` on surface `bg-[#f8f8f8]`; image `aspect-[384/270] w-full` + numbered-badge placeholder; info `flex flex-col gap-2 px-2.5 @[220px]:gap-3 @[220px]:px-4`.
- [ ] 2.3 Add `components/skelitons/hub-tour-card-skeleton.tsx` (`HubTourCardSkeleton`) mirroring `HubTourCard`: root `flex flex-col overflow-hidden rounded-[8px] md:rounded-[16px]`; image `aspect-177/148 rounded-[8px] md:aspect-384/270 md:rounded-[16px]`; content `flex flex-col gap-1.5 pt-2 md:gap-3 md:pt-4` (rating, title, attribute tags, price, cancellation bars). Uses `md:` variants, not `@container`.
- [ ] 2.4 Add `components/skelitons/collection-card-skeleton.tsx` (`CollectionCardSkeleton`) mirroring `CollectionCard`: same image + wrapper box as 2.1, but info block = invisible-spacer row (`h-4 @[220px]:h-[22px]`), a 2-line title, and an "explore" indicator bar (no price/duration rows).
- [ ] 2.5 Visually diff each card skeleton against its real card at a compact cell (<220px / mobile) and a wide cell (grid/desktop); confirm identical wrapper radius, image aspect, gaps, paddings, and rating-row height at both.

## 3. Wire card skeletons into every streamed usage

- [ ] 3.1 Replace the generic card bars in `SearchResultsSkeleton` (`search-page-skeleton.tsx`) with `TourCardSkeleton` inside the search grid (task 1.2), keeping the count bar; matches `search/search-results-section.tsx`.
- [ ] 3.2 Replace the generic card bars in `ToursGridSkeleton`/`ToursListingSkeleton` (`tours-page-skeleton.tsx`) with `TourCardSkeleton` in the tours grid; matches `tours-listing.tsx`. This also covers `category-page.tsx` (reuses `ToursListingSkeleton`).
- [ ] 3.3 Replace the generic card bars in `TourRelatedSkeleton` (`tour-page-skeleton.tsx`) with `TourCardSkeleton` in the tours grid; matches `tour-related-tours.tsx`.
- [ ] 3.4 Replace the generic card bars in `EntityPageSkeleton` (`entity-page-skeleton.tsx`) with `TourCardSkeleton` in the tours grid.
- [ ] 3.5 Extract the inline `HubTripsSkeleton` from `hub-page.tsx` into `components/skelitons/hub-trips-panel-skeleton.tsx`, rebuild it from `HubTourCardSkeleton` in the real hub grid (task 1.2), and import it back into `hub-page.tsx` (remove the local definition + wrong `grid-cols-1 ... rounded-it-lg` grid).
- [ ] 3.6 Confirm collection streaming: ensure the collection tours section (`collection-tours-section.tsx`) has a fallback that renders `CollectionTourCardSkeleton` in the collection grid; add the Suspense/skeleton wiring if missing.

## 4. Destination page skeletons

- [ ] 4.1 Inspect the real `DestinationLocalFavourites` and `DestinationCollectionsSection` layouts; split `DestinationListingsSkeleton` (`destination-page-skeleton.tsx`) if the two sections differ, so the tour-section fallback uses `TourCardSkeleton` and the collections-section fallback uses `CollectionCardSkeleton`.
- [ ] 4.2 Mirror the real destination rail/grid exactly (mobile swipe-rail widths `w-[82vw]`/`min-[480px]:w-[64vw]`/`sm:w-[42vw]` → `lg:grid lg:grid-cols-3 lg:gap-x-6 lg:gap-y-10`) using the card skeletons; update the `page.tsx` Suspense fallbacks at lines ~80 and ~90 accordingly.

## 5. Compound page skeletons compose per-component skeletons

- [ ] 5.1 Audit `tours-page-skeleton.tsx`, `tour-page-skeleton.tsx`, `destination-page-skeleton.tsx`, `search-page-skeleton.tsx`, `entity-page-skeleton.tsx` and confirm no hand-copied card markup remains — every card grid renders a shared card skeleton in the real grid.
- [ ] 5.2 Grep the repo for remaining inlined `animate-pulse` / `aspect-4/3` card placeholders in `app/` and `components/frontend/`; move any survivor into a dedicated file under `components/skelitons/`.

## 6. Verification

- [ ] 6.1 Run the app and, on each route (`/[locale]/[destination]`, `/tours`, `/[slug]`, `/search`, a hub page, a collection page), throttle/observe the stream-in and confirm no layout shift when cards replace their skeleton (positions, heights, radii identical).
- [ ] 6.2 Verify `pnpm lint`/typecheck pass and that `tour-card-skeleton.tsx` is no longer empty and is imported where the tour card streams.
- [ ] 6.3 Update `technical-doc/MASTER-CHECKLIST.md` if it tracks skeleton/loading UI, and confirm all skeleton files live under `components/skelitons/` with one file per mirrored component.
