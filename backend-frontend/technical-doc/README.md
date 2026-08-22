# Island Tours — Technical Documentation

> **Canonical source:** [`island-tours-platform-master.html`](./island-tours-platform-master.html) (v1.9, June 11 2026). The master HTML is the single authoritative specification — where any doc below, or the codebase, disagrees with it, the master wins. The docs here re-state and cross-reference the master; they never override it.

This is the navigation index. Start here. Only three files live at the root — the master HTML, [`MASTER-CHECKLIST.md`](./MASTER-CHECKLIST.md), and this index. Everything else is in a folder.

## The map

| Folder | What lives there |
| --- | --- |
| [`01-project-scope/`](./01-project-scope/) | Scope, the full feature/task inventory, the client-facing feature register |
| [`02-architecture/`](./02-architecture/) | System + information architecture, one doc per subsystem |
| [`03-implementation/`](./03-implementation/) | Build guides, module data specs, per-feature checklists |
| [`04-multilingual/`](./04-multilingual/) | 7-locale translation architecture and AI translation flow |
| [`05-access-management/`](./05-access-management/) | Roles, permissions, staff & teams |
| [`06-deployment/`](./06-deployment/) | VPS deployment steps. Live ops runbooks moved to the repo-level [`docs/operations/`](../../docs/operations/) |
| [`06-octo-migration/`](./06-octo-migration/) | OCTO API standard migration set |
| [`emails/`](./emails/) | **Email programme**: wireframes (customer funnel, operator onboarding, booking confirmation) + the build-status audit |
| [`mockups/`](./mockups/) | Design mockups and dev handoffs (`mck-*.html`, card carousel, search) + screenshots |
| [`login/`](./login/) | Login/auth design: research, spec, reconciliation, mockup |
| [`reviews/`](./reviews/) | Review module: requirements, plan, checklist, build-vs-buy strategy |
| [`audits/`](./audits/) | Point-in-time reviews of built surfaces (account pages, operator availability portal, date/time handling) |
| [`bookings/`](./bookings/) · [`customers/`](./customers/) | Traveller booking-session story · customer accounts |
| [`content/`](./content/) | Homepage/pages system and editorial + FAQ model |
| [`client-docs/`](./client-docs/) | Client-facing build status and platform requirements |
| [`dashboard-extraction/`](./dashboard-extraction/) | The dashboard→own-repo extraction spec set |
| [`final design/`](./final%20design/) | Final page designs (HTML) for the public site |
| [`specs/`](./specs/) | Deep-reference PDFs (tour detail page spec, architecture changelog, iCal PRD, roles matrix) |
| [`test-reports/`](./test-reports/) | QA/pentest reports and fix logs |
| [`obsolete/`](./obsolete/) | Superseded V2-era docs — history only, do not build from |

---

## Status & inventory

| File | Purpose |
| --- | --- |
| [MASTER-CHECKLIST.md](./MASTER-CHECKLIST.md) | **The single checklist.** Every master point as a task with build status (`- [x]` done / `- [ ]` remaining / `⚠️` partial), plus the dependency-ordered migration plan. Keep it current with every implementation change. |
| [01-project-scope/APPLICATION-FEATURES-AND-TASKS.md](./01-project-scope/APPLICATION-FEATURES-AND-TASKS.md) | Feature inventory grouped by area — what is built, partial, or missing against the master target. |
| [client-docs/BUILD-STATUS-CHECKLIST.md](./client-docs/BUILD-STATUS-CHECKLIST.md) | The plain-English client-facing build status. |

## 01 — Project scope

| File | Purpose |
| --- | --- |
| [01-project-scope/PROJECT-SCOPE.md](./01-project-scope/PROJECT-SCOPE.md) | Business model (reseller / commission), roles, discovery layers, launch destinations, scope boundaries. |
| [01-project-scope/APPLICATION-FEATURES-AND-TASKS.md](./01-project-scope/APPLICATION-FEATURES-AND-TASKS.md) | The exhaustive feature/task inventory. |
| [01-project-scope/IslandTours_Feature_Register.html](./01-project-scope/IslandTours_Feature_Register.html) | Client-facing feature register. |

