# The Traveler Session - Full Flow Storyline

> How a traveler's booking access works end to end after the 2026-07-19 hardening (incl. the
> post-review fixes): who issues what, where it lives, who verifies it, and what every actor can
> and cannot do. Companions: `../login/01-login-design-summary.md` (the spec),
> `../login/02-login-reconciliation.md` (as-built status). Master authority: master doc 6.4
> (email + reference login), 8.2 (TYP route), B.47 (public_ref vs display_ref split).

---

## The cast

| Piece | What it is | Where it lives |
|---|---|---|
| `public_ref` | Unguessable UUID in the TYP URL. A permanent **viewing** capability - never an identity | `bookings.publicRef`, in the URL |
| `display_ref` | `IT-2026-XXXXX`, the customer-facing reference. Half of the login credential | `bookings.displayRef`, in emails + on the TYP |
| Session token | `v1.<payload>.<hmac>` - 24h, HMAC-SHA256. **Two scopes** (see below). The proof of identity | Issued by the backend, parked in the HttpOnly cookie |
| `it.travelerSession` | First-party **HttpOnly** cookie holding the token. Browser JS can never read it | Set by the frontend route handler `POST /api/traveler-session` (same-origin only) |
| `it.travelerBooking` | Client-readable cookie with `{email, ref, path}` - **display sugar only** (navbar identity, deep link). Authorizes nothing | Set by client JS after a lookup |
| Backend verifier | The ONLY place tokens are checked: signature + expiry + "do these claims own THIS booking?" | `backend/src/bookings/traveler-session.util.ts` |

### The two token scopes (the load-bearing distinction)

A token proves only as much as the caller actually demonstrated, so the payload carries **exactly
one** of two claims:

- **EMAIL scope `{ e }`** - issued ONLY by the pair login (`POST /bookings/lookup`), where the
  caller proved knowledge of email + booking reference (both delivered to that inbox). Unlocks
  every booking whose `contactEmail` matches.
- **BOOKING scope `{ b }`** - issued by checkout's contact PATCH. The email there is
  **caller-supplied and unproven**; what the caller DID prove is possession of the unguessable
  booking `id` it just created. So this token unlocks **exactly that one booking** and nothing
  else. (Minting an email-scoped token here was the critical review finding: anyone could
  reserve a throwaway booking, type a victim's email, and get a token valid against the victim's
  real bookings. Booking-scope closes it.)

`sessionOwnsBooking(claims, booking)` enforces this: booking-scope requires an exact `id` match;
email-scope requires a `contactEmail` match (and a booking with no contact email can never be
email-owned).

Two principles run through everything:

1. **Possession of a URL is never identity.** The publicRef link may show a booking exists; only
   a session that *owns* the booking (by id or by proven email) unlocks identity and actions.
2. **One verifier.** The frontend never validates tokens (it has no secret). It only ferries them.
   A forged, expired, or wrong-scope token simply renders the masked page.

---

## Scene 1 - Booking a tour (the fresh booker)

```
Checkout form (browser)
  1. POST /bookings                      -> reserve, ON_HOLD (no contact yet)
  2. PATCH /bookings/:id { contact }     -> backend writes contact, and because this
                                            patch SET the email, it returns
                                            { ...booking, sessionToken }        (A)
  3. POST /api/traveler-session {token}  -> Next route handler sets the HttpOnly
                                            it.travelerSession cookie (24h)     (B)
  4. POST /payments/.../intent           -> Stripe charge -> /payment/processing
  5. webhook confirms -> redirect to /{dest}/thank-you/{publicRef}
```

- (A) lives in `bookings.service.ts update()`: it issues a **BOOKING-scoped** token for
  `updated.id` (NOT the caller-supplied email). The author holds the unguessable booking `id`
  from the reserve response, which is the only thing they actually proved here.
- (B) lives in `checkout-form.tsx` right after `updateBookingContact`, awaited BEFORE any
  navigation, so the very first TYP render is already verified.

**Result:** the booker lands on a fully unmasked Thank You page without ever "logging in".

## Scene 2 - The Thank You page (server-side decision)

`app/(frontend)/[locale]/[destination]/thank-you/[publicRef]/page.tsx`, inside the Suspense
body after `connection()`:

```
cookie  = await getTravelerSessionToken()          // lib/traveler-session.server.ts
booking = await getThankYouBooking(ref, locale, cookie)
            -> GET /bookings/typ/:publicRef  with  X-Traveler-Session: <token>
```

The backend (`getThankYou`) verifies the token and runs `sessionOwnsBooking` (booking-id match
for a checkout token, case-insensitive `contactEmail` match for a pair-login token). Unverified,
every identifying field is **withheld (null), not masked** - the bare link proves a booking
exists, nothing about who it belongs to (founder decision 2026-07-19, tightened from the earlier
mask-to-initials approach):

