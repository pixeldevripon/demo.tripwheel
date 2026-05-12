# Island Tours — Tour Detail Page Specification-1-8

## Island Tours - Tour Detail Page Specification

Section 4.7 of the Island Tours UI/UX briefing. This document is the design and engineering source-of-truth for the tour detail page - the conversion bottleneck of the platform. Sections 4.7.1-4.7.8 are spec’d below; 4.7.9-4.7.28 are referenced in the composite wireframe so the pagelevel layout is unambiguous.

All choices are 2025/2026 CRO and AEO research-backed (Bookeo, Baymard, ConvertCart, GetYourGuide product releases, Airbnb Q4 2025 results, Viator API). Citations available on request - they have been removed from the spec body to reduce noise.

## 1. Foundations

### 1.1 URL pattern

## /{locale}/{destination}/{hub-slug?}/{tour-slug}/

- Hub-anchored://en/curacao/klein-curacao/miss-ann/
- Destination-only://en/curacao/sunset-cruise-bluefinn/

Locale-prefix subdirectories with English slugs throughout (Viator pattern). Slug registry resolves URL → entity.

### 1.2 Rendering

- Server-rendered: page shell, above-the-fold content, structured data (for SEO, AEO, LCP)
- Client-hydrated: booking widget, deferred via requestIdleCallback after LCP
- Live data: availability fetched on date-picker open (not on page load)
- ISR:300-second revalidation for static blocks; live data refreshed per page view

### 1.3 Performance budget

| Metric | Target | Notes |
| --- | --- | --- |
| LCP | <2.5s | Hero image is LCP candidate, preloaded via<link  rel=“preload”> |
| INP (page) | $<200 \mathrm{~ms}$ | Standard interactions |
| INP (booking widget) | $<100 \mathrm{~ms}$ | Date-picker, party-selector, time-slot - half the page target |
| CLS | <0.05 | Stable heights everywhere; no layout shift on hydrate |

Mobile-first. $\sim 80 \%$ of traffic is mobile; mobile sessions average $2: 20$; one second of delay $=\sim 7 \%$ conversion loss.

### 1.4 What this page does

Convert “I think I want this tour” → “I am booked.” Three user states served:

| State | Mindset | Primary need |
| --- | --- | --- |
| Ready-tobook | “I know which tour I want.” | Frictionless date + party + continue |
| Comparing | “One of several options.” | Distinguishing details: host, beach access, group size, real reviews |
| Researching | “Not sure yet.” | Trust signals, reviews, free-cancel reassurance, host credibility |

Architecture: booking-first, editorial-supporting. The booking widget is always one tap away on mobile and always visible on desktop. Editorial content earns the user’s attention without standing between the user and the CTA.

The single biggest architectural decision: kill the legacy 24 -hour enquiry model and replace it with instant confirmation. Without this, every other improvement is theatre.

## 2. Decisions

### 2.1 Locked decisions

Binding for design and engineering. Override only by chat.

