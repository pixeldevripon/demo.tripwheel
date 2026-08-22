import { OperatorConditionsOverlay } from '@/components/frontend/operator-conditions-overlay';
import { getOperatorConditions } from '@/lib/api/public/operator-terms';
import { isLocale, type Locale } from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

type PageParams = { locale: string; operatorSlug: string };

/**
 * Interception of /{locale}/operators/{slug}/conditions (Pastel #80 /
 * MCK-20 §3): an IN-APP navigation to the conditions URL renders this overlay
 * in the `@modal` slot above the current page; a hard load or refresh renders
 * the full canonical page instead. Same loader, same body component - one
 * source, two framings.
 */

// Cache Components requires at least one prerendered entry per dynamic route
// (the (frontend) rule) - the demo operator's slug stands in, matching the
// canonical page. Without this, the production build fails prerendering the
// intercepted variant's shell.
export function generateStaticParams() {
    return [{ operatorSlug: 'miss-ann-boat-trips' }];
}

export default function InterceptedOperatorConditions({
    params,
}: {
    params: Promise<PageParams>;
}) {
    // The overlay's data lives behind its own Suspense boundary so the
    // prerender shell never blocks on request-time work (blocking-route rule);
    // a null fallback is right for a modal that appears the instant its
    // content exists.
    return (
        <Suspense fallback={null}>
            <OverlayBody params={params} />
        </Suspense>
    );
}

async function OverlayBody({ params }: { params: Promise<PageParams> }) {
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
    ]
        .filter(Boolean)
        .join(' · ');

    return (
        <OperatorConditionsOverlay
            title={dict.checkout.operatorTermsReaderTitle}
            versionLine={versionLine}
            closeLabel={dict.checkout.operatorTermsReaderClose}
            html={terms.document}
        />
    );
}
