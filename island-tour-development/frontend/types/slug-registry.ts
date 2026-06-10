/**
 * Slug-registry resolution types — mirror of the backend `SlugRegistry` row
 * returned by `GET /api/v1/slug-registry/resolve`.
 *
 * See `technical-doc/02-architecture/ROUTING-AND-RESOLUTION.md` §4–§5 and
 * `SLUG-REGISTRY.md`. The third URL segment (`/{dest}/{slug}/`) is polymorphic;
 * this resolution tells the router which page to render.
 */

export type SlugEntityType =
    | 'CATEGORY'
    | 'HUB'
    | 'COLLECTION'
    | 'TOUR'
    | 'RESERVED';

export interface SlugResolution {
    destinationSlug: string;
    slug: string;
    entityType: SlugEntityType;
    /** UUID of the owning entity. `null` only when `entityType === 'RESERVED'`. */
    entityId: string | null;
}
