---
name: homepage_featured_experiences_review
description: 2026-07-20 review of homepage CMS + featured-experiences modules (backend + both frontends) — findings and confirmed-good patterns
type: project
---

Reviewed uncommitted "homepage CMS + featured experiences + homepage FAQ" work across
island-tour-development (backend `src/home-page/`, `src/featured-experiences/`, frontend
`lib/api/public/{home-page,featured-experiences}.ts` + home components) and the dashboard
repo (`lib/cache-tags.ts`, `lib/api/cache-revalidation.ts`).

**Verdict: high quality, close to the `src/users/` reference pattern.** HomePageService is the
cleanest FAQ-delegation example yet (thin pass-through to FaqGroupService, singleton
self-seed via upsert, `assertHomeId` guard against typo'd entityId). categories.service.ts
`forceDelete` was correctly extended to clean up the two polymorphic tables (Faq,
FeaturedExperience) that Prisma cascade can't reach — confirmed hubs has no hard-delete path,
so no parallel gap there.

**Confirmed findings (would resurface in any follow-up touch to these files):**

1. **`FeaturedExperience` has no uniqueness constraint** (`backend/prisma/destinations.prisma`
   FeaturedExperience model, only `@@index([entityType, entityId])`) and
   `featured-experiences.service.ts` `create()` never checks for an existing duplicate row. The
   same schema file enforces this exact pattern elsewhere (`HubOurPick.@@unique([hubId,
   tourId])`, `HubComparisonTour.@@unique([groupId, tourId])`, `HubAllowedCategory.@@unique([hubId,
   categoryId])`) — FeaturedExperience breaks that established convention. A double-add by an
   admin renders the same card twice in the Top Experiences carousel; nothing (DB, service, or
   frontend) dedupes. destinationId nullability means a plain unique index won't fully solve it
   (Postgres treats NULL != NULL) — needs a partial unique index or a runtime duplicate check.

2. **`resolveHub`'s gate is stricter than what actually 404s the hub page**, contradicting its
   own doc comment ("mirroring `hubs.service` render"). `featured-experiences.service.ts`
   `resolveHub` drops any hub with `_count.tourHubs === 0`, but `hubs.service.ts` `render()`
   (~line 1584) only checks `isActive` + `status: PUBLISHED` — no tour-count gate exists there,
   and the publish guard (`assertPublishable`, ~line 762) never requires a live tour either. Net
   effect: a legitimately published hub with zero tours *yet* is silently omitted from Top
   Experiences even though its own page renders fine. Being stricter isn't unsafe, but the
   swagger description (`ApiGetPublicExperiencesDocs`) also asserts this false parity — worth
   fixing the comment/swagger at minimum, and confirming with product whether the extra gate is
   actually wanted.

3. **`CategoryRow`/`HubRow` in `featured-experiences.service.ts` are hand-written types**
   duplicating the `loadCategories`/`loadHubs` select shapes, instead of using
   `Prisma.CategoryGetPayload<{select: typeof x}>` — the established codebase idiom (see
   `tours.service.ts:748`, `bookings.service.ts:175`, `reviews.service.ts:496`,
   `staff.service.ts:103/721`, `notifications.service.ts:356`, `attributes/derived-attributes.ts:67`).
   Notably inconsistent within the *same file*: `FEATURED_SELECT` correctly uses `satisfies
   Prisma.FeaturedExperienceSelect`, but `CategoryRow`/`HubRow` don't get the equivalent
   treatment. Low live risk (nothing broken today), but it's the kind of thing that silently
   drifts when a `select` changes and nobody updates the manual type.

4. Minor nits, not worth blocking on: `translations[0]?.name || entity.name` title-fallback
   logic is duplicated verbatim twice in the same file (hub/category) — could be a one-line
   local helper but it's genuinely tiny; `assertDestinationValid` re-fetches a hub that
   `assertEntityExists` already fetched (one extra query on an admin-only write path).

5. **Embla carousel (`top-experiences.tsx`) `START = REAL + Math.floor(REAL/2)` is only honored
   on initial mount.** Verified against `embla-carousel-react@8.6.0` source
   (`node_modules/embla-carousel-react/esm/embla-carousel-react.esm.js`): a changed options
   object triggers `emblaApi.reInit(...)`, and Embla's own docs/behavior is that `startIndex`
   only applies at creation, not on reInit — reInit preserves the existing index instead. So if
   `experiences`/`cards`/`REAL` ever changed after mount (currently it can't — `experiences` is
   static per-request SSR data, full remount on navigation), the recentering math wouldn't
   re-apply. Currently unreachable, flagged only because the task explicitly asked about it and
   it's a real, verified latent gap.

**Cross-repo cache-tag contract**: `lib/cache-tags.ts` is confirmed byte-identical between this
repo and `tripwheel-x-islandtours-dashboard` (`diff` empty). `cache-revalidation.ts`'s
`case 'home-page'` and `case 'featured-experiences'` both correctly map to the coarse
`'homepage'` tag, matching the two `'use cache'` loaders' `cacheTag('homepage', ...)` calls. No
drift found.

**Test quality**: both new spec files (`home-page.service.spec.ts`,
`featured-experiences.service.spec.ts`) assert real behavior via mocked Prisma — drop/keep
decisions, tie-break destination picking, image fallback, locale flattening — not just
re-asserting mock calls. Good reference examples for future module specs.

See also [[cross-module-patterns]] for the project-wide polymorphic-entity (Faq-style)
conventions this module follows correctly.
