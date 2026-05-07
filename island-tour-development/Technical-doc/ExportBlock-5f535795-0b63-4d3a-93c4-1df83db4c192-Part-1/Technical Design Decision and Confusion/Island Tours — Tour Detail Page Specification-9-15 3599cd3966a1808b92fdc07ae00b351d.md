# Island Tours — Tour Detail Page Specification-9-15

| # | Section | Answers |
| --- | --- | --- |
| 4.7.26 | SEO Meta | (head) (R7) |
| 4.7.27 | Empty / Edge States | (cross-cutting) (R7) |
| 4.7.28 | Performance | (cross-cutting) (R7) |

## Three deliberate departures from the brief’s order:

1. Highlights before “What’s included” - motivation precedes rationality.
2. Cancellation before “About your hosts” - close the “what if I change my mind?” loop before asking for emotional investment in the host.
3. FAQ near the bottom but not buried - paired with Reviews to create two consecutive structured-data-rich blocks for AEO crawlers.

## 5. Section specs

### 4.7.1 Breadcrumbs

Anchor the user in the IA hierarchy and feed BreadcrumbList structured data.

## Wireframe

```
Home , Curaçao , Klein Curaçao , Miss Ann Boat Trips
```

- Mobile: visible, truncated middle if needed (e.g.,Klein C. , ); last segment never truncates, wraps to second line if long
- Desktop: single line, above H1
- All items except last are linked
- Separator:(1)( $\mathrm{U}+203 \mathrm{~A}$ )

## Path format

| Tour type | Path |
| --- | --- |
| Hub-anchored | Home ’ Destination ’Hub ’Tour |
| Category-anchored | Home > Destination > Category > Tour |
| Destination-only | Home ’ Destination ’Tour |

Last segment $=\mathrm{H} 1$ if $\mathrm{H} 1 \leqslant 35$ chars; else tour.breadcrumb_label.

Note (LD8): breadcrumbs visible on mobile here; hidden on destination page (4.2). Deliberate divergence - deeper-funnel users benefit from explicit hierarchy. Both specs reference each other.

Schema: □ BreadcrumbList JSON-LD.

### 4.7.2 H1

The most important text element on the page for both human readers and AI crawlers.
Format: □ {Destination or Hub} {Tour type} with {Host name}

Examples:

- Klein Curaçao Day Trip with Miss Ann
- Klein Curaçao Powerboat Trip with Powerboat
- Curaçao Sunset Catamaran Cruise with BlueFinn

## Rules

- 35-55 chars target, 65 hard max
- One H1 per page (all other section headings H2 or below)
- No emoji, no exclamation marks, no decorative adjectives (“ultimate,” “luxury,” “allinclusive”)
- Host suffix appears for branded operators. For awkward template results, use tour.h1_override

Why destination-first (not host-first, the legacy form): dominant search queries are destinationled; H1 first-token entity binding correlates with AI Overview citation rates. Host name still appears in the tail.

### 4.7.3 Rating row

Social proof above the fold + fast jump to reviews.

## Wireframe

★ 4.8 • 412 reviews $\pi$

- Below H1, above gallery (mobile) / alongside gallery start (desktop)
- Entire row is a tap-target → smooth-scrolls to Reviews section, URL updates with #reviews
- Keyboard:tabindex participation, Enter/Space activates
- Screen reader: “Rating: 4.8 stars out of 5,412 reviews. Activate to read reviews.”

## Display states (LD11)

