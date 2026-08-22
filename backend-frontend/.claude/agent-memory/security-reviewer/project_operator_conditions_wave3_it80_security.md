---
name: project_operator_conditions_wave3_it80_security
description: Security review of operator-conditions wave 3 (Pastel #80) - operator-authored rich-text conditions document across island-tour-development@26e82ed4 + dashboard@caf310f
type: project
---

Wave 3 of the operator-conditions gate (Pastel #80 / MCK-20) added an operator-authored
TipTap HTML "conditions document" (`operators.termsDocument`, one per operator, shared
across all that operator's tours) rendered publicly via `dangerouslySetInnerHTML` on three
surfaces (canonical page, checkout reader, overlay) plus the admin/dashboard console.
Reviewed commits: `island-tour-development` 26e82ed4, `tripwheel-x-islandtours-dashboard`
caf310f (2026-08-16).

**Result: no CRITICAL/MAJOR findings.** One MINOR: a read-merge-write race on
`operators.termsDocument` — two concurrent writes touching different tours of the SAME
operator (wizard `update()` vs. Translation Console `upsertOperatorTermsTranslation()`, or
two concurrent wizard saves) can lose an update, because `resolveDesiredConditions()`
reads the operator row once to build the merged locale map, then the "instant lane" write
block re-reads it later only to diff/version-stamp but writes the map computed from the
*first*, now-stale read. Not exploitable for XSS/authz, but can silently clobber an
admin-approved translation and mis-stamp `termsVersion`/`termsEffectiveDate` (the legal
acceptance-evidence fields). Fix: do the final read+merge+write inside one transaction,
not two separate reads spanning the request. Not yet fixed as of this review.

**Confirmed clean (traced to code, not assumed):**
- Every write path (`update()`, `upsertOperatorTermsTranslation()`) sanitizes via the
  SAME shared `sanitizePageHtml` (`@/common/utils/page-html.util.ts`) also used by the
  Pages module - no forked/weaker sanitizer copy.
- `setStagedConditions` has exactly two callers, both post-sanitize, so the pending-change
  stash can never hold raw operator HTML. Approve-apply (`tour-pending-changes.service.ts`
  ~1430) writes `payload.conditions.document` as-is without re-sanitizing, which is safe
  ONLY because there is no path that can populate that field with unsanitized input -
  worth re-checking on any future change that adds a new writer to `StagedConditions`.
- `PUT /tours/:id/operator-terms/translation/:locale` calls `assertOwnership()` (resolves
  caller's own operatorId, 403 on mismatch, ADMIN bypasses) - a TOUR_OPERATOR cannot write
  another operator's tour or terms row. The cross-entity write (tour endpoint -> shared
  operator row) is intentional and safe because it's always `tour.operatorId`.
- DTOs (`UpdateTourDto.operatorTermsDocument`, `UpsertOperatorTermsTranslationDto`) both
  cap at `@MaxLength(50000)`, enforced by the global ValidationPipe BEFORE the sanitizer
  ever runs on the string - no unbounded-input-into-sanitizer DoS.
- `findOne`'s new `operator: { select: { termsDocument: true } }` leaks nothing else off
  the operator relation; the staged/held-document overlay is gated behind `isOwner`
  (TOUR_OPERATOR + resolved-operatorId match) so anonymous readers never see unapproved
  staged HTML.
- New `locale` route param uses `ParseEnumPipe(Locale)` - no prototype-pollution/key-
  injection risk into the `{locale: text}` maps.
- Dashboard diff view (`pending-change-diff.tsx`) converts the document to plain text via
  a tag-stripping `stripHtml()` and renders as React text (no `dangerouslySetInnerHTML` in
  that file) - confirmed by grep. Console EN preview and public renderers use
  `dangerouslySetInnerHTML` only on the already-sanitized value, consistent with the
  project's "sanitize once at write time, trust at render time" pattern (see
  [[project_change_email_flow_security]] for the one place this pattern was previously
  found broken - unescaped `name`, not HTML, so a different bug class).

See also [[project_instant_confirmation_it83_security]] and
[[project_approve_slug_it79_security]] for the same wave's sibling reviews (dashboard
Pastel #65-#84 backlog) and the general "review only the delta commit, prior waves already
covered" pattern this session followed.
