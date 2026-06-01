import { notFound } from 'next/navigation';
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
            <main className='pt-20'>{children}</main>
            <Footer locale={locale} dict={dict.footer} />
        </>
    );
}