| Condition | Display |
| --- | --- |
| 3+ native reviews | □  ★ $4.8 \cdot 412$ reviews |
| $<3$ native, operator has $\geqslant 10$ reviews & avg $\geqslant 4.0$ across all tours | $\star 4.8 \cdot \text { From this host's } 1,247 \text { reviews }$  across all tours |
| <3 native, operator below threshold | Row hidden |
| Mixed native + imported Tripadvisor reviews (where licensed) | Combined count, source note • from Tripadvisor |

## Format

- Rating to one decimal (4.84 → 4.8)
- Pluralisation per locale (“review” / “reviews”)
- Number formatting per locale (1,738 / 1.738 / 1738 )

Don’t show: descriptors (“Excellent,” “Great”), percentage-recommended, “happy travelers” framing. Honest data, no inflation.

Schema: AggregateRating. For the Provider Rating fallback, the AggregateRating refers to the operator-aggregated stats with appropriate context.

### 4.7.4 Image gallery

Visual proof of the experience - emotional fuel for the rational booking decision below.

## Wireframe - Desktop

Asymmetric grid. Hero

$\sim 60 \%$

width on the left + four

$1: 1$

tiles on the right.

![](Island%20Tours%20%E2%80%94%20Tour%20Detail%20Page%20Specification-9-15/imagesbb267382-5546-4bcc-9d26-8ab224048e25-3_374_766_2288_137.jpg)

Single swipeable carousel.

```
\(\left.\)\begin{tabular}{|lr|}
\hline & \\
\(\mid\) & hero \\
\(\mid\) & \((4: 3)\) \\
\hline
\end{tabular}\(\quad[\pi] \quad \right\rvert\,\)
    - ○ ○ ○ ○
[rej See all 24]
```

Tap any image ⟶ full-screen lightbox.

Image specs
| Field | Value |
| :— | :— |
| Hero ratio | 4:3 |
| Hero native min | $2400 \times 1800$ |
| Tile ratio | 1:1 |
| Tile native min | $1200 \times 1200$ |
| Format priority | AVIF → WebP → JPEG fallback |
| Size budget | <200 KB per image after compression |
| Color profile | sRGB |

## Image count

- Min: 5 (cannot publish below)
- Recommended: 8-12
- Max: 24 (caps lightbox scroll-tax)

Editorial content priority (operators upload raw; Island Tours team curates and orders):

1. Hero - clearest representation of what the user does (not a sunset hero unless tour is sunset-specific)
2. Location detail (beach, reef, dock)
3. Real travelers anonymized (backs, wide shots, no eye contact - per video-editor briefing rules)
4. Equipment / vehicle / food
5. Atmospheric closing (sunset, dock arrival)

## Lightbox

- Triggered by tapping any image or “See all N photos”
- Single-image view default; swipe (mobile) / arrow keys (desktop) navigate
- Counter ” 3 / 24 ” upper area
- Save ( $\mathbf{v}$ ) and Share ( $\lambda$ ) controls persist
- Close: tap X, tap outside (desktop), swipe down (mobile), or ESC
- Mobile grid view (“See all photos”): thumbnail grid → tap thumbnail enters single-image view
- Body scroll locked; ARIA role=“dialog” aria-modal=“true”, focus trapped

## Save / Share controls

Position: overlaid on hero, top-right corner.

| Control | Mobile | Desktop |
| --- | --- | --- |
| Save (v) | Toast: “Saved to your list.” Session storage if unauth, wishlist if auth. | Same. |
| Share (7) | Native share sheet (Web Share API) | Custom modal. WhatsApp, copy link, email, Facebook, X - in that order. |

Share pre-fill: Check this out - [Tour name] on Island Tours: [URL])
No video on this page. Photos do the visual work; the video archive is used on the homepage carousel, hub pages, ads, and social.

No captions. Visuals self-explain.

## LCP and loading

- Hero is LCP candidate; preloaded via< with responsive imagesrcset
- Mobile: only hero eagerly loaded; others queued
- Desktop: hero + tiles 2-5 may load eagerly if LCP holds; tiles 6+ lazy-load
- Image URLs include content-hash for CDN caching

## Edge cases

| Case | Behavior |
| --- | --- |
| <5 images | Cannot publish; editorial flag |
| 1 image | Hero only, no tiles, no “See all”; flagged for content-ops |
| Image fails to load | Blur placeholder; retry next page view |
| Full CDN outage | “Photos loading…” graceful state; booking widget unaffected |
| Vertical-orientation source | Cropped to 4:3/1:1; CMS supports manual focal-point |

### 4.7.5 Quick-info badges

Per-tour comparative data at-a-glance.

## Wireframe

1. 8 hours • 뜸 Pickup available • $\mathrm{EN}, \mathrm{NL}, \mathrm{ES},+1$
- Below gallery, above tour overview
- Mobile: compact horizontal default; wraps to two lines if cramped
- Desktop: single line

## Three badges, fixed order (LD7)

| # | Badge | Display |
| --- | --- | --- |
| 1 | Duration | ◯ {duration} from formatter (“8 hours” / “1h 30m” / “4 to 5 hours”) |
| 2 | Pickup |  |

3 Languages {lang1}, {lang2}, +N (first 2 + count of remaining)

## Strict rules

- Maximum 3 badges. Universal facts (free cancellation, mobile ticketing, instant confirmation) go in the booking widget trust strip - not here.
- “Pickup” - no hyphen (LD3).
- No “Free cancellation” / “Best price” / “Bestseller” / “Likely to sell out” badges. The first lives in the trust strip; the others are listing-page concerns or honest-scarcity issues handled in the booking widget time-slot picker.

No ticket badge. Island Tours bookings are confirmed by email - the booking is the ticket. Reassurance copy lives in the booking confirmation screen and FAQ.

Edge cases
| Case | Behavior |
| :— | :— |
| Variable duration | Range format (“4 to 8 hours”) |
| No pickup field set | Defaults to “Meeting point only” (safe default) |
| 1 language only |

![](Island%20Tours%20%E2%80%94%20Tour%20Detail%20Page%20Specification-9-15/imagesbb267382-5546-4bcc-9d26-8ab224048e25-7_61_501_721_686.jpg)

|
| 5+ languages | EN, NL, +3 |
| Duration unknown | Badge omitted; flagged as content-ops issue |

### 4.7.6 Booking widget

The conversion mechanism. Two responsibilities: inventory check + funnel commitment.

State machine
| State | Trigger | Visible |
| :— | :— | :— |
| S1 Initial | Page load | Price-from, date prompt, party selector, “Check availability,” trust strip |
| S2 Date picker | Tap date prompt | 14-day chip view; “View all dates” expands to month overlay |
| S3 Date selected | Tap date chip | Time-slot chips (if applicable); date persists |
| S4 Ready | Date + (time slot) + party set | “Continue” replaces “Check availability”; total recalculates |
| S5 Edge | Various | Sold out, no availability, API failure, race condition |

State persists in URL params (? date=2026-05-15&travelers=2) - refresh and share-link both work. All transitions reversible.

## Wireframe - Desktop, S1 (initial)