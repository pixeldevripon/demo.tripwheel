# Island Tours

Caribbean tour marketplace. Island Tours is a **reseller** — it earns a commission on every booking taken from local operators. Operators list single-day tours; placement is governed by **commission tiers** (not a slot economy). Travelers discover tours across three parallel layers (Categories, Activity Hubs, Collections), filter by attributes, and **book instantly** — no enquiry model.

> **Canonical source of truth:** `technical-doc/island-tours-platform-master.html` (v1.9). Where any doc or the code disagrees, the master wins. Start at [`technical-doc/README.md`](./technical-doc/README.md) for the documentation index.

---

## How placement works (commission tiers)

Operators choose a commission tier in their dashboard; higher commission buys a higher ranking position. There is **no slot economy** — no FeaturedSlot, SlotLock, soft-lock, or 3-slots-per-category mechanic.

| Tier | Commission | Rank |
|---|---|---|
| `premium` | 30% | 1 |
| `featured` | 27.5% | 2 |
| `boosted` | 25% | 3 |
| `organic` | 22.5% | 4 |
| `standard` (default) | 20% | 5 |
| Destination Spotlight | 35% | separate labeled block (max 3/destination, manual approval) |

Ranking query: `ORDER BY tier_rank ASC, quality_score DESC, id ASC`, after a bookability filter (active, bookable, open departure within 30 days) and a diversity pass. Paid tiers above `organic` open only after an eligibility bar (5 reviews, rating ≥4.0, operator cancellation rate ≤10%). See [`technical-doc/02-architecture/COMMERCIAL-MODEL.md`](./technical-doc/02-architecture/COMMERCIAL-MODEL.md).

---

## Roles

| Role | Created by | Capability |
|---|---|---|
| USER | Auto on first booking | Browse, book, review |
| TOUR_OPERATOR | Self-registration | List tours, pick commission tier |
| ADMIN | Database seed only | Full platform management (strict superset) |

Roles are set server-side only. EDITOR / STAFF / GUIDE are designed but not launch-active.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | NestJS 11 · TypeScript · Prisma 7 · PostgreSQL |
| Frontend | Next.js (App Router, ISR) · TanStack Query · Tailwind v4 |
| Auth | Better Auth (backend-hosted) |
| Payments | Stripe (deposit + paid-in-full collection) |
| Email | Resend |
| i18n | next-intl · 7 locales (en, es, nl, pt, fr, de, zh) — English primary |
| Tracking | GTM · GA4 · Meta Pixel + server-side Meta CAPI |
| Jobs | BullMQ · Redis (nightly ranking / quality-score / departure materialization) |
| Uploads | Cloudinary |

Display currency is locale-default (EN/ZH → USD; NL/DE/FR/ES/PT → EUR) with a footer selector override.

---

## Launch scope

3 live destinations in rollout order: **Curaçao** (launch), **Aruba**, **Sint Maarten**. Saint Lucia and Bahamas are seeded pipeline rows only. The schema scales to other regions with no structural change.

---

## Quick Start

```bash
# Backend — http://localhost:5050
pnpm dev:backend

# Frontend — http://localhost:3000
pnpm dev:frontend

# Prisma
pnpm prisma:generate       # regenerate client after schema changes
pnpm prisma:migrate        # create + apply migration (dev)
pnpm prisma:studio         # visual DB browser
```

API base: `http://localhost:5050/api/v1` · Auth: `/api/auth/*` · Swagger: `/api/docs`

---

## Documentation

All technical documentation lives in [`technical-doc/`](./technical-doc/). The canonical specification is the master HTML; [`technical-doc/README.md`](./technical-doc/README.md) is the navigable index to every active doc.

- [Documentation index](./technical-doc/README.md) — start here
- [Master checklist](./technical-doc/MASTER-CHECKLIST.md) — build status (single source of truth for progress)
- [Application features](./technical-doc/APPLICATION-FEATURES.md) — feature inventory (built / partial / missing)
- [Commercial model](./technical-doc/02-architecture/COMMERCIAL-MODEL.md) — commission tiers, ranking, eligibility

---

## Claude Code..

Active instructions are in [`CLAUDE.md`](./CLAUDE.md) (root) and [`CLAUDE-reference.md`](./CLAUDE-reference.md). test
