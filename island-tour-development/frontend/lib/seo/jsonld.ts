import { DEFAULT_LOCALE, type Locale } from '@/lib/constants/locales';

/**
 * schema.org JSON-LD builders. All are PURE (no fetching): callers pass the data
 * they already loaded, and every URL is absolutized against `siteUrl` (from
 * `getSiteUrl`). Each returns a plain object for `<JsonLd data={...} />`, or null
 * when there is nothing valid to emit (so callers can render unconditionally).
 */

type Json = Record<string, unknown>;

/** Absolute, locale-prefixed URL for a locale-less path (`/curacao/x`). */
function abs(siteUrl: string, locale: Locale, path: string): string {
    return `${siteUrl}/${locale}${path}`;
}

/**
 * Sitewide Organization: brand identity + social `sameAs`. Drop empty social
 * URLs so `sameAs` only lists real profiles.
 */
export function buildOrganizationJsonLd(input: {
    siteUrl: string;
    name: string;
    logo: string | null;
    sameAs: (string | null)[];
    email: string | null;
    phone: string | null;
}): Json {
    const sameAs = input.sameAs.filter((u): u is string => !!u);
    return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: input.name,
        url: input.siteUrl,
        ...(input.logo ? { logo: input.logo } : {}),
        ...(sameAs.length ? { sameAs } : {}),
        ...(input.email || input.phone
            ? {
                  contactPoint: {
                      '@type': 'ContactPoint',
                      contactType: 'customer support',
                      ...(input.email ? { email: input.email } : {}),
                      ...(input.phone ? { telephone: input.phone } : {}),
                  },
              }
            : {}),
    };
}

/**
 * Sitewide WebSite with a SearchAction (the sitelinks search box). Points at the
 * default-locale search page; `{search_term_string}` is substituted by Google.
 */
export function buildWebSiteJsonLd(input: {
    siteUrl: string;
    name: string;
}): Json {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: input.name,
        url: input.siteUrl,
        potentialAction: {
            '@type': 'SearchAction',
            target: {
                '@type': 'EntryPoint',
                urlTemplate: `${input.siteUrl}/${DEFAULT_LOCALE}/search?q={search_term_string}`,
            },
            'query-input': 'required name=search_term_string',
        },
    };
}

/**
 * BreadcrumbList from an ordered trail. Item 1 is always Home; pass the rest as
 * locale-less paths. The last item is the current page.
 */
export function buildBreadcrumbJsonLd(input: {
    siteUrl: string;
    locale: Locale;
    /** Ordered, EXCLUDING Home. Each: display name + locale-less path. */
    trail: { name: string; path: string }[];
}): Json {
    const items = [
        { name: 'Home', path: '' },
        ...input.trail,
    ].map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.name,
        item: abs(input.siteUrl, input.locale, item.path),
    }));

    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items,
    };
}

/** FAQPage from question/answer pairs. Null when there are no FAQs. */
export function buildFaqJsonLd(
    faqs: { question: string; answer: string }[],
): Json | null {
    const valid = faqs.filter((f) => f.question?.trim() && f.answer?.trim());
    if (valid.length === 0) return null;

    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: valid.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
    };
}

/** TouristDestination for an island page. */
export function buildTouristDestinationJsonLd(input: {
    siteUrl: string;
    locale: Locale;
    path: string;
    name: string;
    description: string | null;
    image: string | null;
}): Json {
    return {
        '@context': 'https://schema.org',
        '@type': 'TouristDestination',
        name: input.name,
        url: abs(input.siteUrl, input.locale, input.path),
        ...(input.description ? { description: input.description } : {}),
        ...(input.image ? { image: input.image } : {}),
    };
}

/**
 * TouristTrip for a tour page. Kept lean so it never contradicts the existing
 * review `Product` graph (which owns price + aggregateRating): this describes the
 * trip itself (name, image, itinerary) without a second Offer/rating.
 */
export function buildTouristTripJsonLd(input: {
    siteUrl: string;
    locale: Locale;
    path: string;
    name: string;
    description: string | null;
    images: string[];
    destinationName: string | null;
    providerName: string | null;
}): Json {
    return {
        '@context': 'https://schema.org',
        '@type': 'TouristTrip',
        name: input.name,
        url: abs(input.siteUrl, input.locale, input.path),
        ...(input.description ? { description: input.description } : {}),
        ...(input.images.length ? { image: input.images } : {}),
        ...(input.destinationName
            ? {
                  itinerary: {
                      '@type': 'TouristDestination',
                      name: input.destinationName,
                  },
              }
            : {}),
        ...(input.providerName
            ? { provider: { '@type': 'Organization', name: input.providerName } }
            : {}),
    };
}
