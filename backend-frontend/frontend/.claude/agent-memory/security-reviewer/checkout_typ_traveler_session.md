---
name: checkout_typ_traveler_session
description: First security pass on the frontend half of checkout -> payment -> processing -> thank-you (traveler-session cookie handoff, SSR vs browser fetch split, redirect URLs). 2026-07-29, paired with the backend's checkout_payment_typ_flow_2026-07-29 memory.
type: project
---

# Frontend checkout/TYP flow — first pass, 2026-07-29

Reviewed alongside the backend booking/payments review (see backend repo's
`security-code-reviewer/checkout_payment_typ_flow_2026-07-29.md` for the full paired writeup).
Files: `components/frontend/checkout/*.tsx`, `lib/api/{bookings,fetch}.ts`,
`lib/api/public/{bookings,fetch}.ts`, `lib/traveler-session.server.ts`, `lib/traveler-session.shared.ts`,
`lib/traveler-booking.ts`, `lib/api/same-origin.ts`, `app/api/traveler-session/route.ts`, `proxy.ts`,
the checkout/processing page and TYP page.

## Confirmed secure patterns (reuse, don't re-flag)

- **Two-tier fetch split is real, not just documented.** `lib/api/fetch.ts` (`apiFetch`, browser,
  `credentials: 'include'`, no internal secret) is what every checkout mutation (`reserveBooking`,
  `updateBookingContact`, `createPaymentIntent`, `settleBooking`, `resendConfirmationEmail`,
  `requestBookingCancellation`) actually goes through. `lib/api/public/fetch.ts` (`publicFetch`,
  server-only, attaches `x-internal-api-key` when `INTERNAL_API_SECRET` is set) is used ONLY by
  `getTypByRef`/`claimConversionPush` (both idempotent-safe reads/mark-first writes) from the TYP
  page's server render. Verified by grep + read, not assumed from the comments — this split is what
  keeps the backend's global `INTERNAL_API_SECRET` throttle-bypass from actually being exploitable
  today (see the backend memory for the architectural caveat that this depends on the split never
  drifting).
- **HttpOnly traveler-session cookie handoff is correctly one-way.** The backend mints the HMAC
  token; `storeTravelerSession()` (`lib/traveler-booking.ts`) POSTs it to
  `/api/traveler-session`, which sets it `httpOnly: true, secure: prod, sameSite: 'lax'` and never
  echoes it back to JS. The Route Handler (`app/api/traveler-session/route.ts`) does NOT try to
  verify the token (correct — it has no secret; a garbage value just renders the TYP masked
  server-side) but does check `isSameOrigin()` (Sec-Fetch-Site, falls back to Origin-host match,
  allows only when neither header is present) before accepting POST/DELETE, and validates a strict
  token SHAPE regex (`^v1\.[A-Za-z0-9_-]{1,512}\.[A-Za-z0-9_-]{1,128}$`) so at least malformed junk
  can't be stuffed in.
- **`it.travelerBooking` / `it.travellerAccount` client-readable cookies are correctly pure display
  sugar** (`lib/traveler-booking.ts`) — shape-validated on read (email must contain `@`, ref/path
  regex-anchored), never used to authorize a fetch; the real credential is the separate HttpOnly
  cookie only Server Components read.
- **Redirect URLs passed to the backend (`createPaymentIntent`'s `returnUrl`/`cancelUrl` for
  Mollie) are always built from `window.location.origin` + a same-app relative path**
  (`checkout-payment-mollie.tsx` `createAndGo`), never from user input — the frontend itself
  introduces no open-redirect surface here. (The backend's `assertAllowedRedirect` origin-allowlist
  check is the actual enforcement point — see the paired backend memory for a fail-open gap found
  there when `CORS_ORIGINS` parses empty.)
- **Processing-page failure/success handling has no unsafe redirect construction**: `typHref`/
  `checkoutHref` are always built server-side from path segments already validated by the route
  (`destination`/`slug`/`locale` come from the URL structure, `publicRef` is only ever
  `encodeURIComponent`-ed into a path template, never used to build an absolute URL from user input).
- Client-side `console.error('[checkout] ...', err)` calls in `checkout-form.tsx` /
  `checkout-payment-mollie.tsx` are browser-console-only (not sent to a server log), so raw error
  message exposure there is a non-issue (the user is looking at their own browser).

