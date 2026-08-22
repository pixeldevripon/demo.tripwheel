import type { Metadata } from 'next';

import { getMediaSeo, normalizeUrl } from '@/lib/api/public/media';

/**
 * One `og:image`. Spelled out rather than reusing Next's `OGImage`, which is a
 * union of "string | descriptor | array of either" - so the union itself has no
 * `.length` and cannot express "always an array of descriptors".
 */
type OgImageEntry = {
    url: string;
    alt: string;
    width?: number;
    height?: number;
};

/**
 * `openGraph.images` entries carrying localized `alt` text from the media library.
 *
 * ## Why this exists
 *
 * Entity tables store a bare image URL (`heroImage`, `ogImage`, `TourImage.url`)
 * and no media id - picking an image in the dashboard copies the URL out and
 * nothing links back. So an og:image had no alt source at all, on every page but
 * the tour page. `og:image:alt` is what a screen reader announces for a shared
 * link's preview, and what several crawlers read as the image's description.
 *
 * The alt text comes from the media library, per locale, resolved field by field
 * against English. `fallback` (usually the entity's own already-localized name)
 * covers the asset having no alt text set - which is the common case today, and
 * is why this never returns an entry without an alt.
 *
 * ## Ordering is the caller's job
 *
 * Pass URLs already filtered through `filterIndexableImages` and already in the
 * order you want them published: this helper preserves the order it is given and
 * does NOT apply the exclude-from-indexing rule. Keeping those separate means a
 * caller cannot accidentally publish an excluded image just by asking for its
 * alt text.
 */
export async function ogImagesWithAlt(
    urls: Array<string | null | undefined>,
    locale: string,
    fallback: string,
    extra?: (url: string) => { width?: number | null; height?: number | null },
): Promise<OgImageEntry[]> {
    const present = urls.filter((u): u is string => !!u);
    if (present.length === 0) return [];

    const seo = await getMediaSeo(present, locale);

    return present.map(url => {
        const dimensions = extra?.(url);
        return {
            url,
            alt: seo.get(normalizeUrl(url))?.altText || fallback,
            // Omit rather than send null: Next renders `og:image:width` from
            // whatever is here, and "null" is not a width.
            ...(dimensions?.width ? { width: dimensions.width } : {}),
            ...(dimensions?.height ? { height: dimensions.height } : {}),
        };
    });
}

/**
 * The single-image case: `...(await ogImageMeta(url, locale, name))` drops in
 * where `openGraph: { images: [{ url }] }` used to sit, and yields `{}` when
 * there is no image so it can be spread unconditionally.
 */
export async function ogImageMeta(
    url: string | null | undefined,
    locale: string,
    fallback: string,
): Promise<Pick<Metadata, 'openGraph'>> {
    if (!url) return {};
    const images = await ogImagesWithAlt([url], locale, fallback);
    return images.length ? { openGraph: { images } } : {};
}
