---
name: toslug-duplication
description: toSlug helper is copy-pasted into 4 dashboard form files — extract to shared util
metadata:
  type: feedback
---

`toSlug` is defined identically in:
- `components/dashboard/destinations/destination-form.tsx`
- `components/dashboard/collections/collection-form.tsx`
- `components/dashboard/trips/trip-form.tsx`
- `components/dashboard/categories/category-form.tsx`

**Why:** Violates DRY; any normalisation tweak must be made in 4 places.

**How to apply:** Extract to `lib/utils/slug.ts` and import everywhere. CLAUDE.md already shows `toSlug` in the frontend slug-field pattern section — that reference should point to the shared util.
