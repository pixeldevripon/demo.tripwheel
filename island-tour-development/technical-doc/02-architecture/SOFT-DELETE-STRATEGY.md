# Soft-delete strategy

> **Canonical source:** master §2.3. Why every "delete" in the platform is a deactivation
> (`isActive: false`) rather than a row removal, and when a hard delete is actually allowed.

## Principle

Deactivate, do not destroy. Setting `isActive = false` (or entity `status = archived`) hides an
entity from the public site and navigation while keeping its row, its slug claim, and its
relationships intact. This is reversible with one toggle. Hard deletes are reserved for the narrow,
guarded cases below.

## Why soft delete is load-bearing

1. **Slug + URL protection.** The slug registry maps every public URL to one entity. Removing a row
   frees the slug and risks a future entity claiming the same URL, breaking external links and
   confusing the search index. A deactivated entity keeps its `slug_registry` row with
   `is_active = false`: the URL stays claimed and the page returns 404. See
   [SLUG-REGISTRY.md](./SLUG-REGISTRY.md).
2. **Booking + financial records.** Bookings reference the tour → operator → destination chain and
   snapshot the commission at booking time (`commission_rate`, `commission_amount`). Hard-deleting
   any link would violate foreign keys or cascade-destroy immutable financial history. See
   [BOOKING-AND-PAYMENTS.md](./BOOKING-AND-PAYMENTS.md).
3. **Seeded entities.** The launch destinations and the 19 global categories are seeded
   (`isSeeded = true`) and must never be deleted. Services throw `403 Forbidden` on any delete of a
   seeded entity, even a force delete.
4. **Translation cost.** Each entity carries up to 7 locales of translations and per-locale page
   content. Soft delete preserves all of it for instant reactivation; a hard delete throws away
   real translation work.

## Slug reuse after deletion (master rule)

The master replaces the older "slugs are immutable, never reused" stance:

- **Rename** an entity slug → a `301` redirect from the old path to the new one is created
  automatically (redirect table).
- **Delete** a slug → it enters a **90-day soft-delete cooldown** before it can be reused by another
  entity in the same destination, protecting against stale external links and index confusion.

So a slug is genuinely freed only after the cooldown, and even then the old URL still resolves via
its 301 if a rename was involved. See [ROUTING-AND-RESOLUTION.md](./ROUTING-AND-RESOLUTION.md).

## What changed from the prior design

The featured-slot economy is **removed** (replaced by commission tiers, see
[COMMERCIAL-MODEL.md](./COMMERCIAL-MODEL.md)). The previous "FeaturedSlot rows are permanent /
SlotHistory audit trail" rationale for soft delete no longer applies and has been dropped. The
remaining reasons (slug protection, booking records, seeded entities, translations) still make soft
delete non-negotiable.

## Hard delete (guarded)

A force-delete endpoint (`MANAGE_SYSTEM`) exists for genuine cleanup of entities that were never
public and have no bookings. It must:
- refuse seeded entities (`isSeeded = true` → 403),
- refuse entities with any booking history,
- remove the `slug_registry` row only after honoring the 90-day cooldown rule,
- run inside a transaction with the entity removal.
