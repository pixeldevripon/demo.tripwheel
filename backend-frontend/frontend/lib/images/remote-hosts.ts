/**
 * The hosts `next/image` is allowed to load from - the SINGLE source of truth.
 *
 * `next.config.ts` builds its `images.remotePatterns` from this list, and
 * `safeRemoteImage()` below re-checks it at render time. One list, two consumers,
 * so they cannot drift.
 *
 * WHY THE RUNTIME CHECK EXISTS: `next/image` THROWS during render when `src` is a
 * host it was not configured for. Most image URLs on this site come from the
 * database, entered by an admin - and the homepage hero is a SINGLETON rendered
 * on every locale's front page inside the prerendered shell, with no error
 * boundary. Without this guard, one mistyped hostname in the dashboard takes the
 * homepage down in every language until someone corrects the row. Falling back to
 * bundled art instead is the same "never blank" contract the rest of the homepage
 * content follows.
 *
 * The backend independently rejects non-https and malformed URLs at write time;
 * this is the layer that handles a well-formed URL on an unexpected host.
 */

export const ALLOWED_IMAGE_HOSTS = [
    'res.cloudinary.com',
    'lh3.googleusercontent.com',
    // Demo seed image host (picsum.photos redirects to fastly.picsum.photos).
    // Remove together with the demo seed before production.
    'picsum.photos',
    'fastly.picsum.photos',
    // Curated category hero photos (seeded heroImage). Swap for self-hosted
    // assets before production.
    'images.unsplash.com',
] as const;

const ALLOWED = new Set<string>(ALLOWED_IMAGE_HOSTS);

/**
 * Is this a src `next/image` can actually render? Relative paths (our bundled
 * assets) always pass; absolute URLs must be https on an allow-listed host.
 */
export function isRenderableImageSrc(src: string): boolean {
    if (!src) return false;
    // Bundled asset (`/images/...`), served by this app.
    if (src.startsWith('/') && !src.startsWith('//')) return true;

    try {
        const url = new URL(src);
        return url.protocol === 'https:' && ALLOWED.has(url.hostname);
    } catch {
        return false;
    }
}

/**
 * The src to actually render: the candidate if it is renderable, otherwise the
 * fallback. Use for every database-sourced image so a bad row degrades to
 * bundled art rather than throwing mid-render.
 */
export function safeRemoteImage(
    candidate: string | null | undefined,
    fallback: string,
): string;
export function safeRemoteImage(
    candidate: string | null | undefined,
    fallback?: null,
): string | null;
export function safeRemoteImage(
    candidate: string | null | undefined,
    fallback: string | null = null,
): string | null {
    if (candidate && isRenderableImageSrc(candidate)) return candidate;
    return fallback;
}
