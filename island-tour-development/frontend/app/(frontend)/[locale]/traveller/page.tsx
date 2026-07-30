import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { MountReveal } from '@/components/frontend/mount-reveal';
import { TravellerLoginCard } from '@/components/frontend/traveller/traveller-login-card';
import {
    TravellerView,
    type TravellerTab,
} from '@/components/frontend/traveller/traveller-view';
import { TravellerPageSkeleton } from '@/components/frontend/skeletons/traveller-page-skeleton';
import { isLocale, type Locale } from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';
import {
    getTravellerBookings,
    getTravellerPayments,
} from '@/lib/api/public/traveller';
import { getPublicSiteInfo } from '@/lib/api/public/settings';
import { getTravelerSessionToken } from '@/lib/traveler-session.server';
import { buildWhatsappUrl } from '@/lib/whatsapp';

type PageParams = { locale: string };
type PageSearch = { tab?: string; page?: string };

/**
 * Traveller account area - `/{locale}/traveller`.
 *
 * Signed in, it lists every booking made with the traveller's email plus the
 * full payment history. Signed out, the same URL renders the OTP login card,
 * so there is one address to remember and to link from email.
 *
 * The session is the backend-issued HMAC token, parked by this app in its OWN
 * first-party HttpOnly cookie and replayed as `x-traveler-session`. Nothing
 * here depends on a cookie crossing a site boundary, so it keeps working when
 * the public site moves to its own domain.
 */

/** Personal and account-gated - never indexed (review F13: page = bookings). */
export const metadata: Metadata = {
    title: 'Your bookings | Island Tours',
    robots: { index: false, follow: false },
};

/**
 * Enough room to centre the card without handing it a whole empty screen: a
 * full viewport height left the form marooned in the middle of nothing. This
 * sits the card comfortably above the fold and lets the footer peek in.
 */
const SIGNED_OUT_BAND =
    'flex min-h-[440px] items-center justify-center md:min-h-[960px]';

async function TravellerBody({
    locale,
    tab,
    page,
}: {
    locale: Locale;
    tab: TravellerTab;
    page: number;
}) {
    // Per-traveller data: opt out of the prerendered shell before reading the
    // session cookie, and never cache anything below this point.
    await connection();
    const [dict, sessionToken] = await Promise.all([
        getDictionary(locale),
        getTravelerSessionToken(),
    ]);

    const signedOut = (
        <section className={`${SIGNED_OUT_BAND} bg-it-surface px-4 py-14`}>
            <MountReveal className='w-full'>
                <TravellerLoginCard dict={dict.traveller} />
            </MountReveal>
        </section>
    );

    if (!sessionToken) return signedOut;

    const [bookings, payments, siteInfo] = await Promise.all([
        getTravellerBookings(sessionToken, tab === 'bookings' ? page : 1, locale),
        getTravellerPayments(sessionToken, tab === 'payments' ? page : 1),
        // Cached under `site-info` - powers the WhatsApp support entry points.
        getPublicSiteInfo(),
    ]);

    // Null means 401: no session, an expired one, or a weaker pair-login /
    // checkout token. All of those are "sign in here", not an error.
    if (!bookings || !payments) return signedOut;

    return (
        <TravellerView
            bookings={bookings}
            payments={payments}
            activeTab={tab}
            dict={dict.traveller}
            typDict={dict.thankYou}
            locale={locale}
            // eslint-disable-next-line react-hooks/purity -- request-time render (gated by connection() above); the free-cancellation copy needs a stable "now", and stamping it here keeps the client components pure
            nowMs={Date.now()}
            whatsappHref={buildWhatsappUrl(
                siteInfo.whatsappNumber,
                siteInfo.enableWhatsappChat
            )}
        />
    );
}

export default async function TravellerPage({
    params,
    searchParams,
}: {
    params: Promise<PageParams>;
    searchParams: Promise<PageSearch>;
}) {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();

    return (
        <Suspense fallback={<TravellerPageSkeleton />}>
            <TravellerBodyGate locale={locale} searchParams={searchParams} />
        </Suspense>
    );
}

/**
 * `searchParams` is awaited INSIDE the Suspense boundary on purpose: awaiting
 * it in the page body would make the whole route request-time and cost the
 * prerendered shell.
 */
async function TravellerBodyGate({
    locale,
    searchParams,
}: {
    locale: Locale;
    searchParams: Promise<PageSearch>;
}) {
    const { tab: rawTab, page: rawPage } = await searchParams;
    const tab: TravellerTab = rawTab === 'payments' ? 'payments' : 'bookings';
    const parsed = Number(rawPage);
    const page = Number.isInteger(parsed) && parsed > 0 ? parsed : 1;

    return <TravellerBody locale={locale} tab={tab} page={page} />;
}
