---
name: Homepage CMS + Featured Experiences + Homepage FAQ Security Findings
description: Security review (2026-07-20, uncommitted) of backend/src/home-page, backend/src/featured-experiences, categories.forceDelete cleanup, and the cross-repo cache-tag contract — one High (image-URL availability), rest confirmed clean
type: project
---

Review completed 2026-07-20. Scope: `backend/src/home-page/**`, `backend/src/featured-experiences/**`,
`backend/prisma/home-page.prisma`, `backend/prisma/destinations.prisma` (FeaturedExperience model),
`backend/src/categories/categories.service.ts` (forceDelete only), `backend/src/common/constants/faq-page-type.ts`,
frontend `lib/api/public/home-page.ts` + `featured-experiences.ts`, `components/frontend/home/*`, and the
cross-repo `lib/cache-tags.ts` / dashboard `lib/api/cache-revalidation.ts` contract. No code was modified.

**HIGH:**

- **No server-side URL/host validation on admin-supplied `HomePage.heroImage`/`ogImage`/`editorialImages`,
  and the field is rendering-critical for the entire site.** `UpdateHomePageDto`
  (`backend/src/home-page/dto/home-page.dto.ts` ~L185-219) validates these with bare `@IsString()` —
  no `@IsUrl()`, no length cap, no check against `frontend/next.config.ts` `images.remotePatterns`
  (cloudinary/googleusercontent/picsum-demo/unsplash only). `HomePage` is a **singleton** and
  `content.heroImage` is passed straight into `next/image fill priority` in `Hero`
  (`components/frontend/home/hero.tsx` L53-61) as part of the prerendered static shell for
  `/{locale}/` in **every locale** (no Suspense boundary around it — `page.tsx` resolves it via
  `Promise.all` before render). `next/image` throws synchronously at render time
  ("Invalid src prop ... hostname ... is not configured") when the src's host isn't in
  `remotePatterns` — this is a full outage of the public homepage's front door across every locale
  until an admin corrects the field, reachable by anyone holding `MANAGE_EDITORIAL` (not necessarily
  full ADMIN — this project's staff/designation permission engine, see
  [[project_staff_teams_module_security]], can grant permissions more narrowly than the role name
  implies). This exact gap (`@IsString()` with no `@IsUrl()`) is a **pre-existing project-wide
  pattern** — confirmed identical on `destinations.dto.ts` and `category.dto.ts` `heroImage` — so it
  is not a new regression, but the blast radius here is uniquely large because HomePage is the one
  row backing the whole site's front door, not a single entity page. **Fix:** add `@IsUrl()` (or a
  regex matching `remotePatterns` hosts) + `@MaxLength()` to `heroImage`/`ogImage`/`editorialImages`
  items in `UpdateHomePageDto`, and ideally wrap `Hero`'s `<Image>` in a try/fallback or validate the
  host server-side before storing.

**MEDIUM / LOW — none material found.** Checked and explicitly ruled out:
- Injection: no raw SQL/`$queryRaw`/`exec`/`spawn` anywhere in either module; all Prisma calls
  parameterized.
- IDOR: `FaqGroupService` (shared, `backend/src/common/faq/faq-group.service.ts`) scopes every
  group op by the `(pageType, entityId, groupId)` triple — a homepage FAQ route can't touch another
  entity's FAQ group. `HomePageService.assertHomeId` rejects any `:entityId` other than the literal
  `'default'` singleton key (404), closing the obvious IDOR shape that route structure invites.
- Data exposure via `@Public()` endpoints: `HomePageService.getPublic()` and
  `FeaturedExperiencesService.resolvePublic()` both hand-assemble their return objects field-by-field
  (never spread the raw Prisma row), so even though the underlying `select`s fetch broader admin
  fields (e.g. `isMachineTranslated`), nothing beyond the intended public shape reaches the response.
- Polymorphic `entityId` (no FK) abuse: `assertEntityExists`/`assertDestinationValid` in
  `featured-experiences.service.ts` correctly validate existence + hub-destination ownership before
  every create/update; no orphan-referencing write path found.
- Orphan cleanup: `categories.forceDelete` cleans up `Faq`+`FeaturedExperience` rows for CATEGORY
  inside the same `$transaction` (verified). Hub has **no hard-delete path at all** (`hubs.service.ts
  remove()` only sets `isActive: false`), so no analogous HUB cleanup is needed — the resolver's
  `isActive`/`status` gate already excludes soft-deleted hubs from public output. Self-consistent, no
  gap.
- SSRF: closed at the infra layer — `next/image` `remotePatterns` allowlist rejects any host not in
  the fixed list, regardless of what the DTO allows into the DB (this is *why* the High finding above
  is an availability issue rather than an SSRF issue).
- Cache poisoning / cross-repo contract: `frontend/lib/cache-tags.ts` and dashboard
  `lib/cache-tags.ts` are **byte-identical** (verified via `diff`). `cache-revalidation.ts`'s
  `home-page`/`featured-experiences` cases correctly map to the `homepage` tag; the public
  `getFeaturedExperiences` loader additionally tags `tours` (so a tour going live/dark still busts
  the carousel via the existing `tours` case), consistent.
- DoS: `FeaturedExperiencesService.resolvePublic()` caps public output at `MAX_PUBLIC_EXPERIENCES=8`
  post-resolve; admin `list()` is unbounded but admin-gated and inherently small (curated content).
  Not exploitable by an unauthenticated actor.
- ValidationPipe: confirmed `whitelist: true, forbidNonWhitelisted: true` active in `main.ts`, so
  unknown fields on any new DTO here are rejected, not silently accepted.
- Every mutating route on both controllers is `@RequirePermissions(Permission.MANAGE_EDITORIAL)`;
  both public reads are `@Public()` and declared before their `:id`/`:entityId` siblings so
  `public` is never swallowed as a route param.

**Why:** First security pass on the homepage CMS/Featured Experiences/homepage-FAQ feature set;
records the one real gap (unchecked image host on a singleton, site-wide-blast-radius field) plus a
full list of what was explicitly checked and ruled out, so a future reviewer doesn't have to re-derive
the polymorphic-entityId reasoning or re-verify the cache-tag byte-identity from scratch.
**How to apply:** Before this ships, verify `UpdateHomePageDto.heroImage`/`ogImage`/`editorialImages`
gained `@IsUrl()`/host validation. Any future PR adding a new admin-editable image field on a
*singleton* (vs. per-entity) row should get the same scrutiny — the failure mode is worse than a
normal entity because there's no "just this one page is broken" containment.
