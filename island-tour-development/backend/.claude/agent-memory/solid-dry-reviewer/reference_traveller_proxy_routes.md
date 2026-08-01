---
name: reference_traveller_proxy_routes
description: frontend/app/api/traveller/*/route.ts proxy routes (contact, cancellation-request, cancellation-withdraw, date-change) share near-identical boilerplate on purpose.
type: reference
---

Every route under `frontend/app/api/traveller/` (contact, cancellation-request,
cancellation-withdraw, date-change) repeats the same shape: `isSameOrigin(req)` check → read the
HttpOnly traveler session via `getTravelerSessionToken()` → forward to the backend with
`TRAVELER_SESSION_HEADER` → `revalidateTag(travellerCacheTag(...), { expire: 0 })` on success →
`try/catch` returning 502 on network failure.

**Why:** each route's docstring explains this is deliberate — the HISTORY-scoped session cookie
must never be serialized to client JS, and a user-triggered write must not ride the SSR
internal-API-key's throttle exemption. Don't recommend collapsing these into one generic handler
without preserving that reasoning in the extracted version.

**How to apply:** treat the *shape* duplication as an acceptable, intentional pattern (note it
once as "project-wide, by design" rather than a DRY violation to fix). DO flag the one real
correctness gap that IS worth raising: every one of these routes discards the backend's specific
error message and returns only `{ ok: false }`, so the frontend can't distinguish a transient
failure ("try again") from a permanent refusal ("this booking was already cancelled — contact us").
The `cancellation-request/route.ts` comment even claims "the backend's message is safe to relay"
but then never relays it. This was already present before 2026-08-01 and `cancellation-withdraw`
copied it forward unchanged.
