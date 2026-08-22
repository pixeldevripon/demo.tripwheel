---
name: tour_page_v2_restyle
description: Security pass on the v2 design restyle of the single-tour page (components/frontend/tour/**, tour-page-skeleton, new static icon SVGs). 2026-08-01.
type: project
---

# Single-tour page v2 restyle — clean, 2026-08-01

Reviewed the uncommitted design-only restyle: `components/frontend/tour/**` (detail content
sections, `tour-reviews.tsx`, `tour-reviews-section.tsx`, `tour-meeting-card.tsx`, `tour-booking-card/*`,
`tour-related-section.tsx`, `tour-related-tours.tsx`), `skeletons/tour-page-skeleton.tsx`, and four new
static SVGs (`pin-deep.svg`, `qi-pin.svg`, `tip-sun.svg`, `x-faint.svg`). Pure Tailwind/JSX
restyle — no new data flow, no new client/server boundary. No findings.

## Confirmed secure patterns (reuse, don't re-flag)

- **Review-card initials derivation renders as plain JSX text.**
  `tour-reviews-section.tsx` `ReviewCard` (~line 785):
  `review.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()` is a bare
  `{...}` expression inside a `<span>` — React auto-escapes string children, so this is XSS-safe
  regardless of what `review.name` contains (no `dangerouslySetInnerHTML` involved). Same file also
  renders `review.name` a second time as plain text next to it. `tour-reviews.tsx`'s `ReviewCard`
  (the shorter preview-card variant) does the same plain-text join for
  `[name, date, verified-label].filter(Boolean).join(' · ')`.
- **Google Maps link in `tour-meeting-card.tsx` is still server-built from coordinates only.** The
  `href` (`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`) is constructed in the
  parent server component `tour-detail-content.tsx` (~line 286-296) from
  `detail.meetingPointLat/Lng ?? startLocation?.latitude/longitude` — always numeric DB fields, never
  raw user/query input. The restyle only changed the icon/label styling and passed `mapLink.href`
  through unchanged; `target='_blank'` still pairs with `rel='noopener noreferrer'`.
- **New static SVG icons are inert.** All four new icons under `public/icons/` are `<svg>` with only
  `<path>`/`<circle>` children, no `<script>`, no `foreignObject`, no `on*` handlers, no external
  `xlink:href`/`use` refs — matches the pre-existing icons in the same directory (`qi-car.svg`,
  `qi-clock.svg`, `trust-check-green.svg`, also inert, checked as a spot-check even though unmodified).
- **No `dangerouslySetInnerHTML` introduced anywhere in this diff.** The one pre-existing user of it
  in the tour tree, `tour-reviews-blocks.tsx:139`, was NOT touched by this restyle (confirmed via
  `git diff --stat` returning empty for that file) — out of scope, not a regression.
- Dictionary/copy-key changes mentioned in the task framing did not actually appear in `git diff`
  (no `frontend/lib/i18n/dictionaries/*.json` changes were present at review time) — nothing to
  check there this pass.

**Why:** Establishes the tour-page restyle as a template for how future design-only passes over this
surface should look (plain-JSX text everywhere, coordinate-only map links, inert icon assets) — a
future review of the SAME files should diff against this baseline rather than re-deriving it.
**How to apply:** If a future tour-page change touches `ReviewCard`'s initials logic, the meeting-card
map link construction, or adds new SVGs, diff against the patterns above rather than re-auditing from
scratch. If `review.name`/`review.text` or `mapLink` construction ever moves to accept raw query
params or unescaped HTML, that's the regression to watch for.
