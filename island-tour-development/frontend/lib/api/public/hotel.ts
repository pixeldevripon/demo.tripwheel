/**
 * Island Tours' own apartment promo (server-side, cached).
 *
 * Hits `GET /hotels/public`, which returns the ONE hotel the page should promote -
 * the first enabled, complete one in the admin's order - flattened onto one
 * locale. It renders as the last card on the thank-you page, advertising OUR
 * property to a traveller who has just booked a tour.
 *
 * THE CONTRACT IS `enabled`, and it differs from the homepage's on purpose.
 * There, every null field falls back to a bundled dictionary default, because
 * the homepage must always render. Here there is no honest built-in fallback: we
 * ship no default apartment name, photo or booking link, and inventing one would
 * advertise a property that does not exist. So the backend decides whether the
 * card is renderable and nulls everything when it is not - the page gates on this
 * one flag and nothing else. Chrome labels (the eyebrow, the CTA text) still fall
 * back to the dictionary, which is already translated in all 7 locales.
 *
 * Consequently this uses `publicGet` (soft null on any failure), never
 * `publicGetStrict`: a backend outage must drop one promo card off a
 * confirmation page, never 404 the page that tells a traveller they are booked.
 */
import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import type { Currency, Locale } from '@/lib/constants/locales';
import { DEFAULT_LOCALE } from '@/lib/constants/locales';

import { buildQuery, publicGet } from './fetch';

export interface PublicHotel {
    /**
     * The ONLY gate the section obeys. False when an admin switched the promo off
     * or left out any of the three essentials (photo, title, booking link), in
     * which case every field below is null.
     */
    enabled: boolean;
    locale: Locale;
    imageUrl: string | null;
    bookingUrl: string | null;
    /** Numbers, not Decimal strings - the backend converts before sending. */
    rating: number | null;
    reviewCount: number | null;
    sleeps: number | null;
    pricePerNight: number | null;
    /** The price's OWN currency; the card renders this symbol, never a literal $. */
    currency: Currency;
    /** Null keeps the bundled (already translated) eyebrow label. */
    eyebrow: string | null;
    areaLabel: string | null;
    title: string | null;
    /** One entry per paragraph; the backend splits the stored text on newlines. */
    descriptionLines: string[];
    /** Null keeps the bundled (already translated) CTA label. */
    ctaLabel: string | null;
}

/** The "do not render" answer - what an outage or a wrong-shaped response means. */
function hiddenHotel(locale: Locale): PublicHotel {
    return {
        enabled: false,
        locale,
        imageUrl: null,
        bookingUrl: null,
        rating: null,
        reviewCount: null,
        sleeps: null,
        pricePerNight: null,
        currency: 'USD',
        eyebrow: null,
        areaLabel: null,
        title: null,
        descriptionLines: [],
        ctaLabel: null,
    };
}

/**
 * Content an admin changes rarely but expects to see live, same contract as
 * `getHomePageContent`: `cacheLife('days')` under the `hotel` tag, which the
 * dashboard busts on save - so the long window costs nothing in staleness.
 *
 * Cached even though the page around it is not: the booking lookup is
 * per-traveller and uncached, but this card is the same for everyone, so it must
 * not be re-fetched on every confirmation view.
 */
export async function getHotelPromo(
    locale: Locale = DEFAULT_LOCALE,
): Promise<PublicHotel> {
    'use cache';
    cacheLife('days');
    cacheTag('hotels');

    const res = await publicGet<Partial<PublicHotel>>(
        `/hotels/public${buildQuery({ locale })}`,
    );

    return normalize(res, locale);
}

/**
 * Fill in whatever the API did not send, and never let a wrong-shaped response
 * render a card.
 *
 * `publicGet` soft-nulls "no response"; it does NOT cover a response of the wrong
 * SHAPE, and the two services deploy independently. `enabled` is coerced to a
 * strict `true` and `descriptionLines` re-checked as an array, so an older or
 * newer backend degrades to a hidden section instead of throwing inside
 * `.map()` on the page a traveller reaches immediately after paying.
 */
function normalize(
    res: Partial<PublicHotel> | null,
    locale: Locale,
): PublicHotel {
    const hidden = hiddenHotel(locale);
    if (!res || res.enabled !== true) return hidden;

    return {
        ...hidden,
        ...res,
        enabled: true,
        locale,
        descriptionLines: Array.isArray(res.descriptionLines)
            ? res.descriptionLines
            : [],
    };
}
