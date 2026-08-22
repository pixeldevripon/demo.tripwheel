---
name: typ_rebuild_and_checkout_restyle
description: Security pass on TYP design-v2 rebuild (commit 5167a1e) and the checkout accordion restyle (uncommitted, 2026-08-01) — no confirmed findings, records the safe patterns worth reusing
metadata:
  type: project
---

Reviewed 2026-08-01: TYP hero/summary/next-steps/recommendations/question rebuild
(commit `5167a1e`, add-to-calendar dropdown + `buildIcsUrl`/`buildOutlookCalendarUrl` +
`renderTemplate` helper) and the uncommitted checkout accordion restyle (split first/last
name, unified payment-method list, `freeCancelLabel` threading). Zero confirmed
vulnerabilities in either diff — both are visual-only or additive-safe.

**Why this is worth remembering:** these two diffs establish two reusable safe patterns
that recur across the frontend, worth checking future diffs *conform to* rather than
re-deriving from scratch:

1. **`renderTemplate` (`components/frontend/thank-you/render-template.tsx`)** — splits a
   dictionary string on `{token}` and swaps in ReactNodes via `Fragment`, never
   `dangerouslySetInnerHTML`. This is now the correct pattern for "bold a name inside
   translated copy" anywhere in the app; a future diff that reaches for
   `dangerouslySetInnerHTML` to do the same thing should be flagged.
2. **Card state never grows.** `checkout-payment.tsx`'s `card` state is `{ postal, name }`
   only — number/expiry/cvv live exclusively inside Stripe `CardNumberElement` /
   `CardExpiryElement` / `CardCvcElement` (Mollie mirrors this with its own Components).
   Any future PR that adds a card field to local React state instead of an Element is a
   PCI-scope regression — check for this specifically when touching payment components.

**How to apply:** when checkout or TYP components are touched again, diff against these
two invariants first (dangerouslySetInnerHTML count stays zero; `card`/equivalent payment
state stays PAN-free) before doing a full line-by-line pass.

**One informational-only note, not a finding:** `buildIcsUrl` in `lib/thank-you/thank-you.ts`
interpolates `booking.publicRef` into the `.ics` URL path without `encodeURIComponent`,
while the sibling `getTypByRef` fetch (`lib/api/public/bookings.ts`) does encode it. Not
exploitable — `publicRef` is a backend-generated UUID (booking-flow guide: "the unguessable
UUID already in the TYP URL"), never raw user input, so no traversal/injection is actually
reachable. Flagged only for stylistic consistency if anyone is doing cleanup; do not
re-flag as a vulnerability.

**Masked/verified TYP boundary held up.** `guestLead`, `operatorEmail`, `operatorPhone`,
`pickupLabel`, `payment.cardLabel` are all still gated on truthiness (`booking.x && (...)`)
per-field in the restyled `thank-you-summary.tsx` / `thank-you-question.tsx` / new hero meta
line — the restyle added an operator/pickup/party "meta" line to the hero
(`thank-you-hero.tsx`) but it reuses the same `ThankYouBooking` fields the summary already
gates on, so no new leak class was introduced. Backend-side masking (whether `typ.pickupAddress`
etc. are actually withheld for `verified: false`) is out of scope for the frontend and was
not re-verified here.