## 02 — Architecture

| File | Purpose |
| --- | --- |
| [02-architecture/PLATFORM-ARCHITECTURE.md](./02-architecture/PLATFORM-ARCHITECTURE.md) | Information architecture: core hierarchy, page types, discovery layers (Categories / Hubs / Collections), destinations + regions. |
| [02-architecture/ARCHITECTURE-OVERVIEW.md](./02-architecture/ARCHITECTURE-OVERVIEW.md) | System design: layers, backend module map, rendering strategy, background jobs. |
| [02-architecture/ROUTING-AND-RESOLUTION.md](./02-architecture/ROUTING-AND-RESOLUTION.md) | URL structure `/{locale}/{destination}/{slug}/`, locale prefixing/redirects, flat tour URLs, hreflang. |
| [02-architecture/SLUG-REGISTRY.md](./02-architecture/SLUG-REGISTRY.md) | Destination-scoped slug → page-type resolution, 20 protected slugs per destination, 301 renames + 90-day reuse cooldown. |
| [02-architecture/SEO-STRATEGY.md](./02-architecture/SEO-STRATEGY.md) | JSON-LD per page type, per-locale sitemaps, canonical/hreflang, internal linking, category gating. |
| [02-architecture/SOFT-DELETE-STRATEGY.md](./02-architecture/SOFT-DELETE-STRATEGY.md) | Why deletions are deactivations: slug protection, FK chains, financial-record retention. |
| [02-architecture/COMMERCIAL-MODEL.md](./02-architecture/COMMERCIAL-MODEL.md) | **Commission tiers, ranking query, quality score, eligibility, Destination Spotlight, affiliate program.** |
| [02-architecture/BOOKING-AND-PAYMENTS.md](./02-architecture/BOOKING-AND-PAYMENTS.md) | 4 payment models, deposit/balance split, cancellation window, instant confirmation, booking state machine. |
| [02-architecture/AVAILABILITY-AND-DEPARTURES.md](./02-architecture/AVAILABILITY-AND-DEPARTURES.md) | Availability schedules + exceptions + materialized departures, nightly materialization, bookability rule. |
| [02-architecture/AVAILABILITY-BOOKING-ARCHITECTURE.md](./02-architecture/AVAILABILITY-BOOKING-ARCHITECTURE.md) | The availability↔booking seam as built: seat ledger, claim/release, caches. |
| [02-architecture/FX-AND-MULTI-CURRENCY.md](./02-architecture/FX-AND-MULTI-CURRENCY.md) | Currency conversion, providers, snapshots, spotlight commission. |
| [02-architecture/SETTLEMENT-AND-PAYOUTS.md](./02-architecture/SETTLEMENT-AND-PAYOUTS.md) | v1/v2 money flow, settlements ledger (visual: [settlement-payout-flow.html](./02-architecture/settlement-payout-flow.html)). |
| [02-architecture/EVENT-DRIVEN-AND-QUEUES.md](./02-architecture/EVENT-DRIVEN-AND-QUEUES.md) | BullMQ, outbox, job schedulers, no-queue-for-capacity. |
| [02-architecture/TRACKING-AND-ANALYTICS.md](./02-architecture/TRACKING-AND-ANALYTICS.md) | `booking_complete` event, GTM + Meta CAPI, conversion value = commission in EUR, TYP route, Consent Mode v2. |
| [02-architecture/NOTIFICATIONS-AND-ALERTS.md](./02-architecture/NOTIFICATIONS-AND-ALERTS.md) | The full action/audience/permission notification matrix. |
| [02-architecture/CUSTOM-SCRIPTS.md](./02-architecture/CUSTOM-SCRIPTS.md) | Admin-pasted vendor snippets: allowlist, what is deliberately not validated. |
| [02-architecture/INSTAGRAM-FEED.md](./02-architecture/INSTAGRAM-FEED.md) | Instagram auto-sync flow, token refresh, mirroring. |
| [02-architecture/DATA-MODEL.md](./02-architecture/DATA-MODEL.md) | Canonical Prisma data model (master Appendix E). |
| [02-architecture/RENDERING.md](./02-architecture/RENDERING.md) | Public-site rendering model (`'use cache'`, PPR, revalidation). |
| [02-architecture/RENDERING-REVALIDATION-REVIEW.md](./02-architecture/RENDERING-REVALIDATION-REVIEW.md) | The rendering/revalidation policy review the page comments cite. |

