# Island Tours — Technical Documentation

> **Canonical source:** [`island-tours-platform-master.html`](./island-tours-platform-master.html) (v1.9, June 11 2026). The master HTML is the single authoritative specification — where any doc below, or the codebase, disagrees with it, the master wins. The docs here re-state and cross-reference the master; they never override it.

This is the navigation index. Start here.

---

## Status & inventory

| File | Purpose |
|---|---|
| [MASTER-CHECKLIST.md](./MASTER-CHECKLIST.md) | **The single checklist.** Every master point as a task with build status (`- [x]` done / `- [ ]` remaining / `⚠️` partial), plus the dependency-ordered migration plan and the legacy-slot removal list. Keep it current with every implementation change. |
| [APPLICATION-FEATURES.md](./APPLICATION-FEATURES.md) | Feature inventory grouped by area — what is built, partial, or missing against the master target. |

---

## 01 — Project Scope

| File | Purpose |
|---|---|
| [01-project-scope/PROJECT-SCOPE.md](./01-project-scope/PROJECT-SCOPE.md) | Business model (reseller / commission), roles, discovery layers, launch destinations, scope boundaries. |

---

## 02 — Architecture

| File | Purpose |
|---|---|
| [02-architecture/PLATFORM-ARCHITECTURE.md](./02-architecture/PLATFORM-ARCHITECTURE.md) | Information architecture: core hierarchy, page types, discovery layers (Categories / Hubs / Collections), destinations + regions. |
| [02-architecture/ARCHITECTURE-OVERVIEW.md](./02-architecture/ARCHITECTURE-OVERVIEW.md) | System design: layers, backend module map, rendering (ISR) strategy, background jobs. |
| [02-architecture/ROUTING-AND-RESOLUTION.md](./02-architecture/ROUTING-AND-RESOLUTION.md) | URL structure `/{locale}/{destination}/{slug}/`, locale prefixing/redirects, flat tour URLs, hreflang. |
| [02-architecture/SLUG-REGISTRY.md](./02-architecture/SLUG-REGISTRY.md) | Destination-scoped slug → page-type resolution, 20 protected slugs per destination, 301 renames + 90-day reuse cooldown. |
| [02-architecture/SEO-STRATEGY.md](./02-architecture/SEO-STRATEGY.md) | JSON-LD per page type, per-locale sitemaps, canonical/hreflang, internal linking, category gating. |
| [02-architecture/SOFT-DELETE-STRATEGY.md](./02-architecture/SOFT-DELETE-STRATEGY.md) | Why deletions are deactivations: slug protection, FK chains, financial-record retention. |
| [02-architecture/COMMERCIAL-MODEL.md](./02-architecture/COMMERCIAL-MODEL.md) | **Commission tiers, ranking query, quality score, eligibility, Destination Spotlight, affiliate program** (replaces the removed slot economy). |
| [02-architecture/BOOKING-AND-PAYMENTS.md](./02-architecture/BOOKING-AND-PAYMENTS.md) | 4 payment models, deposit/balance split, cancellation window, instant confirmation, two-phase operator visibility. |
| [02-architecture/AVAILABILITY-AND-DEPARTURES.md](./02-architecture/AVAILABILITY-AND-DEPARTURES.md) | Availability schedules + exceptions + materialized departures, nightly materialization, bookability rule. |
| [02-architecture/TRACKING-AND-ANALYTICS.md](./02-architecture/TRACKING-AND-ANALYTICS.md) | `booking_complete` event, GTM tags + Meta CAPI, conversion value = commission in EUR, TYP route, Consent Mode v2. |
| [02-architecture/DATA-MODEL.md](./02-architecture/DATA-MODEL.md) | Canonical Prisma data model — entities, relations, tier columns, booking/review/availability tables (master Appendix E). |

---

## 03 — Implementation

| File | Purpose |
|---|---|
| [03-implementation/IMPLEMENTATION-GUIDE.md](./03-implementation/IMPLEMENTATION-GUIDE.md) | Phased build steps from environment setup through public site and tracking. |
| [03-implementation/TRIP-MODULE.md](./03-implementation/TRIP-MODULE.md) | Tour module: lifecycle, multi-category / multi-hub model, child entities, API reference, frontend integration. |

---

## 04 — Multilingual

| File | Purpose |
|---|---|
| [04-multilingual/MULTILINGUAL-CONTENT.md](./04-multilingual/MULTILINGUAL-CONTENT.md) | 7-locale translation architecture, per-entity typed tables, English-only slugs, translation jobs, ISR revalidation. |

---

## 05 — Access Management

| File | Purpose |
|---|---|
| [05-access-management/ROLES-AND-ACCESS-MANAGEMENT.md](./05-access-management/ROLES-AND-ACCESS-MANAGEMENT.md) | Roles, permission matrix, dashboard nav and API access per role, tier-selection / Spotlight-approval / force-majeure permissions. |

---

## obsolete/ — superseded docs

[`obsolete/`](./obsolete/) holds the V2-PDF-era documentation that the master now supersedes (Platform Architecture V2 reflections, the V2 development alignment plan, the V2 gap analysis, and the `06-v2-backend-migration/` set). Kept for history only — do not build from them. See [`obsolete/README.md`](./obsolete/README.md).

## specs/ — deep-reference PDFs

[`specs/`](./specs/) holds the deep-reference design PDFs the master points to (Tour Detail Page specification, Platform Architecture changelog). These carry implementation depth (wireframes, verbatim copy) that the master references but does not inline.
