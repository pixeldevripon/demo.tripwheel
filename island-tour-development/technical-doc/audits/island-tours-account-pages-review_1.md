# Island Tours, Account Pages Review (traveler "Your bookings" area)

Version 1.7, July 29, 2026. Review of the dev build of the logged-in traveler account area (bookings list plus payments list, three build screenshots). Checked against master v1.17 (6.2/6.4/6.5, E.8, conflict log 82/84/85/87 to 90/94), island-tours-login-design-spec.md, and design language v2 tokens. **island-tours-account-pages-final.html in this folder is the build reference**; this document is the why, the copy, and the checklist. Changelog in section 9.

Scope: the account area only. The per-booking page behind "View booking" and the login door (canonical in the login design spec) are out of scope.

---

## 1. Verdict

Good skeleton, wrong priorities: right chrome and real E.8 fields, but organized like an admin table. No time-based triage, no logistics, no refund story, plus two spec conflicts (implied balance knowledge on operator_link, and one booking rendering as both cancelled and cancellation-requested). All fixable as a re-skin plus reorder, not a rebuild.

## 2. What already works, keep it

Design v2 nav and card chrome; per-booking amounts in `original_currency` (E.8), never converted; middot meta rows (3.4); cancellation as a request, not an instant action (6.4); the agentless deposit framing (becomes operator-named per F9); the free-cancellation line having a date (format fixed per F10); the visible booking reference (format fixed per F11).

## 3. Findings

Severity: **B** blocker (violates a locked decision or the state model), **H** high (wrong priority or missing core content), **P** polish.

| # | Sev | Problem | Fix | Anchor |
|---|---|---|---|---|
| F1 | B | One booking shows chip "Cancelled" AND "cancellation requested, we will email you" copy. Until the admin confirms, nothing is cancelled and no money has moved | Distinct `cancellation_requested` state with own chip and copy (5.6); "Cancelled" only after admin confirmation | 6.4 v1 flow |
| F2 | B | No refund visibility anywhere: three cancelled bookings hold paid money, panels and Payments show only "Succeeded" | Cancelled bookings render the locked model-aware refund copy (5.5); Payments gets refund rows with status (5.7) | 6.4 locked copy |
| F3 | B | "Paid so far" plus "Remaining balance" implies live balance knowledge; v1 cannot know the operator_link balance state. Cancelled bookings still show a balance | Drop "Paid so far" entirely; payment box is model- and status-aware per 5.5; operator_link lines stay neutral and deadline-focused | conflict log 84/85, 6.2, 6.7 |
| F4 | B | Cross-booking view holding payments and PII, but no step-up, no session indicator, no logout | Email-code step-up gates this route (pair alone = single booking); 24h session; signed-in row with masked email plus Log out | login spec 2.4.5, O2 |
| F5 | H | Stat tiles: "Trips booked 4" contradicts tab "Bookings 8", and "Total paid $1,923.38 + €155.48" sums currencies | Delete all three tiles; header slot becomes the next-trip module (5.2); never sum across currencies | 1.3 |
| F6 | H | Flat unsorted list; cancelled cards at full weight; next trip sits fifth | Group Upcoming / Past / Cancelled per 5.3; cancelled collapsed and muted | |
| F7 | H | Zero logistics: no meeting point, pickup, be-ready line, duration | Panel mirrors confirmation email block 3, with the 4.4 arrival buffer | 6.5 |
| F8 | H | "travellers" is en-GB; "1 travellers" is a plural bug | US "traveler(s)" via next-intl pluralization | 4.3 locked |
| F9 | H | operator_link copy is agentless post-booking and has no balance deadline; that is the C2 anti-phishing job | "{operatorName} will email you a payment link... Pay before {Day, DD Mon, HH:MM} (local time)." plus the locked anti-fraud line. **Never a Pay button in the account area** (payment links live only in the operator balance email) | 1.4 two-phase, TYP step 2, 6.7 |
| F10 | H | "Free cancellation until 12 Aug 2026. Ask before then..." lacks time of day and "(local time)", and is off-voice | "Free cancellation until Wed 12 Aug, 07:00 (local time). Full refund, no forms, no questions asked." | 4.4, 6.3 locked family |
| F11 | H | Refs like IT-2026-BF4CC1B6: 8-char hex with ambiguous characters | Wire the E.8 display_ref generator (IT-2026-XXXXX, ambiguity excluded); it is also the login and check-in credential | E.8, LD4 |
| F12 | H | Two affordances per card ("View booking" button plus "Details" link) doing the same job | Whole card header toggles the inline panel; quiet "Open booking page" link inside | |
| F13 | H | "Your account": travelers have no accounts (no passwords, auto-created) | H1 "Your bookings", matching the login door H1 and the footer link | 6.4, login spec |
| F14 | H | Payments tab is a stub: generic "Card", no refunds, no statement note | Brand plus last4 (E.8), refund rows, Site Bar B.V. recognition line (the top chargeback preventer) | conflict log 94 |
| F15 | P | Chips off-system (orange "Deposit paid" reads as warning) | Status chips white with ink label, hairline, state dot; payment chips green-tint or paper | DIT-7 |
| F16 | P | Dates without weekday | "Fri 14 Aug 2026 · 07:00"; TYP already uses "Pay before {Day, Date}" | |
| F17 | P | Empty and edge states missing | Copy set in 5.9; empty state per the GAP-07 pattern | |
| F18 | P | No help path on the page | Two layers: per-booking support row (5.8, added in the v1.1 pass) plus one page-level NeedHelp block; nothing else | 6.6 |
| F19 | P | Deposit $41.70 on $181 is 23%, no LD24 rate (deposit_pct = tier commission, 20 to 35) | Verify the snapshot logic; likely test data | LD24 v1.17 |
| F20 | P | Emoji/icon drift risk on payment rows | Lucide family only, no emoji ever | LD20 |

