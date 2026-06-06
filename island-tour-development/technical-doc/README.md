# Island Tours — Technical Documentation

> Navigation index for all technical docs. Start here.

---

## Folders

```
technical-doc/
├── 01-project-scope/         Business requirements and feature scope
├── 02-architecture/          System design, schema decisions, technical strategy
├── 03-implementation/        Build guides and module-level implementation docs
├── 04-multilingual/          Translation architecture and per-entity content flows
├── 05-access-management/     Roles, permissions, dashboard access, missing features
└── specs/                    PDF design specifications from the client
```

---

## Document Index

### Master Checklist

| File | Purpose |
|---|---|
| [MASTER-CHECKLIST.md](./MASTER-CHECKLIST.md) | Every task across all 18 phases — ✅ implemented, ⚠️ partial, ⬜ remaining — plus 23 missing features. Source of truth for "what's next". |

### Platform Architecture V2 (Notion PDF) — Reflected

| File | Purpose |
|---|---|
| [02-architecture/PLATFORM-ARCHITECTURE-V2.md](./02-architecture/PLATFORM-ARCHITECTURE-V2.md) | **Canonical** discovery/SEO architecture — faithfully reflects all 11 sections of the V2 Notion PDF (hierarchy, destinations+region, 19 categories, multi-category tours, attributes/filters, collections, URL structure, slug registry, JSON-LD/sitemaps/search, i18n). States target state; slot economy retained. |
| [V2-DEVELOPMENT-ALIGNMENT-PLAN.md](./V2-DEVELOPMENT-ALIGNMENT-PLAN.md) | Phased, checkboxed migration plan to bring schema/backend/frontend in line with V2 (workstreams A–H). |
| [ARCHITECTURE-V2-GAP-ANALYSIS.md](./ARCHITECTURE-V2-GAP-ANALYSIS.md) | Why each delta exists — conflicts, missing systems, field gaps between V2 and our docs/schema. |

### 06 — V2 Backend Migration (grounded in actual code)

| File | Purpose |
|---|---|
| [06-v2-backend-migration/01-BACKEND-IMPLEMENTATION-ANALYSIS.md](./06-v2-backend-migration/01-BACKEND-IMPLEMENTATION-ANALYSIS.md) | What the backend does **today**, read from `backend/src` + `prisma` (the "before" baseline). |
| [06-v2-backend-migration/02-BACKEND-CHANGE-LIST.md](./06-v2-backend-migration/02-BACKEND-CHANGE-LIST.md) | Itemized backend + core-logic changes per V2, mapped to exact files/models (9 groups). |
| [06-v2-backend-migration/03-BACKEND-MIGRATION-STEPS.md](./06-v2-backend-migration/03-BACKEND-MIGRATION-STEPS.md) | Ordered, reversible runbook (8 stages) with migrations, backfills, and verification checks. |
| [06-v2-backend-migration/04-BEFORE-AFTER-AND-LOGIC.md](./06-v2-backend-migration/04-BEFORE-AFTER-AND-LOGIC.md) | Per-change before → after + the reasoning/logic. Read to understand the migration without reading code. |
| [06-v2-backend-migration/05-FRONTEND-IMPACT-LOG.md](./06-v2-backend-migration/05-FRONTEND-IMPACT-LOG.md) | **Living log** of backend→UI changes per stage (admin + public). Updated after every backend stage; read this first when starting frontend work. |

### 01 — Project Scope

| File | Purpose |
|---|---|
| [PROJECT-SCOPE.md](./01-project-scope/PROJECT-SCOPE.md) | Business requirements: roles, trip lifecycle, slot economy, payment system, notifications |

### 02 — Architecture

| File | Purpose |
|---|---|
| [ARCHITECTURE-OVERVIEW.md](./02-architecture/ARCHITECTURE-OVERVIEW.md) | Full system design: layers, SSE strategy, Prisma schema reasoning, slot economy flows, module map, edge cases |
| [DEEP-DIVE-QA.md](./02-architecture/DEEP-DIVE-QA.md) | Technical decision Q&A: TanStack Query vs Server Actions, SSE vs WebSockets, rendering zones |
| [SOFT-DELETE-STRATEGY.md](./02-architecture/SOFT-DELETE-STRATEGY.md) | Why all deletions are deactivations: slug registry, FK chains, financial record requirements |

### 03 — Implementation

| File | Purpose |
|---|---|
| [IMPLEMENTATION-GUIDE.md](./03-implementation/IMPLEMENTATION-GUIDE.md) | Phase-by-phase build steps covering Phases 0–18 (env setup through admin panel and notifications) |
| [TRIP-MODULE.md](./03-implementation/TRIP-MODULE.md) | Trip module: lifecycle, data model, backend service/controller spec, full API reference, frontend integration |

### 04 — Multilingual Content

| File | Purpose |
|---|---|
| [MULTILINGUAL-CONTENT.md](./04-multilingual/MULTILINGUAL-CONTENT.md) | Translation architecture, per-entity typed tables, category/destination/hub translation flows, AI translation jobs, ISR revalidation |

### 05 — Access Management

| File | Purpose |
|---|---|
| [ROLES-AND-ACCESS-MANAGEMENT.md](./05-access-management/ROLES-AND-ACCESS-MANAGEMENT.md) | All 6 roles defined, full permission matrix, dashboard nav access per role, API endpoint access, business rules, and 23 missing features with build specs |

### specs — Design PDFs

| File | Purpose |
|---|---|
| `Island Tours — Tour Detail Page Specification.pdf` | Full tour detail page wireframe and content spec |
| `Island Tours — Tour Detail Page Specification-1-8.pdf` | Pages 1–8 of the spec |
| `Island Tours — Tour Detail Page Specification-9-15.pdf` | Pages 9–15 |
| `Island Tours — Tour Detail Page Specification-16-20.pdf` | Pages 16–20 |
| `Island Tours — Tour Detail Page Specification-21-28.pdf` | Pages 21–28 |
| `Platform Architecture — Changelog.pdf` | Architecture changelog from client |