**Why:** This is the frontend counterpart to a thorough backend pass — recording it so a future
frontend-only review doesn't have to re-verify the fetch-layer split or the cookie handoff from
scratch, and so it stays synced with the backend memory's note about the `INTERNAL_API_SECRET`
blast radius depending on this exact split holding.
**How to apply:** Before a future pass, re-grep for any NEW checkout/TYP mutation added to
`lib/api/public/*.ts` (the SSR-secret-carrying layer) — if a mutation route ever moves there from
`lib/api/*.ts` (the browser layer), re-check whether it inherits the backend's throttle-bypass for
routes that were only ever meant to be browser-called.

## Second pass, same day — cancel flow + price-trust, full file read (not just grep)

Extended the same review to the full money-path surface named in a follow-up audit request:
`checkout-payment.tsx`, `checkout-payment-mollie.tsx`, `checkout-processing.tsx`,
`checkout-summary.tsx`, `checkout-fields.tsx`, `lib/checkout/checkout.ts`, the cancel page
(`app/(frontend)/[locale]/cancel/[publicRef]/page.tsx` + `cancel-request-card.tsx`), the traveler
login (`components/frontend/login/traveler-login.tsx`), `app/api/traveller/cancellation-request/route.ts`,
and all `thank-you/*.tsx` components. No new critical/high findings — this confirms and extends the
first pass:

- **Price trust is clean end-to-end.** `quoteBooking` results (`totalRetail`/`depositAmount`/
  `balanceAmount`) are stored in client state (`checkout-client.tsx` `liveTotals`) ONLY for display;
  neither `reserveBooking` (`lib/api/bookings.ts` `ReserveRequest`) nor `createPaymentIntent`
  (`redirects: { returnUrl, cancelUrl, cardToken }`) ever sends a price-shaped field back. The
  reserve/intent calls carry only ids, quantities, `quoteId` (forward-compat, reserve recomputes),
  and the PSP redirect URLs (always same-origin, built from `window.location.origin` +
  a server-derived relative path). Nothing for the backend to blindly trust here.
- **The `/bookings` login's `returnTo` param is a real, tested allowlist, not just a comment.**
  `traveler-login.tsx` (~line 155): `/^\/(?:[a-z0-9-]+\/thank-you|cancel)\/[A-Za-z0-9-]+$/` rejects
  protocol-relative (`//evil.com`) and absolute URLs alike (the char class after the leading `/`
  cannot itself be `/`), then goes through `router.push` (client router, not `window.location`).
  This is the ONE open-redirect-shaped input on the money path that takes a URL from the query
  string; it is fail-closed.
- **The cancellation-request proxy (`app/api/traveller/cancellation-request/route.ts`) is the right
  pattern for a write that needs the HISTORY-scoped 24h session**: same-origin check
  (`isSameOrigin`), shape-validates `publicRef` (`^[A-Za-z0-9-]{1,64}$`) and `reason` (string or
  absent) before ever touching the network, reads the HttpOnly cookie server-side and forwards it
  as `x-traveler-session` — the token is never serialized into a client component prop, exactly the
  XSS-exfiltration concern the code comment names. Deliberately skips the `publicFetch` internal-key
  helper so a user-triggered write doesn't inherit the backend's throttle exemption.
- **No `dangerouslySetInnerHTML` anywhere in the checkout/thank-you/cancel component trees** (grepped
  the full directories); tour titles, guest names, and cancellation "reason" free text all render as
  plain JSX children (auto-escaped). No client-side `console.*` of PII anywhere in `thank-you/*.tsx`
  either (checked every file, not just the ones from the first pass).
- **Mollie's `cancelUrl: window.location.href` (`checkout-payment-mollie.tsx` `createAndGo`)** always
  reflects the browser's own current address bar — it cannot be forged to a foreign origin without
  an XSS already in play, so it adds no frontend-side open-redirect surface. Whether the backend's
  redirect allowlist actually enforces this is the backend review's territory (see that memory for
  the `CORS_ORIGINS`-empty fail-open gap already on file there).

**How to apply:** Same as above — this second pass didn't find anything the first pass missed, it
just widened the read to files not yet opened. Future reviews of this surface can trust both passes
and focus on diffing since 2026-07-29 rather than re-reading files unchanged since then.