| | verified: true | verified: false (bare link) |
|---|---|---|
| Guest name | Ripon Mia | withheld (row hidden) |
| Guest email / phone | shown | withheld |
| Operator email / phone (support line) | shown | withheld (row hidden) |
| Pickup address | full address | withheld |
| Card brand/last4 | visa *****4242 | withheld |
| Conversion (EUR commission) | present | withheld (business-sensitive take-rate) |
| Tour name, date, duration, free-cancel, party count, operator NAME | shown | shown (non-identifying) |
| Page extra | management actions / celebratory hero | `ThankYouVerifyNotice` card -> "Verify it's you" -> /bookings |

### Three presentations of the same booking

The verified booking renders in one of two layouts, chosen server-side; the unverified link is a
third:

- **celebratory** - the ONE-TIME "You're booked, {name}! 🌴" moment right after checkout. The
  `/payment/processing` page drops a short-lived `it.justBooked` cookie (publicRef, ~15 min) before
  redirecting; the TYP shows the green-check hero + add-to-calendar + resend, plus the cross-sell
  and apartment upsell.
- **management** - any later verified visit (via the `/bookings` login, or after the justBooked
  cookie expires). Calmer `BookingManageHeader`: a "Confirmed" status chip, "Your booking", the
  ref, and the management actions **including Cancel booking** (header button + a "Need to cancel?"
  link by the free-cancel row). No celebratory hero, no upsell - a focused booking-management page.
- **masked** - unverified shared link: the `ThankYouVerifyNotice` card + the non-identifying
  summary only. No hero, no upsell.

Cancel routes to the locale-less `/cancel/{publicRef}`, which re-checks the verified session.

Masked, never omitted: the unverified page keeps its exact shape, so the design is identical
and the real traveler immediately sees there IS more behind verification. The TYP fetch is
**uncached by design** (per-traveler data streams after `connection()`), so a verified payload
can never be cached and served to someone else.

## Scene 3 - Coming back later (the /bookings pair login)

Days later, new device, no cookie. The confirmation email holds both halves of the credential.

```
/bookings (traveler-login.tsx)
  POST /bookings/lookup { email, reference }
    - LookupRateLimiter.assertAllowed()     5 fails/email + 10 fails/reference per 15min
    - match?  no  -> recordFailure + uniform 404 (enumeration-proof)
              yes -> recordSuccess + { publicRef, displayRef, destinationSlug, sessionToken }
  saveTravelerBooking(...)                  display cookie (navbar identity)
  await storeTravelerSession(token)         HttpOnly cookie via the route handler
  router.push(returnTo ?? TYP path)
```

`returnTo` exists so a guarded surface can bounce through the login and come straight back.
It is validated against `/^\/(?:[a-z0-9-]+\/thank-you|cancel)\/[A-Za-z0-9-]+$/` - same-app
paths only, an open redirect is impossible. It is read from `window.location.search` at submit
time (not `useSearchParams`) so the login page stays prerenderable.

## Scene 4 - Cancelling (the guarded mutation)

The email's "Cancel booking" button opens `/cancel/{publicRef}` (locale-less, proxy rewrite).

```
cancel page (server)
  token   = await getTravelerSessionToken()
  booking = getThankYouBooking(ref, locale, token)

  booking.verified == false  ->  "Verify it's you first" card
                                 -> /bookings?returnTo=/cancel/{publicRef}
  booking not CONFIRMED      ->  "nothing to cancel" card
  past the free window       ->  locked no-refund copy
  else                       ->  CancelRequestCard (gets sessionToken as a prop)
                                   POST /bookings/typ/:ref/cancellation-request
                                   with X-Traveler-Session
```

Backend ordering in `requestCancellation`: load booking -> **401 unless the session owns the
contact email** -> 409 unless CONFIRMED -> stamp `utcCancellationRequestedAt` (first request
only - the refund deadline is judged on THIS instant, master 6.4) -> email admin (throws if
that fails), then best-effort traveler ack + operator notice.

Viewing rides the link; **mutating requires the session**. A leaked TYP URL can no longer get
someone's trip cancelled. Resend and calendar.ics stay link-keyed on purpose (they open from
mail clients with no session): resend only emails the STORED address, and the ICS now carries
**only tour facts - the pickup street address was stripped** (it's the exact field the TYP masks,
so a shared calendar entry must not hand it back). All three mail-sending actions
(resend / recover-reference / cancellation-request) also carry a **per-target** cap
(`TargetRateLimiter`) on top of the per-IP throttle, so a multi-IP caller can't mail-bomb one
inbox.

## Scene 5 - Sign-out and expiry