| # | Decision |
| --- | --- |
| LD1 | Cancellation default: $\mathbf{2 4 h}$ before tour, free cancellation. Per-tour overrides allowed. |
| LD2 | CTA progression matched to mental state: discovery = Check availability ⋅ transitional = Continue $\cdot$ checkout $=$ Secure your spot. |
| LD3 | “Pickup” - no hyphen. Locked platform-wide. (Tour Card spec needs parallel update.) |
| LD4 | Bookings deliver an email confirmation that doubles as the entry pass. No scannable mobile ticket, no QR, no app dependency. The booking IS the ticket. |
| LD5 | Booking widget trust strip is exactly four lines, in order: (1) Free cancellation up to $24 \mathrm{~h} \cdot(2)$ Reserve from 20%, pay the rest later • (3) Confirmed in seconds • (4) Chat 24/7 • WhatsApp 08:0022:00. |
| LD6 | Closing trust block ends with the tagline as a sign-off in its closing form: Built by Islanders. |
| LD7 | Quick-info row = exactly 3 badges (Duration, Pickup, Languages). Universal facts go in the trust strip, not here. |
| LD8 | Mobile breadcrumbs visible on tour detail page (deliberate divergence from destination-page spec, which hides them on mobile). Cross-reference both specs. |
| LD9 | All copy follows the Brand Voice Bible. Banned-words list applies platform-wide (paradise, luxury, exclusive, seamless, world-class, discover-as-verb, unlock, adventure-awaits, committedto). |
| LD10 | Real Curaçao operator names in spec examples only (Miss Ann, Powerboat, BlueFinn). |
| LD11 | Provider Rating cold-start. When a tour has <3 native reviews AND its operator has $\geqslant 10$ reviews + $\geqslant 4.0$ average across all their tours, display the operator-aggregate rating with explicit attribution (“From this host’s N reviews across all tours”). Otherwise hide the rating row entirely. |
| LD12 | Total-price-before-checkout rule. The total the user will pay is always visible in the booking widget before they enter any payment information. All fees itemized. No surprises at checkout. Regulatory commitment, not a CRO choice. |

### 2.2 Open decision (one)

RNPL pivot. Current default: ” $20 \%$ deposit at booking, balance due before tour.” Industry direction (Airbnb 70% Q4 2025 adoption, GYG and Viator both shipped) is true Reserve Now Pay Later - $€ 0$ today, full payment $48 \mathrm{~h}-7 \mathrm{~d}$ before. Pivoting changes trust strip line 2 copy and the cancellation block. Currently spec’d at 20%; flip to RNPL by chat to update.

### 2.3 CMS data model — fields used in 4.7.1-4.7.8

| Field | Type | Notes |
| --- | --- | --- |
| tour.h1_override | string (nullable) | Override for awkward template-generated H1s |
| tour.breadcrumb_label | string | Short-form for breadcrumb last segment when H1 &gt; 35 chars |
| tour.duration_minutes | int | Drives duration badge formatter |
| tour.pickup_model | enum | included / paid_addon / none |
| tour.languages[] | string[] | Language codes; rendered via locale lookup |
| `tour.gallery_images[]` | array | Ordered; first marked is_hero: true; supports manual focal-point per image |
| tour.overview_{locale} | markdown | Paragraph breaks only — no headings, lists, or bold |
| tour.highlights_{locale}[] | string[] | 3–6 items, 5–15 words each |
| tour.pricing_model | enum | per_person / unit |
| tour.unit_type | enum (nullable) | If unit: group / boat / vehicle / aircraft / package |
| tour.max_party_size | int | Tour capacity ceiling |
| tour.min_party_size | int | Default 1; some tours require 4+ |
| tour.age_bands[] | array (nullable) | When age-banded pricing applies |
| `tour.booking_cutoff_minutes` | int | Default 120; range 0–10080 (0 minutes to 1 week) |
| tour.cancellation_hours | int | Default 24; per-tour override |
| tour.add_ons[] | array (nullable) | Optional extras shown at booking step |

Operator-level (parent entity):

| Field | Type | Notes |
| --- | --- | --- |
| operator.aggregate_rating | float (computed) | Used for Provider Rating fallback (LD11) |
| operator.aggregate_review_count | int (computed) | Provider Rating threshold check |

## 3. Composite wireframes

### 3.1 Desktop ( $\boldsymbol{\geqslant} \mathbf{1 2 8 0} \mathbf{p x}$ )

Two-column. Left: content. Right: booking widget (in-flow → pinned-sticky → released above closing block).

NAV BAR (sticky)

| | Breadcrumbs | $\mid$ |
| --- | --- |
| $\mid$ H1 |  |
| $\mid \star$ rating • review count | $\pi \mid$ |