## 03 — Implementation

Build guides and per-feature checklists: [IMPLEMENTATION-GUIDE.md](./03-implementation/IMPLEMENTATION-GUIDE.md), [TRIP-MODULE.md](./03-implementation/TRIP-MODULE.md), booking set ([BOOKING-CHECKLIST.md](./03-implementation/BOOKING-CHECKLIST.md), [BOOKING-FLOW-DESIGN-GUIDE.md](./03-implementation/BOOKING-FLOW-DESIGN-GUIDE.md), [BOOKING-WIDGET-CHECKLIST.md](./03-implementation/BOOKING-WIDGET-CHECKLIST.md), [BOOKING-AND-PAYMENT-DATA.md](./03-implementation/BOOKING-AND-PAYMENT-DATA.md), [BOOKING-COMPLETION-PROGRESS.md](./03-implementation/BOOKING-COMPLETION-PROGRESS.md), [BOOKING-CONCURRENCY-HARDENING.md](./03-implementation/BOOKING-CONCURRENCY-HARDENING.md), [AVAILABILITY-ISBOOKABLE-FLOW.md](./03-implementation/AVAILABILITY-ISBOOKABLE-FLOW.md)), payments ([STRIPE-PAYMENTS-SETUP.md](./03-implementation/STRIPE-PAYMENTS-SETUP.md)), pricing ([PRICING-MODEL-AND-UNIT-CHECKLIST.md](./03-implementation/PRICING-MODEL-AND-UNIT-CHECKLIST.md)), ranking/badges ([TOUR-RANKING.md](./03-implementation/TOUR-RANKING.md), [TOUR-BADGES.md](./03-implementation/TOUR-BADGES.md), [TOUR-BADGES-AND-RANKING.md](./03-implementation/TOUR-BADGES-AND-RANKING.md)), data specs ([TOUR-MODULE-DATA.md](./03-implementation/TOUR-MODULE-DATA.md), [HUB-DATA.md](./03-implementation/HUB-DATA.md), [COLLECTION-DATA.md](./03-implementation/COLLECTION-DATA.md), [SPOTLIGHT-DATA.md](./03-implementation/SPOTLIGHT-DATA.md)), analytics ([DASHBOARD-ANALYTICS.md](./03-implementation/DASHBOARD-ANALYTICS.md), [GTM-CONTAINER-SETUP.md](./03-implementation/GTM-CONTAINER-SETUP.md)), editorial ([LOCALS-FAVOURITE-EDITORIAL-CHECKLIST.md](./03-implementation/LOCALS-FAVOURITE-EDITORIAL-CHECKLIST.md)), analysis ([category-page-two-listing-analysis.md](./03-implementation/category-page-two-listing-analysis.md)).

## emails/ — the email programme

| File | Purpose |
| --- | --- |
| [emails/EMAIL-IMPLEMENTATION-PLAN.md](./emails/EMAIL-IMPLEMENTATION-PLAN.md) | **Start here.** The build plan: seven work packages (WP-A…WP-G) with pinned contracts, per-repo file paths, dependency graph — each independently buildable by a separate agent. |
| [emails/EMAIL-PROGRAMME-RUNBOOK.md](./emails/EMAIL-PROGRAMME-RUNBOOK.md) | **The operator's manual, in plain language**: every trigger, every switch and where it lives, how to test, consent, logs, the go-live sequence, troubleshooting. |
| [emails/EMAIL-PROGRAMME-CHECKLIST.md](./emails/EMAIL-PROGRAMME-CHECKLIST.md) | The tracking checklist: every package broken into small atomic tasks with stable IDs, grouped by scope (backend / dashboard / frontend). Update in the same commit as the work. |
| [emails/island-tours-email-programme-status.md](./emails/island-tours-email-programme-status.md) | Build-status audit of all 17 emails vs the codebase, estimate, phasing ([HTML version](./emails/island-tours-email-programme-status.html)). |
| [emails/island-tours-email-funnel-wireframe.html](./emails/island-tours-email-funnel-wireframe.html) | Customer funnel wireframe (BK-1..3R, MK-1, CX-1). |
| [emails/island-tours-operator-onboarding-emails-wireframe.html](./emails/island-tours-operator-onboarding-emails-wireframe.html) | Operator onboarding sequence wireframe (OB-1..8, INT-1/2). |
| [emails/island-tours-booking-confirmation-email-wireframe.html](./emails/island-tours-booking-confirmation-email-wireframe.html) | BK-1 booking confirmation wireframe — **read at build time by `booking-confirmation-email.template.spec.ts`**; do not move without updating that spec. |