- Navbar sign-out -> `clearTravelerBooking()` clears the display cookie AND fires
  `DELETE /api/traveler-session` to drop the HttpOnly cookie.
- Tokens self-expire after 24h (login-spec session length). An expired token in the cookie is
  simply ignored by the verifier: the TYP quietly renders masked with the verify card - the
  traveler re-verifies in one form. Nothing is stored server-side, so there is nothing to clean.

## Scene 6 - The attacker's day (why each attack dies)

| Attack | What happens |
|---|---|
| Guess TYP URLs | publicRef is a UUID - not enumerable (master B.47) |
| Got a leaked TYP link | Sees the masked view: tour facts, no identity, no pickup address, no card, and every mutation 401s |
| Brute-force the pair login | Per-IP throttle + 5 fails/email + 10 fails/reference per 15min, uniform errors, silent until a uniform 429; lockout writes an ops warning |
| Probe which emails have bookings | Identical 404 body for wrong email vs wrong reference |
| Forge/tamper a token | HMAC-SHA256 over the payload, constant-time compare; any bit flip = null = masked |
| Replay a stolen token | Bounded to 24h; email-scope only unlocks bookings whose contactEmail matches, booking-scope only its one id |
| **Mint a token for a victim's email** via the checkout PATCH | Closed: that endpoint issues a BOOKING-scoped token (its own id only), so it never unlocks another booking that happens to share the email |
| Plant their own valid token in a victim's cookie (fixation) | Yields nothing: the token only unlocks the ATTACKER's own booking(s); the victim's booking still fails `sessionOwnsBooking` |
| CSRF the session route to plant/clear a cookie | `POST`/`DELETE /api/traveler-session` reject cross-site requests (`Sec-Fetch-Site` / Origin check) |
| Read the pickup address from the public calendar.ics | Closed: the ICS `LOCATION` no longer contains the street address |
| `Origin: null` credentialed CORS from a sandboxed iframe | Closed: `origin === 'null'` removed from the allow-list |
| Operator insider (legitimately sees email + reference) | The pair unlocks single-booking manage only; invoices/cross-booking history will require the email-code step-up (deferred with those features) |

---

## Where everything is managed (file map)

**Backend `backend/src/bookings/`** - single source of truth for trust:

| File | Role |
|---|---|
| `traveler-session.util.ts` | Issue (email + booking scope) + verify tokens -> claims, `sessionOwnsBooking`, PII maskers. Secret: `TRAVELER_SESSION_SECRET` (fallback `BETTER_AUTH_SECRET`) |
| `lookup-rate-limiter.ts` | `LookupRateLimiter` (per-credential login caps) + `TargetRateLimiter` (per-target mail caps); both sweep stale keys + cap map size; audit/lockout logs (in-memory; Redis when the API scales out) |
| `bookings.service.ts` | `lookupBooking` (verify pair, issue EMAIL token), `update` (issue BOOKING token on contact-email set), `getThankYou` (verified flag + masking + conversion gate), `requestCancellation` (ownership gate), `getCalendar` (no address), `resendConfirmation`/`recoverReference` (target caps) |
| `bookings.controller.ts` | Reads `X-Traveler-Session` + `@Ip`, stays thin |
| `main.ts` | `X-Traveler-Session` in the CORS allow-list; `origin === 'null'` removed |

**Frontend `frontend/`** - ferries tokens, renders both modes, trusts nothing:

| File | Role |
|---|---|
| `app/api/traveler-session/route.ts` | POST = park token in HttpOnly cookie (shape-checked + same-origin only), DELETE = clear (same-origin only) |
| `lib/traveler-session.server.ts` | Server-side cookie read for TYP + cancel pages |
| `lib/traveler-booking.ts` | `storeTravelerSession` (client -> route handler), display cookie helpers |
| `traveler-login.tsx` / `checkout-form.tsx` | The two places a token is born and stored |
| TYP page + `thank-you-verify-notice.tsx` | verified -> full page; unverified -> masked + verify card |
| cancel page + `cancel-request-card.tsx` | verified-only form; unverified -> login bounce with `returnTo` |
| `lib/api/public/fetch.ts` | `extraHeaders` on the uncached fetch only - per-user headers must never enter a `'use cache'` scope |

## Design decisions on record (founder, 2026-07-19)

1. **Bare TYP link = permanently valid, masked.** (Not full-forever, not hard expiry.)
2. **Cancellation requires the verified session.**
3. **Email-code step-up deferred** until invoices / cross-booking history exist - the session
   already covers everything v1 ships.

Deliberately NOT done: no Better Auth involvement for travelers (spec: thin endpoint over
bookings), no server-side session store (stateless HMAC + per-use ownership check + 24h expiry),
traveler surface stays on the public frontend - never the ops dashboard (three-doors isolation).
