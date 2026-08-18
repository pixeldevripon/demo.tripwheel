import { OperatorConditionsBody } from '@/components/frontend/operator-conditions-body';
import { getOperatorConditions } from '@/lib/api/public/operator-terms';
import { isLocale, type Locale } from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

type PageParams = { locale: string; operatorSlug: string };

/**
 * The canonical operator-conditions page (Pastel #80 / MCK-20 §3): the
 * shareable, refresh-proof home of the document the checkout gate and the
 * confirmation email link to. In-app navigations to this URL are intercepted
 * into an overlay (`@modal/(.)operators/...`); a direct load or refresh
 * renders this full page - the classic modal/canonical pair.
 */

// Cache Components requires at least one prerendered entry per dynamic route;
// the demo operator's slug stands in (same pattern as the cancel page's
// DEMO_PUBLIC_REF).
export function generateStaticParams() {
    return [{ operatorSlug: 'miss-ann-boat-trips' }];
}

export async function generateMetadata({
    params,
}: {
    params: Promise<PageParams>;
}): Promise<Metadata> {
    const { locale, operatorSlug } = await params;
    if (!isLocale(locale)) return {};
    const [dict, terms] = await Promise.all([
        getDictionary(locale),
        getOperatorConditions(operatorSlug, locale),
    ]);
    if (!terms) return {};
    return {
        title: `${terms.operatorName ?? ''} · ${dict.checkout.operatorTermsReaderTitle}`,
    };
}

export default async function OperatorConditionsPage({
    params,
}: {
    params: Promise<PageParams>;
}) {
    const { locale, operatorSlug } = await params;
    if (!isLocale(locale)) notFound();

    const [dict, terms] = await Promise.all([
        getDictionary(locale as Locale),
        getOperatorConditions(operatorSlug, locale as Locale),
    ]);
    if (!terms) notFound();

    const versionLine = [
        terms.operatorName,
        terms.version
            ? dict.checkout.operatorTermsReaderVersion.replace(
                  '{version}',
                  terms.version
              )
            : null,
        terms.effectiveDate
            ? new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(
                  new Date(terms.effectiveDate)
              )
            : null,
    ]
        .filter(Boolean)
        .join(' · ');

    return (
        <section className='it-section bg-it-white'>
            <div className='it-container'>
                <div className='mx-auto max-w-[720px]'>
                    <h1 className='m-0 font-it-display text-[28px] leading-[1.2] tracking-[-0.012em] text-it-heading sm:text-[32px] font-medium'>
                        {dict.checkout.operatorTermsReaderTitle}
                    </h1>
                    <p className='mb-6 mt-2 text-[13.5px] leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
                        {versionLine}
                    </p>
                    <OperatorConditionsBody html={terms.document} />
                </div>
            </div>
        </section>
    );
}
