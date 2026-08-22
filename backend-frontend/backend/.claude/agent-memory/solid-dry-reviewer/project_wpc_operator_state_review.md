---
name: WP-C operator onboarding state review (PR #180)
description: 2026-08-11 review of feat/operator-onboarding-state — clean state machine, one DRY seed (internal-email table helpers duplicated), toursSubmitted count untested
type: project
---

Reviewed PR #180 (WP-C, EMAIL-IMPLEMENTATION-PLAN §2.4/§2.5): operator verification
state machine, decide endpoint, OB-2A/INT-1/INT-2 emails, list-API fields.

**What was solid (patterns to reinforce):**
- Guarded `updateMany({ where: { id, verificationStatus: PENDING } })` for the
  decide transition — same race-safe idiom as bookings hold-expiry; tests cover
  the race with `Promise.allSettled` and assert exactly one OB-2A send.
- `firstTourLiveAt` one-shot stamp + `operator.first-tour-live` outbox row in the
  SAME `$transaction` as the tour publish (B6 rule honoured).
- `toursSubmitted` via filtered relation `_count` inside the list `findMany` —
  no N+1; `_count` stripped before returning.
- Blanket `verificationStatus` write on PATCH /operators/:id closed via DTO field
  removal, with an e2e proving both the 400 AND the row unmoved.

**DRY seed to watch (will grow in WP-D):** the "internal email family" table-row
helper (`factRow` in operator-signup-internal.template.ts) and the
America/Curacao `Intl.DateTimeFormat` block are byte-duplicated inline in
tour-review.template.ts (`tourSubmittedSalesTemplate`), including the
`<table role="presentation" …13.5px…>` wrapper and `ctaBackground: '#1F2937'`
constant. `formatInternalTimestamp` is exported but not reused. INT1R in WP-D
would be the third copy — push for a shared `internal-email` helper then.

**Test gap left open:** nothing asserts the `toursSubmitted` where-clause
(`submittedAt: { not: null }`) actually filters — e2e only checks
`typeof === 'number'`. If WP-E leans on that count, ask for a real fixture test.

**Why:** WP-D/WP-E build directly on these files; the duplication and the count
are the two places a follow-up PR can silently drift.
**How to apply:** when reviewing WP-D (`feat/email-onboarding-sequence`) or WP-E,
check whether the internal-email helpers got extracted and whether INT1R re-pastes
the table markup a third time.
