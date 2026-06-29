import { notFound } from 'next/navigation';

import { Suspense } from 'react';
import { Navbar } from '@/components/frontend/navbar';
import { Footer } from '@/components/frontend/footer';
import { ALL_LOCALES, isLocale } from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { getActiveDestinations } from '@/lib/api/public';

/** Pre-render the shell for every supported locale. */
export function generateStaticParams() {
    return ALL_LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();

    const [dict, destinations] = await Promise.all([
        getDictionary(locale),
        getActiveDestinations(locale),
    ]);

    // Navbar only needs the display name + slug for the island selector.
    const islands = destinations.map((d) => ({ name: d.name, slug: d.slug }));

    return (
        <>
            <Navbar locale={locale} dict={dict.nav} islands={islands} />
            {/* Cached static shell (Navbar/Footer) prerenders; the page streams in
                as a dynamic hole so request-time routes don't block the shell. */}
            <main className='pt-18 md:pt-20'>
                <Suspense>{children}</Suspense>
            </main>
            <Footer locale={locale} dict={dict.footer} />
        </>
    );
}
