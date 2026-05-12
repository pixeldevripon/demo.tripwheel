# Island Tours — Tour Detail Page Specification-21-28

- SSR’d shell with placeholder selectors
- Hydration deferred via requestIdleCallback after LCP
- All inputs have stable height - zero layout shift during hydration

### 4.7.7 Tour overview

The first piece of prose. Where the brand voice does meaningful work.

## Wireframe

```
The boat trip locals tell their friends to book.
Eight hours on the water at the island we send our
own visitors to.
You'll sail the south coast on the original Klein
Curaçao yacht. A crew that's been running this route
for 40 years - they know exactly where the turtles
are and which reef has the best visibility this week.
Local tip: book the morning departure. Afternoon wind
picks up and the water gets choppier.
```

Length: 80-150 words ideal. 200 hard max (CMS blocks save above).
Structure (per Brand Voice Bible Tour Description Voice Guide):

1. Hook (1-2 sentences) - what makes this tour worth it. Not the category. Not “Enjoy a…”
2. Experience ( $2-4$ sentences) - what actually happens. Specific places, real numbers.
3. Local tip (1 sentence, optional but encouraged) - only-a-local-knows insight.

Practical details (duration, what’s included, what to bring) do not go here. They have dedicated sections. The overview stays atmospheric and motivational.

## Required

- $\geqslant 1$ specific named place
- $\geqslant 1$ quantification (duration, year count, distance)
- “We” pronoun where natural
- Active voice, specific verbs

## Banned

- Opening with “Enjoy a…” (Viator pattern)
- Opening with the tour category
- Banned-words list (LD9)
- Superlatives without specifics
- Stock-tour language (“create memories that last a lifetime”)

Layout: no visible H2. Section landmark via

for screen readers and crawlers. Direct opening from the hook is part of the brand voice - adding a corporate “Overview” header softens it.

This is a deliberate divergence from Viator/GYG/Klook (all use a visible heading). At 80-150 words a heading is just chrome.

No “read more” expansion. Spec is short by design.

Edge cases
| Case | Behavior |
| :— | :— |
| Empty | Section hidden; tour cannot publish |
| 1 sentence only | Displays; flagged for editorial expansion |
| >200 words | CMS blocks save |
| Missing translation | English fallback + “Translated by Google” badge - but human translation is mandatory at launch, so should not happen at go-live |

### 4.7.8 Highlights

Bullet answer to “what will I do?” Bridge between motivational (overview) and rational (inclusions).

## Wireframe

```
Highlights
v Reach the island in 1h15
v Snorkel with sea turtles
v BBQ lunch and drinks
v Private beach house & shower
V Max 30 travelers - never crowded
```

## Bullet count

- Min: 3
- Recommended: 5
- Max: 6

## Per-bullet rules

- Length: 5-12 words. Hard max 15.
- Lead with verb or specific noun (“Reach the island” / “Private beach house”)
- Quantify where possible (“1h15,” “Max 30 travelers,” “40 years”)
- Avoid superlatives (“amazing,” “stunning,” “world-class”)
- Avoid generic phrasings (“scenic views” → describe what you see)

Differentiator bullet: at least one bullet should be unique to this tour, not interchangeable with competitors. For Miss Ann: “Private beach house & shower” or “Crew running this route for 40 years.”

No emojis in bullets. Checkmark prefix only.
Heading: “Highlights” - visible H2 (unlike the overview, which has no visible heading). The list format benefits from a clear label, and the H 2 provides a useful page-anchor for scroll-to-section navigation.

Edge cases
| Case | Behavior |
| :— | :— |
| <3 bullets | Section hidden; tour flagged as under-spec’d |
| >6 bullets | CMS blocks save |
| Single bullet $>15$ words | CMS blocks save |
| Empty bullet (whitespace only) | Ignored at render |

## 6. Page-level rules cross-cutting all sections

### 6.1 Brand voice

All copy follows the Island Tours Brand Voice Bible v1.0. Banned-words list applies platformwide. The Tour Description Voice Guide (Bible §4) is the source of truth for the overview. The Bible’s Appendix six-question quick-check applies to every piece of copy on the page.

### 6.2 Translation

7 launch locales: EN (primary) + NL, ES, PT, DE, FR, ZH. Title, highlights, inclusions, important info, FAQ, itinerary headers - human-translated at launch. Itinerary body and host bio - human at launch (small operator set), AI-assisted with editorial review at scale. Auto-translated content is labelled “Translated.”

Tagline Built by Islanders. stays in English across all locales (brand mark, like a logo).

### 6.3 Currency

Per locale, fixed at launch (no user selector):

- EN, NL, DE, FR, ES, PT → EUR
- ZH → USD

### 6.4 Mobile sticky CTA - full spec

Spec’d in detail in Section 4.7.22 (Round 6). Foundations here:

- Triggered when in-flow widget passes above viewport
- Disappears when in-flow widget re-enters viewport
- Three elements only: price, free-cancel micro-copy, primary CTA
- Tap opens the in-flow widget AND the date picker (single tap, double action)

