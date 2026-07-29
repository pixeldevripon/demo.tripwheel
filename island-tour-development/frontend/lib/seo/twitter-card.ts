import type { Metadata } from 'next';

/**
 * Page-level `twitter:title` / `twitter:description`.
 *
 * ## Why every indexable page needs this
 *
 * The root layout publishes an admin-authored sitewide Twitter title and
 * description (Settings > SEO). Next merges the `twitter` metadata object
 * SHALLOWLY, so a page that does not state its own inherits that sitewide copy
 * wholesale - while `og:title` / `og:description` are simultaneously correct,
 * because Next derives those from the page's own `title` / `description`.
 *
 * The result was a split personality on every deep page: sharing a tour to
 * Facebook previewed the tour, sharing the same URL to X previewed the generic
 * "Island Tours / Caribbean tours picked by locals."
 *
 * Passing nothing returns `{}`, which correctly leaves the sitewide value in
 * place - that is the right behaviour for the homepage, where the admin's
 * value IS the page's value.
 */
export function twitterCard(
    title?: string | null,
    description?: string | null,
): Pick<Metadata, 'twitter'> {
    if (!title && !description) return {};
    return {
        twitter: {
            ...(title ? { title } : {}),
            ...(description ? { description } : {}),
        },
    };
}
