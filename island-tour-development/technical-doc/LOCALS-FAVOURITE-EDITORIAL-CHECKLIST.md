# Locals' Favourite — Editorial Curation (Gaps & Checklist)

> Aligns `is_locals_favourite` with the master (island-tours-platform-master.html):
> a **manual editorial flag**, set only by the Island Tours editorial team (admins),
> **never operator-set**, **never tier-linked**, target **~30% catalog coverage**.
> Refs in master: field table L8305-8312, meta-row LD13 L10985-11004, sort L2541-2548.

Status legend: [ ] todo · [x] done · [~] in progress

---

## Gaps found (the "wrong way" being fixed)

- **G1** Operator-editable checkbox in the shared trip form lets any operator flag a tour.
    - `frontend/components/dashboard/trips/trip-details-tab.tsx` (zod `:253`, iface `:302`,
      default `:358`, `watch :427`, submit `:484`, checkbox `:961-970`).
- **G2** Backend writes the flag from `UpdateTourDto` regardless of caller role — the real
  security hole (operator can set it via raw API even with the checkbox gone).
    - `backend/src/tours/dto/tour.dto.ts:1342` (`UpdateTourDto.isLocalsFavourite`)
    - `backend/src/tours/tours.service.ts:1893` (unconditional write in `update()`)
- **G3** No admin/editorial permission distinct from operators. `MANAGE_TRIPS` is granted to
  `TOUR_OPERATOR` (`roles.config.ts:215`), so it cannot gate editorial actions.
- **G4** No editorial surface for admins to curate the flag, and the ~30% coverage target is
  not surfaced anywhere.
- Non-gaps (confirmed OK): `CreateTourDto` has no `isLocalsFavourite` (edit-path only).
  `likelyToSellOutOverride` intentionally left as-is (computed-signal override, separate concern).

---

## Checklist

### 1. New editorial permission (Task #1, #2)

- [x] Add `MANAGE_EDITORIAL` to `Permission` enum — `backend/prisma/enums.prisma`
- [x] Prisma migration `20260712133827_add_manage_editorial_permission` + client regenerated
- [x] Grant `MANAGE_EDITORIAL` to `Role.ADMIN` only — `backend/src/config/roles.config.ts`
- [x] Mirror key + ADMIN grant in `frontend/lib/config/rbac.ts` (kept in sync; NOT on operator)

### 2. Lock down the operator write path (Task #3)

- [x] Delete `isLocalsFavourite` from `UpdateTourDto` — `tour.dto.ts`
- [x] Delete its write in `tours.service.ts` `update()`

### 3. Editorial endpoints — tours module, `@RequirePermissions(MANAGE_EDITORIAL)` (Task #4)

- [x] `PATCH /tours/:id/locals-favourite` — body `{ value: boolean }`; toggles + logs admin action
- [x] `GET /tours/admin/locals-favourite/stats` — `{ totalLive, flagged, pct, target: 30, perDestination[] }`
- [x] DTOs (`SetLocalsFavouriteDto`, `LocalsFavouriteStatsDto`, etc.) + swagger docs
- [x] Candidate list reuses existing `GET /tours/admin/all` + `destinationId` filter (already returns
      `aggregateRating`, `aggregateReviewCount`, `bookingCount`) — no new list endpoint

### 4. Backend tests (Task #5)

- [x] Toggle sets/clears the flag + NotFound guard
- [x] Stats math (pct + perDestination counts) — 3 tests green

### 5. Frontend API + hooks (Task #6)

- [x] `lib/api/locals-favourites.ts` (toggle + stats) + `types/locals-favourite.ts`
- [x] TanStack hooks with query invalidation (stats + `tripKeys.all`)
- [x] Public-cache busting: handled by the existing `tours` path→tag map in
      `cache-revalidation.ts` (PATCH `/tours/:id/locals-favourite` busts `tour:<id>`,
      `tours`, `search`; the destination grid is a `tours` listing) — no change needed

### 6. RBAC-guarded admin page (Task #7)

- [x] Route `app/(dashboard)/dashboard/locals-favourites/page.tsx` (server component, header)
- [x] Nav item in `frontend/navigations/navigations.ts`, `permissions: [MANAGE_EDITORIAL]`
- [x] View: destination selector (`useActiveDestinations`) like Spotlight
- [x] Coverage banner: counter + progress vs 30% target (amber warn when >10pts off)
- [x] Tour table: hero thumb, name, rating (★ + review count), booking count, status + toggle

### 7. Remove operator checkbox (Task #8)

- [x] Stripped checkbox + zod + iface + default + watch + submit from `trip-details-tab.tsx`

### 8. Docs (Task #9)

- [x] `CLAUDE.md` critical rule #23: locals' favourite is `MANAGE_EDITORIAL`-gated, never operator-set
- [x] `technical-doc/MASTER-CHECKLIST.md` LD13 + field lines updated

### 9. Verify (Task #10)

- [x] Backend + frontend `tsc` clean (run per-change)
- [x] Tour service tests pass (locals-favourite: 3 green)
- [ ] Page renders; toggle + stats work end-to-end (manual/dev check)

---

## Round 2 — table must mirror the trips dashboard table (Tasks #11-15)

Requested refinements: exact mirror of the trips listing table, server pagination +
search + `is_locals_favourite` filter, operator + category columns, every entity
(title/destination/category/operator) clickable, and a reusable confirmation dialog on
REMOVE (add is direct). `likelyToSellOutOverride` untouched (computed).

- [x] Backend: `isLocalsFavourite?` filter on `AdminToursQueryDto` (string→bool transform) + `findAllAdmin` where + swagger + unit test
- [x] `makeTripColumns`: destination/category/operator now clickable links; new `actions`
      override (default = row-actions) and `showSelect` option — trips page unchanged
- [x] Reusable `components/dashboard/confirm-dialog.tsx` (AlertDialog-based)
- [x] Rebuilt as `locals-favourites-view` (coverage) → `locals-favourites-list-view`
      (state/pagination/filters/search) → `locals-favourites-table` (mirror of trips-table:
      search + favourite/status/destination/operator filters + column toggle + pagination;
      actions column = Mark/Featured toggle, remove confirms via ConfirmDialog)
- [x] Cache: PATCH `/tours/:id/locals-favourite` covered by existing `tours` tag map
      (documented in cache-revalidation.ts); tags are registered in revalidate.ts
- [x] Backend + frontend `tsc` clean; 54 tour tests green
- [ ] Live dev click-through (manual)

Deviation (intentional, for UX): no row-select/bulk column — there is no bulk curation
action, so a dead checkbox column was omitted (`showSelect: false`). Everything else mirrors
the trips table.