## 4. Redesign in one view

Page = **Your bookings**. Order: header (H1, sub, signed-in row) → next-trip module → tabs Bookings | Payments → Upcoming, Past, Cancelled (collapsed) → NeedHelp block → footer. Card: thumb, title, "Fri 14 Aug · 07:00 · 1 traveler · Curaçao", status plus payment chip, total in original currency, reference; expands to Tour details, Payment box (5.5), Cancellation box (5.6), support row, booking-page link. Payments = ledger (5.7). final.html renders all of it on the dev's own test data (plus one past operator_full booking and one on_arrival conversion for four-model coverage).

## 5. Redesign specification

### 5.1 Page identity and chrome

| Item | Value |
|---|---|
| H1 | "Your bookings" (F13) |
| URL, rendering | island.tours/bookings, SSR never cached, noindex follow, no locale prefix (login spec 2.1) |
| Chrome | Full site nav and footer; only the login door keeps takeover chrome |
| Session row | "Signed in as {maskedEmail} · Log out", top right (F4) |
| Access | Pair login = single booking page; this cross-booking area sits behind the email-code step-up (O2, v1) |

### 5.2 Next trip module (replaces the stat tiles)

Soonest upcoming confirmed booking, rendered once, removed from the list below. Kicker "Next trip · in {n} days" (plain, no countdown theater), photo, title, meta row, logistics line with be-ready buffer (4.4) and Maps link, chips, one model-aware payment line, short cancellation status line. Actions: "View details" (expands the standard panel) plus proposed "Add to calendar". No WhatsApp button up here (founder decision: support entry points sit lower, per-booking support row and NeedHelp block, lowering inbound pressure; matches the 6.6 spirit). No upcoming bookings: module collapses, see 5.9.

### 5.3 Grouping and sort

| Group | Contents | Sort | Weight |
|---|---|---|---|
| Upcoming | confirmed, future start | start ascending | full cards |
| Past | completed | start descending | compact |
| Cancelled ({n}) | cancellation_requested first, then cancelled | date descending | collapsed by default, muted |

Tab badges count real rows ("Bookings 9 · Payments 11"); no second counting system (F5).

### 5.4 Booking card anatomy

Collapsed row: thumb, title, meta, chips, total plus reference (tabular numerals); whole row toggles the panel, aria-expanded wired (F12). Expanded: (1) Tour details: date and time (24h, weekday), party, meeting point or pickup with be-ready line and Maps link, duration, booked on, reference, check-in row "This reference plus a photo ID" (LD4). (2) Payment box per 5.5. (3) Cancellation box per 5.6; "Request cancellation" opens an inline confirm strip ("Cancel {tour}, {Day, DD Mon}? Refund {amount}.", refund line only above zero), confirm submits the 6.4 manual request and swaps the chip. (4) Support row per 5.8, then quiet "Open booking page" link.

### 5.5 Payment box matrix (model x state)

