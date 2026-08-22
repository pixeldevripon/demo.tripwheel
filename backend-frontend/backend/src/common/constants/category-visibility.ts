/**
 * Master §2.4 - category page visibility.
 *
 * A category page is publicly live ONLY when it has at least this many published
 * tours in that (category, destination) pair. Below the bar the page is treated as
 * draft: "excluded from navigation, sitemaps, internal links, and search".
 *
 * The master settles this explicitly - "Confirmed June 10, 2026: the 3-plus
 * automation rule stands; the architecture file's threshold of 1 is superseded" -
 * so this is the number, not the 1 the services used to gate on.
 *
 * Every gate that decides whether a category page EXISTS reads this constant, so
 * they can never drift apart:
 *   - `CategoryService.getActiveByDestinationSlug` - the discovery lists (hero
 *     "Popular" links, destination "Explore by type" cards, footer, All-Tours
 *     pills, `generateStaticParams`).
 *   - `CategoryService.getBySlugForDestination`   - the page itself (404s below).
 *   - `SitemapService.getEntries`                 - `/sitemap.xml`.
 *
 * Hubs and collections have their own gates (≥1 published tour / PUBLISHED) and
 * deliberately do NOT read this - the master's threshold is about categories.
 */
export const CATEGORY_PAGE_MIN_TOURS = 3;
