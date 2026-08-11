All audits complete and cross-referenced against the Cache Components rules. Here's the precise verdict.

---
Frontend rendering + revalidation review

Verdict up front

The architecture is fundamentally sound and correct. cacheComponents: true is on; every data loader is 'use cache' with cacheLife + tags; no route awaits uncached data outside a <Suspense> (no prerender-blocking bugs — which is why the build is green). Revalidation is a clean updateTag (immediate) system with granular + coarse tags.

There are 2 real gaps, 1 systemic inconsistency (which directly affects the skeleton work we just did), and a handful of cleanups. Nothing is architecturally broken; the fixes are targeted.

---
1. Rendering strategy — every route

Route: (frontend)/layout
Mode: Static
Prerendered?: —
loading.tsx: —
Streamed holes: none (sync pass-through)
────────────────────────────────────────
Route: [locale]/layout
Mode: Static shell
Prerendered?: all 7 locales
loading.tsx: No
Streamed holes: none (wishlist = client island)
────────────────────────────────────────
Route: [locale]/page (home)
Mode: Fully static
Prerendered?: yes
loading.tsx: No
Streamed holes: none
────────────────────────────────────────
Route: [destination]/page
Mode: PPR
Prerendered?: active dests + launch fallback
loading.tsx: No
Streamed holes: Hero, Favourites, Collections
────────────────────────────────────────
Route: [destination]/tours/page
Mode: PPR
Prerendered?: active dests + launch fallback
loading.tsx: No
Streamed holes: Header, Listing
────────────────────────────────────────
Route: [destination]/[slug]/page
Mode: PPR
Prerendered?: dest×category + fallback; tours/hubs/collections on-demand
loading.tsx: Yes
Streamed holes: per entity component
────────────────────────────────────────
Route: [locale]/search/page
Mode: PPR body
Prerendered?: no
loading.tsx: No
Streamed holes: Results (generateMetadata reads searchParams → dynamic
metadata)
────────────────────────────────────────
Route: [locale]/wishlist/page
Mode: Static shell
Prerendered?: no
loading.tsx: No
Streamed holes: none (client WishlistView)

What's correct: shells prerender everywhere; searchParams is always forwarded as an unawaited Promise into a Suspense child (tours :98, search :59, category :316); generateStaticParams on every param route has a backend-down fallback; no segment-config overrides needed. Entity dispatcher ([slug]) only awaits cached loaders, so it prerenders and each entity owns its own holes.

2. Revalidation strategy

Chain: mutation → apiFetch success hook → revalidatePublicForPath (switch path→tags) → revalidateCacheTags Server Action → updateTag (immediate; no background revalidateTag, no revalidatePath). Tags de-duped; slug-registry busted only on slug-affecting writes (create / delete / rename / lifecycle verbs); user-profile handled for users/settings/operators.

Cross-reference (loader tags vs bustable tags) — this is the test that matters:

┌────────────────────────────────────────────┬────────────────────────┐
│              Loader cacheTag               │ Can revalidation bust  │
│                                            │          it?           │
├────────────────────────────────────────────┼────────────────────────┤
│ tours, search, destinations, categories,   │ ✅ yes                 │
│ collections, hubs, slug-registry           │                        │
├────────────────────────────────────────────┼────────────────────────┤
│ tour:, operator:, destination:, category:, │ ✅ yes (granular)      │
│  collection:, hub:                         │                        │
├────────────────────────────────────────────┼────────────────────────┤
│ slug:${dest}:${slug}                       │ ✅ covered by coarse   │
│                                            │ slug-registry          │
├────────────────────────────────────────────┼────────────────────────┤
│ reviews                                    │ ❌ no branch ever      │
│                                            │ emits it               │
├────────────────────────────────────────────┼────────────────────────┤
│ getDictionary (no tag)                     │ ❌ untagged by design  │
└────────────────────────────────────────────┴────────────────────────┘

---
3. Real gaps

🔴 G1 — reviews is unbustable (latent)

getTourReviews tags reviews + tour:${id}, but cache-revalidation.ts has no case 'reviews'. Today this is latent, not an active bug: there's no review-mutation client in the frontend yet (reviews module is "to build"; lib/api/reviews.ts is GET-only). But the moment review moderation (approve/edit/delete) ships, changes — and the tour's rating/count aggregate (served by getTourBySlug, tagged tour:${id}) — will be stale up to 1h (cacheLife('hours')). Fix when that write lands: add a case 'reviews' busting ['reviews', tour:${id}, 'tours', 'search'] (tours/search because cards show rating).

🟠 G2 — No loading.tsx on the on-demand-capable content routes