TYP vocabulary: Total / Deposit paid / Remaining balance. Never "Paid so far" (F3). Zero-amount rows hidden (conflict log 82). **No Pay button on any model** (F9).

| payment_model | Upcoming (confirmed) | Cancelled |
|---|---|---|
| operator_link | Total, Deposit paid {amt} ({pct}%), Remaining balance {amt}. "{operatorName} will email you a payment link for the remaining balance. Pay before {Day, DD Mon, HH:MM} (local time)." After the window (never an unpaid claim, conflict log 84/85): "Remaining balance {amt}, settled through {operatorName}'s secure payment link." Plus locked anti-fraud line (section 6) | Total, Deposit paid, then locked 6.4: "Your {X}% deposit is on its way back from us, within 3 to 5 business days, to your original payment method. If you've already paid the balance, the tour operator refunds that part. Don't see your balance refund within {N} days? Message us and we'll chase it." |
| on_arrival | Same rows. "Pay the rest on arrival, {card or cash / cash only, per tour}." (locked C23 family) | Same refund line as operator_link (deposit models share it) |
| paid_in_full | One line "Paid in full {amt}", green-tint, no balance row | Total, then locked: "Your payment is on its way back from us, within 3 to 5 business days, to your original payment method." |
| operator_full | "Island Tours took no payment. Total {amt}, settled directly with {operatorName}." (C23 TYP line minus "today", proposed) | Locked: "Nothing was paid to Island Tours. Already paid the operator? Then the operator refunds you directly." |

Refunds show progress, not promises: "on its way" until marked refunded, then "Refunded {date}", mirrored as a Payments entry (5.7).

### 5.6 Status model and chips

Fills in E.8's "further states" for dev alignment. One state per booking, always.

| Status | Chip | Card copy anchor |
|---|---|---|
| confirmed | green dot, "Confirmed" | free-cancellation or after-window line (section 6) |
| completed (derived) | gray dot, "Completed" | nothing required |
| cancellation_requested | amber dot, "Cancellation requested" | "Requested {Day, DD Mon, HH:MM}. We'll email you once it's processed. Your request arrived inside the free-cancellation window, so the {amt} you paid us comes back in full once processed." |
| cancelled | gray dot, "Cancelled" | refund copy per 5.5 |
| operator_cancelled | gray dot, "Cancelled by operator" | "The operator had to cancel. You're covered: a full refund or a free reschedule." (6.3 family) |
| forfeited | gray dot, "Booking closed" | copy to be locked with founder first, open item 9b |
| pending_payment | never listed | transient processing state |

Chips per DIT-7: status = white, ink label, hairline, state dot; payment chips ("Deposit paid", "Paid in full", "No payment taken") green-tint or paper.

### 5.7 Payments tab (ledger)

Row: type (Deposit / Full payment / Refund), tour, trip date, brand plus last4, amount (refunds signed, green), status chip (Succeeded / On its way / Refunded {date}), reference, date. Top: the Site Bar recognition line (section 6). Refund rows appear the moment the admin marks cancelled; the refund is created via the Stripe API and its status ("On its way", "Refunded {date}", failure alert to ops) syncs from Stripe webhooks on Site Bar's account (C23 settlement rails), never by hand. IT-side money only; operator balance refunds stay untracked (6.2). Optional per-currency subtotal chips, never a cross-currency sum. Receipts and invoices: out of v1, open item 9a.

### 5.8 Support (two layers, nothing else)

1. Per active booking, one support row in the panel: "Questions about the tour? {operatorName} · {operatorPhone} · {operatorEmail}" plus "Questions about your booking? WhatsApp us". The confirmation email's Block 8 pair, operator first (5.9 TYP order, 1.4 two-phase); "the day" became "the tour" (founder: tour vs booking is the true contrast; "the day" misroutes date-change questions to the operator). Not on cancelled or past cards.
2. Page level, both tabs: NeedHelp block "Questions about a booking? WhatsApp us, Mon to Sun 08:00 to 20:00.", one wa.me button (6.6).

The anti-fraud line renders only inside the operator_link payment box.

### 5.9 States not demonstrated in the mockup

- Empty: H "No trips yet", B "When you book a tour, it lands right here, with your payment details and cancellation window.", CTA "See all Curaçao tours" (GAP-07 pattern).
- Past-only: no next-trip module, no Upcoming header, Past leads.
- operator_cancelled, forfeited: per 5.6.
- Payments empty: "No payments to Island Tours yet. Tours on which the operator collects payment directly don't show entries here."

