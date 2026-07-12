## Why

Loading skeletons on the public site are hand-drawn approximations that drift from the real components they stand in for, so the page visibly jumps (layout shift) when data streams in. The clearest symptom: `components/skelitons/tour-card-skeleton.tsx` is an empty file, yet the tour card is the single most-repeated element across Destination Listings, Search, Hub, and Collection pages. Skeletons must be pixel-faithful stand-ins so the streamed content lands in exactly the space its placeholder occupied, with zero shift.

## What Changes

- Author a real `TourCardSkeleton` that exactly mirrors the standard `TourCard` (`DefaultTourCard`): same `@container` behavior, image `aspect-[86/74]` / `@[220px]:aspect-[64/45]`, radii, the same info-block gaps/padding (`pt-3 pb-1` → `@[220px]:pt-4 @[220px]:pb-5`), and the fixed rating-row height (`h-4` / `@[220px]:h-[22px]`) that keeps card heights stable.
- Add a `HubTourCardSkeleton` mirroring `hub-tour-card.tsx`, and a collection card skeleton mirroring the ranked/collection card variant (`RankedTourCard` / `collection-card.tsx`) — each matching its real card's dimensions and spacing exactly.
- Wire each new card skeleton into every place its real card is used as a Suspense/loading fallback (destination listings, search results, hub trips panel, collection tours section), replacing bespoke inline placeholders.
- Break every skeleton currently inlined in a page or component out into its own file under `components/skelitons/`, one file per component it mirrors. Compound page skeletons (`tour-page-skeleton`, `tours-page-skeleton`, `destination-page-skeleton`, `search-page-skeleton`, `entity-page-skeleton`) must compose these per-component skeletons rather than redrawing card markup.
- Establish the rule that a skeleton and its real component share identical layout dimensions — every height, width, gap, padding, radius, and aspect ratio matches at every breakpoint/container width where the real component renders.

## Capabilities

### New Capabilities
- `loading-skeletons`: Defines that every public-site loading placeholder is a dedicated component living in `components/skelitons/`, structurally mirrors the real component it replaces (dimensions, spacing, radii, aspect ratios at every responsive/container breakpoint), and is reused everywhere the real component is streamed so there is no layout shift on hydration.

### Modified Capabilities
<!-- None — no existing OpenSpec specs; this is a new, self-contained capability. -->

## Impact

- **New files** under `frontend/components/skelitons/`: `tour-card-skeleton.tsx` (fill the empty file), `hub-tour-card-skeleton.tsx`, `collection-card-skeleton.tsx`, plus any per-component skeletons extracted from inlined markup.
- **Modified skeletons**: `tour-page-skeleton.tsx`, `tours-page-skeleton.tsx`, `destination-page-skeleton.tsx`, `search-page-skeleton.tsx`, `entity-page-skeleton.tsx` recomposed to reuse the per-component skeletons.
- **Consumers**: `loading.tsx` routes and `<Suspense fallback>` sites under `app/(frontend)/[locale]/**`, plus list components (`tours-listing.tsx`, `collection-tours-section.tsx`, `search/search-results-section.tsx`, `hub-trips-panel.tsx`) that render inline placeholders today.
- **No backend, API, or data-model impact** — this is a frontend-only presentation/layout-stability change.
- **Reference**: the real components in `frontend/components/frontend/` are the source of truth for every dimension; skeletons follow the token/Tailwind rules in `CLAUDE.md` (no inline styles, tokenize colors, px in arbitrary values).
