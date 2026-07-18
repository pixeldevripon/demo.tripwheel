import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CookieSettingsButton } from '@/components/frontend/legal/cookie-settings-button';
import { LegalPageShell } from '@/components/frontend/legal/legal-page-shell';
import { isLocale } from '@/lib/constants/locales';

// Utility page - kept out of the index per the legal handover README.
export const metadata: Metadata = {
    title: 'Manage Cookies',
    robots: { index: false, follow: true },
};

/**
 * Global legal page - text is the verbatim handover copy from
 * public/Legal Pages (change it only through Denley, per the README).
 */
export default async function ManageCookiesPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();

    return (
        <LegalPageShell locale={locale} title='Manage Cookies'>
            <p>
                Here you can see and change your cookie choices for
                www.island.tours at any time. Strictly necessary cookies are
                always on, because the site cannot work without them. Everything
                else is up to you. Withdrawing your consent is as easy as giving
                it.
            </p>

            <CookieSettingsButton />

            <p>
                Use the button above to reopen your cookie settings. Turn each
                category on or off and save. Your choice takes effect right away
                and is remembered for next time.
            </p>
            <ul>
                <li>
                    Strictly necessary (always on): needed to run the site, keep
                    it secure, let you log in, and take your payment.
                </li>
                <li>
                    Functional and preferences: remember choices such as your
                    language and currency.
                </li>
                <li>
                    Analytics: help us understand how the site is used so we can
                    improve it.
                </li>
                <li>
                    Advertising and measurement: help us measure our advertising
                    and show you relevant tours.
                </li>
            </ul>
            <p>
                To understand exactly what each category contains, see our
                Cookie Policy. To understand how we use the data behind these
                choices, see our Privacy Policy. For any question, email{' '}
                <a href='mailto:info@island.tours'>info@island.tours</a>.
            </p>
            <p>Island Tours. Built by Islanders.</p>
        </LegalPageShell>
    );
}
