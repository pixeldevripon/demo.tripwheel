# Memory Index

## Project
- [manage-calendar reviewed clean](confirmed_secure_availability_manage_calendar.md) — reference pattern for operator-scoped read endpoints: ownership-check-before-parallel-reads, tourId scoping in every query, bounded month regex
- [Traveller OTP login reviewed](confirmed_secure_traveller_otp_login.md) — 2026-07-28; token-scope + data-withholding design is a good reference; one race-condition bug found (see next entry)
- [Atomic-consume updateMany idiom](pattern_atomic_consume_updateMany.md) — this repo's required pattern for single-use tokens/flags; grep `consumedAt`/`redeemedAt`/`usedAt` and check the write is a guarded `updateMany`+count, not read-then-plain-update
