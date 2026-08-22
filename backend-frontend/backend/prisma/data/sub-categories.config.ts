/**
 * Canonical sub-category taxonomy (client review #77 / master 2.4 + E.2).
 *
 * Master 2.4 locks 19 top-level categories, one set reused across every
 * destination. Everything below is the sub-layer: filter-only refinements
 * that drive the Row 2 chips on their parent's category page - no slug
 * registry rows, no standalone pages, single-level nesting (the existing
 * parent-child category machinery).
 *
 * THE SYSTEM: this file is the source of truth and
 * `pnpm subcategories:sync` (scripts/sync-sub-categories.ts) makes the
 * database match it - creating missing sub-categories, demoting existing
 * top-level extras onto their parent (retiring their page slugs), and
 * retagging tours so every tour tagged with a sub-category also carries its
 * parent. Adding a future sub-category = add a line here, run the command
 * (works on the production VPS; see the script header). Idempotent.
 */

export interface SubCategorySpec {
  /** Globally-unique category slug (always English). */
  slug: string;
  /** Display name used only when the row has to be CREATED. */
  name: string;
  /** Slug of the top-level parent the sub-category refines. */
  parentSlug: string;
}

export interface BookingTypeRemovalSpec {
  /** Category to dissolve entirely - it duplicates a booking_type. */
  slug: string;
  /** The TourBookingType its tours are stamped with instead. */
  bookingType: 'PRIVATE';
}

export interface SubCategorySyncConfig {
  subCategories: SubCategorySpec[];
  removeToBookingType: BookingTypeRemovalSpec[];
}

/** The client's mapping (review comment 16, verbatim). */
export const SUB_CATEGORY_SYNC: SubCategorySyncConfig = {
  subCategories: [
    {
      slug: 'catamaran-cruises',
      name: 'Catamaran Cruises',
      parentSlug: 'boat-tours',
    },
    { slug: 'sailing-trips', name: 'Sailing Trips', parentSlug: 'boat-tours' },
    {
      slug: 'powerboat-tours',
      name: 'Powerboat Tours',
      parentSlug: 'boat-tours',
    },
    {
      slug: 'yacht-charters',
      name: 'Yacht Charters',
      parentSlug: 'luxury-experiences',
    },
    { slug: 'buggy-tours', name: 'Buggy Tours', parentSlug: 'off-road-tours' },
    {
      slug: 'zipline-tours',
      name: 'Zipline Tours',
      parentSlug: 'adventure-tours',
    },
  ],
  removeToBookingType: [
    // "Private Charter goes back to the booking_type it already is."
    { slug: 'private-charter', bookingType: 'PRIVATE' },
  ],
};
