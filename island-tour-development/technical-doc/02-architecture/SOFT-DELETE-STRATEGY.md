# Soft Delete Strategy — Island Tours

> **Why every "Delete" action in the admin dashboard deactivates rather than removes.**

---

## What Is Soft Delete?

Hard delete removes the database row permanently. Soft delete sets a flag (`isActive: false`) and keeps the row. The record disappears from all public-facing pages and from the default admin list view, but it remains in the database indefinitely.

Every `DELETE /api/v1/:module/:id` endpoint in this project performs a soft delete.

---

## Why Soft Delete Is the Only Safe Choice Here

### 1. The Slug Registry — The Primary Reason

The entire public URL architecture depends on the `slug_registry` table:

```
/{locale}/{destination}/            → Destination page
/{locale}/{destination}/{slug}/     → Category | Hub | Tour (resolved dynamically)
```

The registry enforces `UNIQUE (destination_slug, slug)`. Every category and hub creates a row here on creation. That row's job is to **permanently own that slug** — even after the entity is "deleted".

From `ARCHITECTURE_OVERVIEW.md`:
> `is_active = false` when entity is disabled — row stays (protects the slug), page returns 404.

If you hard-deleted a destination, hub, or category:
- The slug would be freed and could be claimed by something new
- A traveler's bookmark or a Google-indexed URL would silently resolve to the wrong page
- Old `slug_registry` rows with `entity_type: 'category'` or `entity_type: 'hub'` would point to a non-existent row, breaking the dynamic page resolver

Soft delete keeps the slug locked forever. The public site sees a clean 404. The slug is never re-used.

---

### 2. Booking & Financial Records — Legal Requirement

The database reference chain is:

```
Destination
  └── Hub
       └── Category
            └── FeaturedSlot
                 └── Trip
                      └── Booking (commission stored at booking time)
                           └── Review
```

Bookings store the commission rate **at the time of booking** — by design — so historical earnings are never retroactively altered. If you hard-deleted a Category or Destination, two things would happen:

- **Either Postgres rejects it** — FK constraint violation because Trips and Bookings still reference it
- **Or a cascade delete wipes it** — destroying all booking history for every trip in that category or destination, which violates financial record-keeping obligations

Soft delete keeps the chain intact. Historical bookings remain fully auditable.

---

### 3. FeaturedSlot Rows Are Permanent by Design

From `ARCHITECTURE_OVERVIEW.md`:
> FeaturedSlot rows are permanent — created when a category is created. Never INSERT or DELETE these in normal operation. Only UPDATE: status, tripId, acquiredAt, expiresAt. Every category always has exactly 3 rows.

Every category creation seeds exactly 3 `FeaturedSlot` rows (rank 1, 2, 3). These rows are the backbone of the slot economy — operators lock them, publish against them, join waitlists for them.

If a category were hard-deleted:
- All 3 FeaturedSlot rows would cascade-delete
- Any operator currently in the creation wizard holding a soft-lock on one of those slots would have their `SlotLock` record orphaned
- Any operator in the `WaitlistEntry` queue would lose their position
- BullMQ jobs scheduled to fire for those slots (TTL expiry, waitlist offers) would run against missing rows

Soft delete prevents all of this. The category goes invisible; the slot machinery continues undisturbed.

---

### 4. SlotHistory Audit Trail

Every slot state change writes a row to `SlotHistory`:

```
SlotHistory
  featuredSlotId → FeaturedSlot → categoryId → Category
```

`SlotHistory` is required for the **7-day turnover heatmap** in the operator slot picker UI. Hard-deleting a category would orphan all its slot history rows, breaking the heatmap and destroying the audit trail.

---

### 5. Seeded Entities Must Survive All Admin Actions

Core platform entities (Caribbean destinations, default hub areas) are seeded with `isSeeded: true`. The service explicitly blocks deletion of these:

```typescript
if (entity.isSeeded) throw new ForbiddenException('Seeded entities cannot be deleted');
```

Using the same `isActive: false` pattern for all entities — seeded and non-seeded alike — keeps the service logic uniform. There is no special-case branch. Everything goes through one code path.

---
### 6. Translation Work Is Expensive — Preserve It

Each entity owns translation rows for 7 locales (`en, es, nl, pt, fr, de, zh`), with `onDelete: Cascade` on the FK. A hard delete would silently destroy all translations the admin (or AI background job) spent time and cost producing. Soft delete preserves them. If the entity is reactivated, all translations are immediately available again.

---

### 7. Recovery and Reversibility

Soft delete is fully reversible. An admin can switch the Status filter to "Inactive", find the record, and use the "Activate" bulk action to restore it. Hard delete has no undo.

---

## Is This Best Practice for This Project's Scope?

**Yes — unambiguously.**

Soft delete is not just a convention here; it is **load-bearing architecture**. Three independent structural requirements make hard delete unsafe:

| Requirement | Hard delete outcome |
|---|---|
| Slug registry `UNIQUE` constraint protects public URLs | Slug freed → URL collision risk |
| Booking records reference entity chain | FK violation or cascade data loss |
| FeaturedSlot permanent rows tied to categories | Slot economy state silently destroyed |

Beyond these three blockers, the project also benefits from:

- **Auditability** — nothing disappears; admins can always inspect what existed
- **Compliance** — financial records (commissions, payouts) must be retained
- **Reversibility** — deactivating a destination by mistake is a one-click fix; hard delete is permanent
- **Translation preservation** — 7-locale content survives deactivation

The only realistic alternative would be a hard delete with manual cleanup of slugs, slot rows, and booking references — a multi-step transaction that is complex, error-prone, and still unsafe for entities with booking history. The complexity cost is not worth it for an admin CMS where deletion is a rare operation.

**Soft delete is the correct and only practical strategy for this project.**

---

## How It Works in the Dashboard

| User action | What actually happens |
|---|---|
| Admin clicks "Delete" and confirms | `isActive: false` set in DB; slug registry row set to `isActive: false` |
| List view | Defaults to "Active" filter — deactivated item disappears |
| Public site | Entity URL returns 404 |
| Status filter → "Inactive" | Deactivated items appear; can be bulk-activated to restore |
| Booking history | Unaffected — all historical records remain fully intact |

---

## Summary

Soft delete in this project is not a lazy shortcut. It is the direct consequence of three architectural decisions made before the first line of code was written:

1. **URL slugs are permanent** — the slug registry protects them by keeping rows alive
2. **Booking records are immutable** — commission rates and history must never be lost
3. **FeaturedSlot rows are permanent** — the slot economy depends on them always existing

Any one of these three reasons alone would justify soft delete. All three together make it non-negotiable.
