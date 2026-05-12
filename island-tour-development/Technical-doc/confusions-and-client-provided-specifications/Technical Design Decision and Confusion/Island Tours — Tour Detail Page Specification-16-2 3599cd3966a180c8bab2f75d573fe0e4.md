# Island Tours — Tour Detail Page Specification-16-20

![](Island%20Tours%20%E2%80%94%20Tour%20Detail%20Page%20Specification-16-2/imagesce3c8ae2-ede3-4cea-86a8-bed866d1e892-1_908_796_127_132.jpg)

## Wireframe - Desktop, S2 (date picker compact)

```
Select date
```

![](Island%20Tours%20%E2%80%94%20Tour%20Detail%20Page%20Specification-16-2/imagesce3c8ae2-ede3-4cea-86a8-bed866d1e892-1_269_812_1324_137.jpg)

```
[View all dates]
```

## Wireframe - Desktop, S3/S4 (date selected)

Tue 28 May
[Change]

Departure time

![](Island%20Tours%20%E2%80%94%20Tour%20Detail%20Page%20Specification-16-2/imagesce3c8ae2-ede3-4cea-86a8-bed866d1e892-1_259_595_2074_132.jpg)

```
Total: €240 [See price breakdown]
```

[ Continue ]

222 travelers

## Wireframe - Mobile

In-flow widget identical to desktop S1 in single-column. Sticky bottom bar appears once user scrolls past:

```
← STICKY BOTTOM CTA →
| From €120 • ✓ Free cancel |
| [ Check availability → ] |
```

Tap sticky bar → smooth-scroll to in-flow widget AND open date picker.

## Date picker - chip component

Custom component. Never native OS pickers (they underperform on conversion).

| Aspect | Spec |  |
| --- | --- | --- |
| Compact view | Horizontal-scrolling row of date chips, initial position = today |  |
| Chip content | day-of-week, date, price-from, availability indicator |  |
| Chip states | available / sold_out /closed_day / cutoff_passed / selected |  |
| Expanded view | “View all dates” → full-month calendar overlay; locale-aware day order; prev/next month controls |  |
| Forward window | 12 months max (operator may limit per tour) |  |
| Live data | Compact view = cached availability; expanded view = live API call for the requested month; time slots fetched on date select |  |
| Loading UX | 200 ms skeleton; >1s timeout → error state with retry |  |

Booking cutoff: per-tour CMS field tour .booking_cutoff_minutes. Default 120 ( 2 hours); accepts 0-10080 (zero-minute to one week). Operators with the logistics for it can offer zerominute cutoffs (cruise-day-tripper segment is high-value on Curaçao). After cutoff, chip shows “Closed.”

## Time slot picker

Appears after date selected, only for tours with multiple departures per day.

| State | Display |
| --- | --- |
| Normal | 8:00 AM |
| Low capacity (<5 spots) | 1:00 PM / Only 2 left (real, never fake) |
| Sold out | 4:00 PM / Sold out (greyed) |

Single-departure tours: time-slot picker doesn’t render. Departure time surfaced in confirmation email.

## Party size selector

Default: 2 travelers. +/- controls. Min/max from tour CMS.

| Variant | Display |
| --- | --- |
| Standard | Single counter, min 1, max per tour . max_party_size |
| Age-banded | Sub-rows: Adults / Children / Infants - labels and ranges per tour, each with own +/- and price |
| Per-vessel / pergroup | Counter informational only; price doesn’t multiply |

Constraints surfaced inline: “This tour needs at least N travelers - bring more, or try the smaller-group version” (with link to related smaller-group tour if one exists).

## Pricing display (LD12)

- Initial: From €X per person (lowest all-in across configurations)
- After date + party: Total: €X (exact, all-in, taxes included)
- “See price breakdown” expands inline:
- Adults × $\mathrm{N} \times € \mathrm{X}$
- Children × $\mathrm{N} \times € \mathrm{X}$
- Hotel pickup × N (if selected)
- Subtotal•Total

Total-price-before-checkout rule (LD12): non-negotiable. Total visible before user enters payment. No fees revealed only at checkout.

Currency: EUR for EN/NL/DE/FR/ES/PT; USD for ZH.

## Add-ons step

Appears after date + time + party, before “Continue” - only for tours with at least one configured add-on.

- Each add-on as opt-in card. Never pre-checked (EU Digital Fairness Act).
- Card content: name, brief description, price, +/- quantity, opt-in toggle
- Adding/removing updates total inline
- Examples: hotel pickup, snorkel mask rental, drinks package, photo package, towel rental
- Brand voice on add-on names: short, specific. “Hotel pickup” not “Transportation supplement.” “We pick you up from your hotel” not “Round-trip ground transportation included.”

## CTA copy (LD2)

| Stage | Mental state | CTA |
| --- | --- | --- |
| Detail page in-flow + sticky | Browsing | Check availability |
| After date selected | Transitioning | Continue |
| Final checkout | Committed | Secure your spot |

The neutral “Continue” mid-stage prevents the emotional jolt of jumping from low- to highcommitment in one click.

## Trust strip (LD5)

Persists across all widget states. Does not appear inside date-picker overlay or modals - its job is to underwrite the booking decision and is most needed when the CTA is in view.

```
\checkmark Free cancellation up to 24h
v Reserve from 20%, pay the rest later
V Confirmed in seconds
    Chat 24/7 ' WhatsApp 08:00-22:00
```

## Sticky behavior

| Surface | Behavior |
| --- | --- |
| Desktop in-flow → pinned | position: sticky triggered at gallery’s bottom edge. Pin offset = top of viewport + nav-bar height. |
| Desktop pinned → release | Releases above closing trust block to avoid overlap |
| Mobile in-flow widget | Appears once, after Highlights |
| Mobile sticky bottom bar | Appears when in-flow widget passes above viewport; disappears when in-flow reenters. Three elements only: price, free-cancel micro-copy, primary CTA |

Edge cases
| Case | Behavior |
| :— | :— |
| Sold-out date selected | Inline: “Sold out - try another date.” Auto-suggest next available with one-tap apply |
| All visible dates sold out | “No spots open in next 30 days. Want us to message you when one opens?” + email-only “Email me when there’s room” CTA |
| API failure on availability fetch | “We’re having trouble loading dates. Refresh, or message us on WhatsApp.” Retry button + WhatsApp deep link |
| Network offline | Widget greys, cached availability shown tagged “may be out of date.” Continue disabled until network returns |
| Cutoff passes during user session | Today chip transitions live to “Closed.” If today selected: “Today’s bookings just closed. Pick another date.” |
| Race condition (sells out between selection and continue) | Final availability check on “Continue” tap. If gone: “This time just sold out — try another?” with date kept and time slots refreshed |
| Min party not met | Constraint surfaced inline; brand-voice copy with link to smallergroup alternative |
| Unit-priced tour | Counter informational. Pricing: From €450 per group ⟶ Total: €450 (up to 8 people) |
| Multi-variant tour (shared vs. private) | Variant selector at top of widget. Selecting resets date + time selection (different inventory) |

## Hydration timing