---
name: pattern_atomic_consume_updateMany
description: This codebase's established idiom for single-winner/single-use state flips is a conditional updateMany + count check; flag any single-use token/code/flag consumption that instead does read-then-plain-update
metadata:
  type: project
---

`backend/src/bookings/bookings.service.ts` has a well-established, explicitly-commented idiom for
"exactly one caller may do this" operations: a conditional `updateMany({ where: { id, <guard
column>: <initial value> }, data: {...} })` followed by checking `count === 1` (or `count > 0`)
before treating the caller as the winner. Named examples in the file:
- Line ~938-940: booking status flip, comment "`updateMany` lets exactly ONE caller flip the row;
  `count` tells the [winner]".
- Line ~1172-1188: `conversionFiredAt IS NULL` guard, comment "ATOMIC mark-first (rule #22 / master
  §5.1): the guarded `updateMany`... lets exactly one caller win, even when settle and the webhook
  race."
- Line ~2706: "The conditional updateMany makes the loser a no-op (count 0)."

**Why this matters for review:** any new single-use artifact (login code, invitation token,
one-time link, idempotency flag) that instead does `findFirst` (or `findUnique`) → business logic
→ separate plain `update` to mark it consumed is a TOCTOU race: concurrent callers can all read the
"still live" state before any of them writes the "consumed" state, so all of them succeed. This is
exactly the same defect class as Critical Rule #8 (the old slot economy's `updateMany WHERE
status='SOFT_LOCKED'` guard) generalized to any single-use row, not just slot locks.

**Confirmed instance (2026-07-28 review, traveller OTP login feature):** `verifyTravellerLoginCode`
in `bookings.service.ts` (added for `TravelerLoginCode` / `/bookings/traveller/verify-code`) reads
the code row, increments `attempts`, compares the code, then does a separate plain `update` to set
`consumedAt`. Two concurrent requests with the same correct code can both pass the `consumedAt:
null` read before either writes `consumedAt`, so both mint a valid 24h HISTORY session from what is
documented as a single-use code. Reported as a Medium finding; fix is to make the final consume step
a conditional `updateMany({ where: { id: row.id, consumedAt: null }, data: { consumedAt: new Date()
} })` and only issue the session when it affects exactly one row.

**How to apply:** whenever reviewing new code that consumes a one-time code/token/flag in this repo,
check the consume step is a guarded `updateMany` + count check, not a plain `update` after a
separate read. This is a good targeted grep: search for `consumedAt`, `redeemedAt`, `usedAt`,
`revokedAt`-style single-use columns and trace whether the write that flips them is conditional.
