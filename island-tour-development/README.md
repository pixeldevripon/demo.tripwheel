# Island Tours

Caribbean tour marketplace. Operators list trips and compete for 3 featured slots per category. Travelers book instantly.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | NestJS 11 · TypeScript · Prisma 7 · PostgreSQL |
| Frontend | Next.js 15 (App Router) · TanStack Query · Tailwind v4 |
| Auth | Better Auth (backend-hosted) |
| Real-time | Server-Sent Events (SSE) · Redis pub/sub |
| Jobs | BullMQ · Redis (Upstash) |
| Uploads | Cloudinary |
| Payments | Stripe · Mollie · PayPal |
| i18n | next-intl · 7 locales (en, es, nl, pt, fr, de, zh) |

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

---

## Documentation

All technical documentation lives in [`technical-doc/`](./technical-doc/).

| Doc | Description |
|---|---|
| [Project Scope](./technical-doc/01-project-scope/PROJECT-SCOPE.md) | Business requirements, user roles, feature list |
| [Architecture Overview](./technical-doc/02-architecture/ARCHITECTURE-OVERVIEW.md) | System design, schema reasoning, slot economy, SSE strategy |
| [Deep Dive Q&A](./technical-doc/02-architecture/DEEP-DIVE-QA.md) | Technical decisions explained (data fetching, auth split, rendering) |
| [Soft Delete Strategy](./technical-doc/02-architecture/SOFT-DELETE-STRATEGY.md) | Why every "delete" is a deactivation — slug registry, FK chains, financial records |
| [Implementation Guide](./technical-doc/03-implementation/IMPLEMENTATION-GUIDE.md) | Phase-by-phase build steps (Phases 0–18) |
| [Trip Module](./technical-doc/03-implementation/TRIP-MODULE.md) | Trip lifecycle, child entities, API reference, frontend integration |
| [Multilingual Content](./technical-doc/04-multilingual/MULTILINGUAL-CONTENT.md) | Translation architecture, per-entity flows (category, destination, hub), AI jobs |
| [Roles & Access Management](./technical-doc/05-access-management/ROLES-AND-ACCESS-MANAGEMENT.md) | All 6 roles, permission matrix, dashboard navigation, missing features roadmap |

**Design specs (PDF):** [`technical-doc/specs/`](./technical-doc/specs/)

---

## Claude Code

Active instructions for Claude Code are in [`CLAUDE.md`](./CLAUDE.md) (root) and [`CLAUDE-reference.md`](./CLAUDE-reference.md).
Frontend-specific rules: [`frontend/AGENTS.md`](./frontend/AGENTS.md) · [`frontend/DASHBOARD-PATTERNS.md`](./frontend/DASHBOARD-PATTERNS.md).