### 5.10 Build requirements

- Step-up gate (O2), 24h session, fresh session id, `__Host-` cookies, logout visible (login spec DoD).
- SSR never cached; noindex follow; out of sitemaps.
- All strings via next-intl (1.5); traveler/travelers pluralization per locale; reference placeholder never localized.
- display_ref from the E.8 generator.
- No new dataLayer events without spec; never the reference in the dataLayer (login spec 2.5).
- Locked strings verbatim; anything marked proposed goes through Denley before lock.

## 6. Copy set (EN source, next-intl keys)

| Slot | Copy | Origin |
|---|---|---|
| H1 | Your bookings | login spec |
| Sub | Every trip you've booked with us, and every payment on it. | proposed |
| Signed-in row | Signed in as {maskedEmail} · Log out | proposed |
| Next-trip kicker | Next trip · in {n} days / · tomorrow / · today | proposed |
| Section headers | Upcoming · Past · Cancelled ({n}) | proposed |
| Free cancellation (before window) | Free cancellation until {Day, DD Mon, HH:MM} (local time). Full refund, no forms, no questions asked. | 6.3 locked family |
| After window | Free cancellation ended {Day, DD Mon, HH:MM} (local time). If the operator has to cancel, you're covered: a full refund or a free reschedule. | 6.3 locked family |
| Cancel confirm strip | Cancel {tour}, {Day, DD Mon}? Refund {amount}. / Yes, request cancellation · Keep my booking | 6.4 pattern; refund line only above zero |
| Request submitted | Cancellation requested. We'll email you once it's processed. | 6.4 flow |
| Balance deadline (operator_link) | {operatorName} will email you a payment link for the remaining balance. Pay before {Day, DD Mon, HH:MM} (local time). | TYP step 2, locked |
| Anti-fraud | We'll never ask for card details by reply, text, or phone. Always pay through the link in your booking emails. | 6.5 block 6, locked |
| Statement note | Payments to Island Tours can appear on your card statement as Site Bar B.V., our payment partner. | conflict log 94, proposed |
| NeedHelp | Questions about a booking? WhatsApp us, Mon to Sun 08:00 to 20:00. | 6.5 block 8 hours |
| Support row | Questions about the tour? {operatorName} · {operatorPhone} · {operatorEmail} / Questions about your booking? WhatsApp us | 6.5 Block 8 pair, day to tour per founder; email header follows via conflict log (9d) |
| Check-in row | Check-in: this reference plus a photo ID | LD4 on-surface, proposed |
| Maps link | Maps | 6.7 pattern |
| Add to calendar | Add to calendar | proposed, optional v1 |
| Book again (completed) | Book this tour again | proposed, optional v1 |
| Refund copy | per 5.5 matrix | 6.4 locked |

## 7. Decided choices (veto round, July 29)

All four per recommendation: (1) name "Your bookings", not "Your account"; (2) next-trip module replaces the stat tiles; (3) Payments tab stays, upgraded to a real ledger; (4) cancelled bookings collapse at the bottom, no filter chips.

## 8. Acceptance checklist (for the build)

1. One state per booking; never cancelled and requested copy together (F1).
2. Every cancelled booking with money paid renders the locked model-aware refund copy; Payments shows a matching refund row (F2).
3. No implied operator_link balance state; no "Paid so far"; no Pay button anywhere (F3, F9).
4. Step-up, 24h session, visible logout, SSR never cached, noindex (F4).
5. No cross-currency sums anywhere (F5).
6. Groups and sort per 5.3; cancelled collapsed by default (F6).
7. Panel shows meeting point or pickup plus be-ready line per 4.4 (F7).
8. "travelers" US spelling, plural correct in all locales (F8).
9. Every money deadline renders "{Day, DD Mon, HH:MM} (local time)" (F10).
10. display_ref IT-2026-XXXXX from the E.8 generator (F11).
11. One expand affordance per card (F12); H1 "Your bookings" (F13).
12. Payments rows show brand plus last4; Site Bar line present (F14).
13. Chips per DIT-7; AA contrast; 44px touch targets (F15).
14. Sweeps: em-dashes 0, en-dashes 0, LD9 banned words 0, no emoji (4.2, LD20).
15. All strings through next-intl; reference placeholder never localized.
16. Active bookings render the support row (operator first, WhatsApp fallback); meeting-point rows carry the Maps link (F18).
17. Upcoming bookings show the check-in row (LD4); still no voucher, QR, or download anywhere.
18. Refund status comes from Stripe webhooks (created / succeeded / failed), no manual status field (5.7).

