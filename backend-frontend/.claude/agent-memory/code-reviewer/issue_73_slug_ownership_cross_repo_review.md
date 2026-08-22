---
name: issue_73_slug_ownership_cross_repo_review
description: Cross-repo review of GitHub issue #73 (slug becomes Island-Tours-owned, operators lose the editable Slug field) - 2026-08-15
metadata:
  type: project
---

Reviewed `pastel-73-slug-review-owned` in both repos: backend `tours.service.ts`
create()/update() gate `dto.slug` to `Role.ADMIN` (ignore, not reject, for everyone else); dashboard
`step-basics.tsx` role-splits the Slug field into an editable input (ADMIN) vs a read-only
"Web address" `UrlPreview` (everyone else).

**Backend logic is correct.** Both create() and update() genuinely ignore a non-admin's slug rather
than silently trusting it. The update() rename block's pre-existing `if (normalized !== tour.slug)`
guard means an ADMIN's byte-identical passthrough (every OTHER wizard step's PATCH also sends
`slug: trip.slug` via `tripToUpdatePayload`, not just step-basics - confirmed in
`lib/trips/update-payload.ts`) is a safe no-op, not an accidental rename. This exact scenario has
**zero test coverage** on either side (no "admin submits the tour's own unchanged slug" spec) -
worth adding since the whole PR's safety argument rests on it.

**ADMIN-only gating (not `isPlatformWideRole`, not a `Permission`) is consistent with established
precedent in the same backend file** - see
`backend/.claude/agent-memory/solid-dry-reviewer/tours_admin_only_authority_stamp_pattern.md` for
the full precedent list (publish/unpause approval-bypass, cancellationHours, remove). Dashboard
mirrors it exactly (`role === 'ADMIN'`), which avoids the worse failure mode (a visible-but-ignored
field). `toSlug` (dashboard `lib/utils.ts`) and `generateSlug` (backend
`common/utils/slug.util.ts`) are byte-identical - confirmed by direct diff, no preview-lies-to-user
risk from that angle.

**Two real dashboard bugs found, both in `components/trips/wizard/steps/step-basics.tsx`, both
pre-existing code whose correctness broke as a SIDE EFFECT of hiding the field for non-admins**
(the auto-slug `useEffect` at ~line 291 and the submit catch-block at ~line 352 were NOT touched by
this diff):

1. **Silent dead-end submit failure (Major).** The auto-slug `useEffect` still runs unconditionally
   (gated only on `slugTouched`, not on `isAdmin`) and still feeds the same `basicsSchema.slug`
   (`.min(2).regex(...).optional().or(literal(''))`) that `handleSubmit`'s resolver validates. In
   CREATE mode for a non-admin, a name that trims/strips down to a 1-character slug (e.g. name
   `"1  "` -> `toSlug` -> `"1"`) fails that `.min(2)` client-side, `onInvalid` fires, and
   `focusFirstInvalid()` queries for `[aria-invalid="true"]` - which doesn't exist since the
   admin-only branch that renders the slug `Input`/`FieldError` never mounts for this role. Nothing
   happens: no toast, no scroll, no focus, Continue silently does nothing. Narrow trigger (names
   that collapse to exactly 1 leftover alnum char after `toSlug`), but 100% silent and unrecoverable
   for the operator when it hits. Violates the repo's own 5-part validation contract (see
   `feedback_validation_five_parts.md` in the user-level memory) since parts 3/4 have no DOM element
   to attach to. Fix: gate the effect on `isAdmin` too (or drop the schema's min/regex constraints
   for non-admin) - the visible preview (`operatorSlug`) already computes independently via
   `toSlug(nameValue)` and doesn't need the watched form field at all.

2. **Stale error copy (Major).** `submit()`'s catch block hardcodes `'A trip with this slug already
   exists in this destination. Pick a different slug.'` whenever the caught error message contains
   "slug" (still reachable for non-admins via the backend's operator-name-suffix collision path in
   `create()` -> `resolveUniqueSlug`, which throws `'Both "X" and "X-suffix" are already taken...
   choose a different tour name or slug'`). A non-admin has no slug field to "pick a different"
   value in anymore - the message should branch on role, or just surface the backend's own message
   (which already says "tour name or slug").

**Test coverage gap that would have caught #1:** all 4 new dashboard RTL tests pass a non-null
`trip` (edit-mode-shaped), so `isCreate` is always `false` and `slugTouched` starts `true` - the
auto-slug effect never runs in any of them. The bug only lives in the CREATE path
(`trip={null}` + default `TOUR_OPERATOR` role), which has no test at all for the non-admin branch.

**How to apply:** if asked to fix, the effect-gating fix for #1 is one line
(`if (!slugTouched && isAdmin)`); #2 needs either a role check in the catch block or trusting the
backend's message verbatim instead of overwriting it.
