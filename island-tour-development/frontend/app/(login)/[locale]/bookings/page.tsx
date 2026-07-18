import type { Metadata } from 'next';
import { TravelerLogin } from '@/components/frontend/login/traveler-login';
import { getPublicSiteInfo } from '@/lib/api/public/settings';
import { buildWhatsappUrl } from '@/lib/whatsapp';
import {
    ALL_LOCALES,
    DEFAULT_LOCALE,
    isLocale,
} from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';

// Traveler surface is noindex + excluded from sitemaps (spec 2.1).
export const metadata: Metadata = {
    title: 'Your bookings | Island Tours',
    robots: { index: false, follow: true },
};

/** Prerender every locale (and satisfy the Blocking Route rule). */
export function generateStaticParams() {
    return ALL_LOCALES.map((locale) => ({ locale }));
}

/**
 * `/{locale}/bookings` - the traveller lookup, nested under the locale segment
 * like the rest of the public site (bare `/bookings` is locale-redirected by
 * the proxy). Locale comes from the path, so the page prerenders statically
 * per locale - no cookie read, no Suspense needed.
 */
export default async function BookingsLoginPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

    // Dashboard-managed branding (cached under `site-info`), same as the navbar.
    const [siteInfo, dict] = await Promise.all([
        getPublicSiteInfo(),
        getDictionary(locale),
    ]);

    return (
        <TravelerLogin
            logo={siteInfo.logo}
            siteName={siteInfo.siteName}
            locale={locale}
            dict={dict.travelerLogin}
            // Dashboard-managed WhatsApp (master 6.6): null when the chat is
            // disabled or the number is unusable - the button then hides.
            whatsappHref={buildWhatsappUrl(
                siteInfo.whatsappNumber,
                siteInfo.enableWhatsappChat
            )}
        />
    );
}