|  |  |  | BOOKING WIDGET (in-flow) Price Date prompt Party selector Check availability Trust strip (4 lines) |
| --- | --- | --- | --- |
| QUICK-INFO BADGES (3) |  |  |  |
| fold (~900px) |  |  | pinned-sticky |
| Tour Overview |  |  | [widget pinned] |
| Highlights |  |  |  |
| What’s Included / Not  Itinerary |  | (4.7.9) |  |
|  |  | (4.7.10) |  |
| Meeting + Pickup |  | (4.7.11) |  |
| What to Bring |  | (4.7.12) |  |
| Know Before You Go |  | (4.7.13) |  |
| Accessibility |  | (4.7.14) |  |
| Languages |  | (4.7.15) |  |
| Cancellation Policy |  | (4.7.16) |  |
| About Your Hosts |  | (4.7.17) |  |
| Reviews |  | (4.7.18) |  |
| FAQ |  | (4.7.19) |  |
| Related Tours |  | (4.7.20) |  |
| + tagline sign-off |  |  |  |

```
FOOTER
```

### 3.2 Mobile (<768px)

Single-column. In-flow widget appears once, after Highlights. Sticky bottom CTA appears once user scrolls past the in-flow widget.

NAV (compact)

---

Breadcrumbs (truncated) H1 * rating • count

---

IMAGE GALLERY (swipe carousel) Quick-info badges (3)

fold

Tour Overview

Highlights

---

BOOKING WIDGET (in-flow)

Price • selectors • CTA • trust

---

sticky bottom CTA appears What’s Included / Not (4.7.9) Itinerary (4.7.10) Meeting + Pickup (4.7.11) What to Bring (4.7.12) Know Before You Go (4.7.13) Accessibility (4.7.14) Languages (4.7.15) Cancellation Policy (4.7.16) About Your Hosts (4.7.17) Reviews (4.7.18) FAQ (4.7.19) Related Tours (4.7.20) Closing Trust Block (4.7.21) + tagline sign-off

---

FOOTER

---

```
- STICKY BOTTOM CTA \longrightarrow
| From €X ' v Free cancel |
| [ Check availability → ] |
```

## 4. Section ordering

Order = question-funnel. Each section earns the next scroll by answering the next question.

| # | Section | Answers |
| --- | --- | --- |
| 4.7.1 | Breadcrumbs | “Where am I in the site?” |
| 4.7.2 | H1 | “What is this tour?” |
| 4.7.3 | Rating row | “Is it any good?” |
| 4.7.4 | Image gallery | “What does it look like?” |
| 4.7.5 | Quick-info badges | “How long? Pickup? Languages?” |
| 4.7.6 | Booking widget | “Can I book it on my date?” |
| 4.7.7 | Tour overview | “What is this experience really?” |
| 4.7.8 | Highlights | “What will I do?” |
| 4.7.9 | Inclusions | “What do I get for the price?” (R3) |
| 4.7.10 | Itinerary | “What happens when?” (R3) |
| 4.7.11 | Meeting + Pickup | “Where do I go?” (R3) |
| 4.7.12 | What to Bring | “What do I need?” (R3) |
| 4.7.13 | Know Before You Go | “Anything I should know?” (R4) |
| 4.7.14 | Accessibility | “Is it for me?” (R4) |
| 4.7.15 | Languages | “Will I understand?” (R4) |
| 4.7.16 | Cancellation Policy | “What if plans change?” (R4) |
| 4.7.17 | About Your Hosts | “Who am I going with?” (R5) |
| 4.7.18 | Reviews | “What did real travelers say?” (R5) |
| 4.7.19 | FAQ | “My specific questions” (R5) |
| 4.7.20 | Related Tours | “Other options?” (R6) |
| 4.7.21 | Closing Trust Block | “Can I trust this?” (R6) |
| 4.7.22 | Mobile Sticky CTA | (cross-cutting) (R6) |
| 4.7.23 | Share + Save | (cross-cutting) (R6) |
| 4.7.24 | Schema.org | (server-rendered) (R7) |
| 4.7.25 | AEO/GEO | (embedded) (R7) |