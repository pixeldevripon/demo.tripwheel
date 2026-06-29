import { notFound } from 'next/navigation';

import { Suspense } from 'react';
import { Navbar } from '@/components/frontend/navbar';
import { Footer } from '@/components/frontend/footer';
import { ALL_LOCALES, isLocale } from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';

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

    const dict = await getDictionary(locale);

    return (
        <>
            <Navbar locale={locale} dict={dict.nav} />
            {/* Cached static shell (Navbar/Footer) prerenders; the page streams in
                as a dynamic hole so request-time routes don't block the shell. */}
            <main className='pt-18 md:pt-20'>
                <Suspense>{children}</Suspense>
            </main>
            <Footer locale={locale} dict={dict.footer} />
        </>
    );
}