## Other folders

- **04 — Multilingual:** [MULTILINGUAL-CONTENT.md](./04-multilingual/MULTILINGUAL-CONTENT.md) · [AI-TRANSLATION-FLOW.md](./04-multilingual/AI-TRANSLATION-FLOW.md)
- **05 — Access:** [ROLES-AND-ACCESS-MANAGEMENT.md](./05-access-management/ROLES-AND-ACCESS-MANAGEMENT.md) · [STAFF-AND-TEAMS.md](./05-access-management/STAFF-AND-TEAMS.md)
- **06 — Deployment/Ops:** [DEPLOYMENT.md](./06-deployment/DEPLOYMENT.md) · [VPS-DEPLOYMENT-STEPS.md](./06-deployment/VPS-DEPLOYMENT-STEPS.md) · [VPS-OPERATIONS-GUIDE.md](../../docs/operations/VPS-OPERATIONS-GUIDE.md)
- **06 — OCTO migration:** start with [OCTO-SPECIFICATION-REFERENCE.md](./06-octo-migration/OCTO-SPECIFICATION-REFERENCE.md), then [OCTO-API-MIGRATION-CHECKLIST.md](./06-octo-migration/OCTO-API-MIGRATION-CHECKLIST.md), [OCTO-AVAILABILITY-AND-BOOKING.md](./06-octo-migration/OCTO-AVAILABILITY-AND-BOOKING.md), [OCTO-PRISMA-SCHEMA-DESIGN.md](./06-octo-migration/OCTO-PRISMA-SCHEMA-DESIGN.md), [OCTO-FRONTEND-ALIGNMENT.md](./06-octo-migration/OCTO-FRONTEND-ALIGNMENT.md)
- **reviews/ (review module):** [REVIEW-MODULE-REQUIREMENTS.md](./reviews/REVIEW-MODULE-REQUIREMENTS.md) · [REVIEW-MODULE-PLAN.md](./reviews/REVIEW-MODULE-PLAN.md) · [REVIEW-MODULE-CHECKLIST.md](./reviews/REVIEW-MODULE-CHECKLIST.md) · [REVIEW-MODULE-EXPLAINED.md](./reviews/REVIEW-MODULE-EXPLAINED.md) · strategy HTMLs (build-vs-buy, strategy, verification)
- **login/:** numbered set `01-login-design-summary` → `04-why-better-auth`, plus the research/spec/mockup that fed it
- **audits/:** [island-tours-account-pages-review_1.md](./audits/island-tours-account-pages-review_1.md) · [island-tours-portal-availability-review.md](./audits/island-tours-portal-availability-review.md) (+ [final HTML](./audits/island-tours-portal-availability-final_1.html)) · [local-date-time-conversation.md](./audits/local-date-time-conversation.md)
- **mockups/:** `mck-10/14/15/16/17/18/19.html` (Pastel-board mockups), card-carousel + search dev handoffs, section screenshots
- **obsolete/:** V2-era docs the master supersedes — kept for history, do not build from ([obsolete/README.md](./obsolete/README.md))

## Conventions

- New docs go **in a folder, never at the root**. The root holds exactly: the master HTML, `MASTER-CHECKLIST.md`, and this index.
- When a doc moves, update every reference — `CLAUDE.md` (repo + workspace), code comments, and any spec that reads a doc from disk (the booking-confirmation template spec does).
