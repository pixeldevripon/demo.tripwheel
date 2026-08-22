## ADDED Requirements

### Requirement: Card skeletons mirror their real card exactly

Each tour/collection card component SHALL have a dedicated skeleton whose outer container and internal layout match the real card's dimensions at every responsive and `@container` breakpoint. The skeleton MUST reproduce, identically: the root wrapper radius, the image aspect ratio, every gap, every padding value, the fixed rating-row height, and any invisible spacers that the real card uses to keep its height stable. The skeleton MUST NOT render hover-only affordances (carousel arrows, pagination dots, hover insets) since those do not occupy layout space at rest.

The following pairings SHALL exist and match:
- `TourCardSkeleton` mirrors the standard `TourCard` / `DefaultTourCard` (`components/frontend/tour-card.tsx`): image `aspect-[86/74]` → `@[220px]:aspect-[64/45]`, wrapper `rounded-[16px]` → `@[220px]:rounded-[24px]`, info block `gap-1 pt-3 pb-1` → `@[220px]:gap-3 @[220px]:pt-4 @[220px]:pb-5`, rating row `h-4` → `@[220px]:h-[22px]`.
- `HubTourCardSkeleton` mirrors `HubTourCard` (`components/frontend/hub-tour-card.tsx`): image `aspect-177/148` → `md:aspect-384/270`, wrapper `rounded-[8px]` → `md:rounded-[16px]`, content `gap-1.5 pt-2` → `md:gap-3 md:pt-4`.
- The collection tour-card skeleton mirrors the ranked collection card (`RankedTourCard` in `tour-card.tsx`, rendered by `collection-tours-section.tsx`): surface `bg-[#f8f8f8]`, image `aspect-[384/270]`, wrapper `gap-3 rounded-[16px] pb-3` → `@[220px]:gap-4 @[220px]:rounded-[24px] @[220px]:pb-4`, info `gap-2 px-2.5` → `@[220px]:gap-3 @[220px]:px-4`.

#### Scenario: Streamed card lands with zero layout shift
- **WHEN** a page renders a card skeleton and the real card data then streams in
- **THEN** the real card occupies the exact box (width, height, position) the skeleton occupied, producing no cumulative layout shift

#### Scenario: Dimensions match at every breakpoint
- **WHEN** the viewport or container width crosses any breakpoint at which the real card changes size (`@[220px]`, `md`)
- **THEN** the skeleton changes to the same dimensions, radii, gaps, and paddings as the real card at that width

### Requirement: Every skeleton is a dedicated component in the skelitons folder

Every loading placeholder used on a page or inside a component SHALL live as its own file under `frontend/components/skelitons/`, one file per component or section it mirrors. Pages and components MUST NOT contain inlined skeleton/`animate-pulse` placeholder markup for a card or section that has (or should have) a dedicated skeleton file.

#### Scenario: No inlined placeholder markup
- **WHEN** a page or list component needs a loading placeholder for a card or section
- **THEN** it imports and renders the dedicated skeleton from `components/skelitons/` rather than drawing placeholder markup inline

#### Scenario: One file per mirrored component
- **WHEN** a new component needs a loading state
- **THEN** a skeleton file mirroring exactly that component is created under `components/skelitons/`

### Requirement: Compound page skeletons compose per-component skeletons

Compound page-level skeletons (e.g. `tour-page-skeleton`, `tours-page-skeleton`, `destination-page-skeleton`, `search-page-skeleton`, `entity-page-skeleton`) SHALL be built by composing the per-component skeletons rather than re-drawing card or section markup. Where a page renders a grid of cards, its page skeleton MUST render those same card skeletons inside the identical grid container (same `grid-cols`, `gap-x`, `gap-y`) the real list uses.

#### Scenario: Grid skeleton reuses card skeleton in the real grid
- **WHEN** a page skeleton stands in for a list/grid of cards
- **THEN** it renders the dedicated card skeleton inside the same grid classes (columns and gaps) the live list component uses, so card positions match exactly

#### Scenario: No duplicated card markup in page skeletons
- **WHEN** a compound page skeleton is authored or edited
- **THEN** it references the shared card/section skeleton components and contains no hand-copied card markup

### Requirement: Each card skeleton is reused at every streamed usage site

A card's skeleton SHALL be used as the loading/Suspense fallback at every site where that card is streamed, including: `TourCardSkeleton` for `tours-listing.tsx` and `search/search-results-section.tsx`; the collection card skeleton for `collection-tours-section.tsx`; and `HubTourCardSkeleton` for `hub-trips-panel.tsx`. The skeleton count and grid used in each fallback MUST match the layout of the corresponding live list.

#### Scenario: Fallback matches the live list layout
- **WHEN** a Suspense boundary or `loading.tsx` provides a fallback for a card list
- **THEN** the fallback renders the card's dedicated skeleton in the same grid and a representative card count, so the transition from fallback to content does not reflow the page
