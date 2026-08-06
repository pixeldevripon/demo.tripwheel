/**
 * Slug-registry resolution types - mirror of the backend `SlugRegistry` row
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

export interface SlugResolutionEntity {
    redirect?: false;
    destinationSlug: string;
    slug: string;
    entityType: SlugEntityType;
    /** UUID of the owning entity. `null` only when `entityType === 'RESERVED'`. */
    entityId: string | null;
}

/**
 * A slug that has been RENAMED. The registry keeps a `slug_redirects` row per
 * rename, and the resolver answers `200` with this shape rather than `404` -
 * the old URL is not unknown, it has moved.
 *
 * It must be a distinct variant, not an optional field on the entity shape:
 * this response carries no `entityType`, so code that reads one off the
 * resolution without narrowing first gets `undefined` and falls through to the
 * not-found branch. That is exactly the soft-404 (HTTP 200 on the generic
 * shell) this type was added to make impossible.
 */
export interface SlugResolutionRedirect {
    redirect: true;
    statusCode: number;
    destinationSlug: string;
    fromSlug: string;
    toSlug: string;
    entityType: SlugEntityType;
}

export type SlugResolution = SlugResolutionEntity | SlugResolutionRedirect;

/** Narrow a resolution to the renamed-slug variant. */
export function isSlugRedirect(
    resolution: SlugResolution
): resolution is SlugResolutionRedirect {
    return resolution.redirect === true;
}