## 9. Files, open items, changelog

- **island-tours-account-pages-final.html**: interactive build reference, this folder. Design v2 tokens, MCK-family nav rendered statically, demo data mirroring the dev's test set (plus one past operator_full booking and one on_arrival buggy tour for four-model coverage; refs, deposits, contact details corrected or placeholder, see its dev notes). Real register tours (titles per the approved content packages) and real media-system frames as small inline previews; production loads placement sizes through the media pipeline.
- Open items for founder: (a) receipts/invoices need an invoice template spec first; (b) forfeited-state copy to be locked; (c) upsell block deliberately excluded from this surface in v1, revisit post-launch; (d) confirmation email Block 8 header "Questions about the day?" to become "Questions about the tour?" (one-word conflict-log entry at master fold-in) so email and account route identically.
- Master fold-in (proposed, NOT applied): new 5.13 or 6.4 extension referencing this review as deep source; E.8 status enum per 5.6; conflict-log entries for the adapted C23 line (5.5) and 9d. Registry untouched.
- Working agreements honored: English deliverables, no em-dashes, locked copy verbatim and marked, proposals marked proposed.
- Changelog: v1.0 initial review and redesign · v1.1 OTA pass (section 10) · v1.2 WhatsApp button off the next-trip module (founder) · v1.3 support row reuses the email Block 8 pair, "Running late" dropped (founder) · v1.4 "the day" to "the tour" (founder) · v1.5 compacted for dev handoff, version header and support-row cross-references repaired, no decision changes · v1.6 refund status synced from Stripe webhooks, 5.7 and checklist 18 (founder) · v1.7 demo filled with real register tours and real media-system photos (founder).

## 10. OTA benchmark (v1.1 pass, updated through v1.4)

Benchmarked against GetYourGuide, Viator, Booking.com, Airbnb (Experiences), Klook.

### 10.1 Benchmark

| Pattern | Large OTAs | This design | Verdict |
|---|---|---|---|
| Area name | "My Bookings" (GYG, Viator, Klook); "Trips" (Booking, Airbnb) | "Your bookings" | Keep: tours-OTA convention plus login-door continuity |
| Next trip first | Grouped lists; apps push reminders | Next-trip module on web | Keep; ahead of baseline (zero taps to logistics) |
| Voucher / QR | Core pattern everywhere | None by design (LD4: reference plus ID; the email is the ticket) | Keep exclusion; the check-in row says it on-surface |
| Operator contact on booking | Standard (GYG shows supplier phone) | Support row added (5.8) | Parity reached |
| Map link | Standard | Maps link added | Parity reached |
| Add to calendar | Common | Proposed, needs .ics endpoint | Optional v1 |
| Book again | Standard rebook affordance | Proposed quiet link on completed trips | Navigation, not upsell; calm-surface decision stands |
| Self-service date change | GYG allows inside free-cancellation window | Not in master; v1 = cancel plus rebook | Top V2 item (10.4) |
| Payments ledger | None of them has one | Kept deliberately | Deposit split, Site Bar descriptor, and manual v1 refunds create "where is my money" questions the big OTAs do not have |
| Refund visibility | Per booking | Per booking plus ledger | Ahead of baseline |
| Pay now / card on file | Viator has it | Never (6.7 lock) | Locked anti-phishing decision, not a gap |

### 10.2 Added in the pass (in final.html)

1. Support row per active booking (5.8; wording history in the 9 changelog).
2. Maps link on meeting-point rows (not on pickup rows).
3. Check-in row (LD4 made visible).
4. Add to calendar and Book this tour again, both proposed, both single quiet affordances.

### 10.3 Cut

Hero cancellation sentence de-duplicated (status line in body, full sentence in panel); dead CSS removed. Considered and rejected: voucher/QR, repaired stat tiles, per-card support blocks, review-request CTA (wire it when the review-strategy build lands, 10.4).

### 10.4 V2 roadmap (priority order)

1. Self-service date change inside the free-cancellation window (needs E.9 availability read, operator notification, conflict-log entry).
2. Review-request hook on completed trips, once the first-party review build lands.
3. Conditional weather line on `weather_dependent` tours (6.7 pattern) inside 48h of start.
4. Pagination for Past beyond roughly 12 trips; Upcoming never paginates.
