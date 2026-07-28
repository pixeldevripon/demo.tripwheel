import {
    NotFoundScreen,
    type NotFoundHub,
    type NotFoundPopular,
    type NotFoundQuickLink,
} from '@/components/frontend/status/not-found-screen';
import {
    getActiveDestinations,
    getDestinationCategories,
    getDestinationHubs,
    getDestinationTours,
} from '@/lib/api/public';
import { getPublicSiteInfo } from '@/lib/api/public/settings';
import { DEFAULT_LOCALE } from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { buildWhatsappUrl } from '@/lib/whatsapp';

/**
 * The default destination a 404 recovers into (MCK-10 dev note: no destination
 * intent can be assumed, so everything - hub placement, quick links, popular
 * strip, CTAs - is scoped to the launch island). Falls back to the first
 * active destination if this slug is ever retired.
 */
const PRIMARY_DESTINATION_SLUG = 'curacao';

/** The hub featured in the hero's right column (MCK-10: Klein Curaçao). */
const FEATURED_HUB_SLUG = 'klein-curacao';

/** Quick-link chips after the featured hub: the top N categories. */
const QUICK_LINK_CATEGORIES = 3;

/**
 * The public 404 (MCK-10). Renders for every `notFound()` under `/{locale}` -
 * an unknown destination, category, hub, collection or tour slug - and inside
 * the locale layout, so the navbar and footer stay put and the traveler is
 * never dropped onto a bare page.
 *
 * `not-found.tsx` receives no `params`, so the LANGUAGE is resolved from the
 * pathname inside <NotFoundScreen> (a client leaf) - but the DATA here is
 * fetched in the default locale: island, hub and category names are proper
 * nouns or near-universal labels, and everything below the headline is a
 * recovery aid, not page content. Every fetch degrades silently (empty list /
 * disabled flag) when the backend is unreachable, so a 404 during an outage
 * just loses its extras instead of failing into the error boundary.
 */
export default async function LocaleNotFound() {
    const [destinations, siteInfo, dict] = await Promise.all([
        getActiveDestinations(),
        getPublicSiteInfo(),
        getDictionary(DEFAULT_LOCALE),
    ]);

    const primary =
        destinations.find(d => d.slug === PRIMARY_DESTINATION_SLUG) ??
        destinations[0];

    // Primary-destination data: the "Popular right now" strip (recommended
    // ranking, same as listing pages), the tour-gated hub list for the hero
    // placement, and the tour-gated categories for the quick-link chips.
    const [popularTours, hubs, categories] = primary
        ? await Promise.all([
              getDestinationTours({
                  destinationId: primary.id,
                  sort: 'recommended',
                  limit: 4,
              }),
              getDestinationHubs(primary.slug),
              getDestinationCategories(primary.slug),
          ])
        : [{ total: 0, data: [] }, [], []];

    // Hero hub placement: Klein Curaçao by slug, else the first hub. The hub's
    // OWN heroImage only - no stand-in art; the figure falls back to its
    // bg-it-border background like every photo container sitewide.
    const hubRow =
        hubs.find(h => h.slug === FEATURED_HUB_SLUG) ?? hubs[0];
    const hub: NotFoundHub | undefined =
        hubRow && primary
            ? {
                  src: hubRow.heroImage ?? null,
                  caption: `${hubRow.name} · ${primary.name}`,
                  path: `/${primary.slug}/${hubRow.slug}`,
              }
            : undefined;

    // "Or jump straight to" chips: the featured hub first, then categories
    // (MCK-10 order).
    const quickLinks: NotFoundQuickLink[] = primary
        ? [
              ...(hubRow
                  ? [
                        {
                            name: hubRow.name,
                            path: `/${primary.slug}/${hubRow.slug}`,
                        },
                    ]
                  : []),
              ...categories.slice(0, QUICK_LINK_CATEGORIES).map(cat => ({
                  name: cat.name,
                  path: `/${primary.slug}/${cat.slug}`,
              })),
          ]
        : [];

    const popular: NotFoundPopular = {
        hits: popularTours.data,
        total: popularTours.total,
        browsePath: primary ? `/${primary.slug}/tours` : undefined,
        cardDict: dict.destination.listings,
        durationDict: {
            hours: dict.search.hours,
            hour: dict.search.hour,
            minutes: dict.search.minutes,
            range: dict.search.range,
        },
    };

    return (
        <NotFoundScreen
            quickLinks={quickLinks}
            hub={hub}
            popular={popular}
            destinationName={primary?.name}
            explorePath={primary ? `/${primary.slug}/tours` : undefined}
            whatsappUrl={buildWhatsappUrl(
                siteInfo.whatsappNumber,
                siteInfo.enableWhatsappChat
            )}
        />
    );
}
