# Memory Index

## Project
- [manage-calendar reviewed clean](confirmed_secure_availability_manage_calendar.md) — reference pattern for operator-scoped read endpoints: ownership-check-before-parallel-reads, tourId scoping in every query, bounded month regex
- [Traveller OTP login reviewed](confirmed_secure_traveller_otp_login.md) — 2026-07-28; token-scope + data-withholding design is a good reference; one race-condition bug found (see next entry)
- [Atomic-consume updateMany idiom](pattern_atomic_consume_updateMany.md) — this repo's required pattern for single-use tokens/flags; grep `consumedAt`/`redeemedAt`/`usedAt` and check the write is a guarded `updateMany`+count, not read-then-plain-update
- [Password-change flow reviewed](confirmed_secure_password_change_flow.md) — 2026-07-28; token/consume/IDOR design is solid; 2 real gaps: native Better Auth bypass + confirm page trapped behind auth-gated layout
- [Better Auth native-endpoint bypass pattern](pattern_better_auth_native_endpoints_bypass.md) — CRITICAL: catch-all `@All('/api/auth/*splat')` keeps every native Better Auth route live; check custom step-up flows don't get silently bypassed by e.g. `/change-password`
- [Stop-sell split: deleteException gap](finding_stop_sell_split_deleteexception_gap.md) — 2026-07-30 HIGH; guard widened to OR-permission but delete body never re-checked exception `type`; audit undo/delete paths whenever a permission split lands