Only [slug] has a loading.tsx. [destination] and [destination]/tours assert in their own comments that "the route's loading.tsx covers navigation" — but none exists at those segments (and [slug]'s does not cascade up). For prerendered params this is invisible. But a non-prerendered destination (a new island activated after build, or a launch-fallback slug that isn't truly active) runs await getDestinationBySlug at request time with no instant fallback → blank body until the loader resolves. Add loading.tsx at both segments.

---
4. The systemic inconsistency (and how it undermines the skeleton work)

await connection() is used inconsistently on cached sections. A section wrapped in <Suspense> only actually streams (and shows its skeleton) if it has a request-time trigger — connection() or searchParams. Cached sections without a trigger bake into the static prerender and their skeleton never renders.

┌───────────────────────────────┬───────────────┬──────────┬──────────┐
│            Section            │    Trigger    │ Streams? │   Its    │
│                               │               │          │ skeleton │
├───────────────────────────────┼───────────────┼──────────┼──────────┤
│ DestinationLocalFavourites    │ connection()  │ ✅       │ shows    │
├───────────────────────────────┼───────────────┼──────────┼──────────┤
│ ToursListingSection           │ searchParams  │ ✅       │ shows    │
├───────────────────────────────┼───────────────┼──────────┼──────────┤
│ SearchResultsSection          │ searchParams  │ ✅       │ shows    │
├───────────────────────────────┼───────────────┼──────────┼──────────┤
│ Tour detail / reviews /       │ connection()  │ ✅       │ shows    │
│ related                       │               │          │          │
├───────────────────────────────┼───────────────┼──────────┼──────────┤
│                               │ dead          │          │          │
│ ToursHeaderSection            │ connection    │ ❌       │ never    │
│                               │ import, never │          │ shows    │
│                               │  called       │          │          │
├───────────────────────────────┼───────────────┼──────────┼──────────┤
│ DestinationHeroSection        │ none          │ ❌       │ never    │
│                               │               │          │ shows    │
├───────────────────────────────┼───────────────┼──────────┼──────────┤
│ DestinationCollectionsSection │ none          │ ❌       │ never    │
│                               │               │          │ shows    │
├───────────────────────────────┼───────────────┼──────────┼──────────┤
│ HubTripsData (hub trips)      │ none          │ ❌       │ never    │
│                               │               │          │ shows    │
└───────────────────────────────┴───────────────┴──────────┴──────────┘

Consequence: several skeletons we made pixel-perfect earlier — ToursHeaderSkeleton, DestinationHeroSkeleton, DestinationCollectionsSkeleton, HubTripsPanelSkeleton — currently render nowhere (inert Suspense, and those routes have no loading.tsx to reuse them). That's not wasted effort if we make a decision; right now it's just latent.

The Cache Components principle (straight from the canonical example): cached content should be prerendered directly; only truly request-varying content (searchParams/cookies/per-user) needs Suspense. Forcing cached data through connection() trades instant, SEO-in-HTML, no-flash content for a per-request skeleton flash — with zero freshness benefit (tags keep both fresh). So the "correct" cached sections are actually the ones without connection().

---
5. Cleanups (low risk)

- Dead connection import in tours-header-section.tsx.
- Stale docstrings claiming connection() in tours-listing-section, search-results-section, destination-page-sections, hub-page, tours-header-section.
- Debug console.log('details', detail) at tour-detail-content.tsx:102.
- destinations.ts:19 comment says revalidateTag but code uses updateTag.
- getDictionary untagged — fine (chrome strings ship with the build); only add a translations tag if locale copy ever becomes backend-editable.
- TYP/thank-you route from CLAUDE.md is unimplemented (expected — booking module is "to build").

---
Recommendation — what to actually do

The one decision that resolves most of this: pick a streaming policy per page-type and apply it uniformly. My recommendation:

1. Content pages that are prerendered (home, [destination], tours shell, category): let cached sections prerender (drop connection() and the inert Suspense on Hero/Collections/Favourites/tours-header/hub-trips). Instant LCP, SEO content in HTML, no skeleton flash. Then add loading.tsx to [destination] and [destination]/tours (compose the existing section skeletons) — this both fixes G2 and gives those skeletons a real, correct home (client-nav + on-demand param miss).
2. Genuinely dynamic sections keep streaming: ToursListingSection/SearchResultsSection (searchParams) and the on-demand tour-detail sections (connection()) — leave as-is; their skeletons correctly show.
3. Fix G1 when the review-write module lands (add case 'reviews').
4. Sweep the cleanups in §5.

This makes every page's strategy intentional and consistent, and every skeleton either streams or backs a loading.tsx — nothing orphaned.

Want me to implement it? I'd suggest sequencing: (a) cleanups + dead import + console.log now (trivial, safe); (b) add the two loading.tsx files; (c) apply the streaming-policy alignment; (d) leave G1 as a documented TODO tied to the reviews module (or add the case 'reviews' pre-emptively). Tell me which of (a)–(d) to do and I'll proceed.