### 6.5 Save / Share

Spec’d in detail in Section 4.7.23 (Round 6). Foundations here:

- Save: heart icon, session storage if unauth, wishlist if auth
- Share order: WhatsApp → copy link → email → Facebook → X
- WhatsApp pre-fill: Check this out - [Tour name] on Island Tours: [URL]
- WhatsApp help button pre-fill: Hi! I’m looking at tours on Island Tours and could use some help.

### 6.6 Schema (head)

Spec’d in detail in Section 4.7.24 (Round 7). Foundations here:

- Product with Offer (primary)
- TouristTrip
- BreadcrumbList
- FAQPage
- AggregateRating (with Provider Rating fallback per LD11)
- Review
- All combined via @graph

### 6.7 Accessibility baseline

- All interactive elements: keyboard accessible, focus visible
- Booking widget: full screen-reader announcements at each state transition
- ARIA on lightbox: role=“dialog”, aria-modal=“true”, focus trapped
- Color contrast: WCAG AA minimum on all text
- Touch targets: $44 \times 44$ CSS pixels minimum

### 6.8 Component inventory

Unique UI components needed for this page. Some are shared with other specs (Tour Card, Hub Page); flagged where applicable.

| Component | States / variants | Shared with |
| --- | --- | --- |
| Breadcrumb row | desktop full ⋅ mobile truncated | All pages |
| H1 typography | one variant | All pages |
| Rating row | $3+$ reviews ⋅ Provider Rating fallback ⋅ hidden | Tour Card (low-state rules) |
| Image gallery desktop grid | 5-image asymmetric • 1 -image fallback | - |
| Image gallery mobile carousel | hero + dot indicators • 1-image fallback | - |
| Lightbox | single-image ⋅ grid view (mobile only) | Could be shared with hub page |
| Save ( $\mathbf{v}$ ) icon | empty ⋅ filled ⋅ hover ⋅ loading | Tour Card |
| Share ( 7) control | desktop modal ⋅ mobile native | Tour Card |
| Quick-info badge row | 3 badges ⋅ wrapping | - |
| Booking widget shell | S1-S5 states | - |
| Date chip | available ⋅ sold_out ⋅ closed_day ⋅ cutoff_passed ⋅ selected | - |
| Date picker overlay | full-month grid | - |
| Time slot chip | normal ⋅ low capacity ⋅ sold out ⋅ selected | - |
| Party-size stepper | standard +/-•age-banded sub-rows • informational (unit pricing) | - |
| Add-on opt-in card | unchecked ⋅ checked ⋅ with quantity | - |
| Pricing breakdown expansion | collapsed ⋅ expanded inline | - |
| Trust strip | 4-line stack | Closing Trust Block (different copy, same visual pattern) |
| Sticky bottom CTA bar | visible • hidden | - |
| Section heading H2 | with anchor link target | All long-form sections |
| Toast notification | save success ⋅ error | All pages |

| Component | States / variants | Shared with |
| --- | --- | --- |
| Inline error / constraint message | brand-voiced, not red-banner | All forms |
| Loading skeleton | image ⋅ widget ⋅ date chips | All async surfaces |

## 7. Cross-references

| Spec | Used by |
| --- | --- |
| Section 1.6 Slug Registry | URL → entity resolution; breadcrumbs |
| Section 4.2 Destination Page | Mobile breadcrumb divergence (LD8) |
| Section 4.3 All Tours / Search Page | Tour Card pattern, hyphen alignment for “Pickup” |
| Section 4.4 Category Page | Breadcrumb 3-level pattern |
| Section 4.5 Activity Hub Page | Breadcrumb 3-level pattern; tour comparison patterns |
| Tour Card spec | Image library; duration formatter; rating <3 reviews rule; “Pickup” hyphen alignment needed |
| Brand Voice Bible v1.0 | All copy rules; banned-words list; Tour Description Voice Guide |
| Video editor briefing (Dutch) | People-anonymization rules for gallery photos |

## 8. Future rounds

Sections 4.7.9 through 4.7.28 follow in subsequent rounds:

- Round 3: Inclusions, Itinerary, Meeting + Pickup, What to Bring (4.7.9-4.7.12)
- Round 4: Know Before You Go, Accessibility, Languages, Cancellation Policy (4.7.13-4.7.16)
- Round 5: About Your Hosts, Reviews, FAQ (4.7.17-4.7.19)
- Round 6: Related Tours, Closing Trust Block, Mobile Sticky CTA, Share + Save (4.7.204.7.23)
- Round 7: Schema, AEO/GEO, SEO Meta, Empty/Edge States, Performance + Phase 4 competitive matrix (4.7.24-4.7.28)

All written with Locked Decisions LD1-LD12 baked in, in alignment with Brand Voice Bible v1.0.

End of Section 4.7 Round 1+2 specification. Source-of-truth for design and engineering.