import { MountReveal } from '@/components/frontend/mount-reveal';
import { UnsubscribeCardSkeleton } from '@/components/frontend/skeletons/unsubscribe-card-skeleton';
import { UnsubscribeConfirm } from '@/components/frontend/unsubscribe/unsubscribe-confirm';
import { getUnsubscribeInfo } from '@/lib/api/public/unsubscribe';
import { isLocale, localizeHref, type Locale } from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';

type PageParams = { locale: string; token: string };

/**
 * The public unsubscribe page (email programme WP-F) - where every lifecycle
 * and marketing email footer link lands.
 *
 * Reached from an email with no login, authenticated by the long-lived token
 * in the URL, exactly like the review-invitation page. The GET only shows
 * what the token would opt out of; the actual opt-out is the client
 * component's explicit POST, because link scanners follow GETs and a
 * scanner must never unsubscribe anyone.
 */

// Cache Components needs at least one prerendered entry per dynamic route, and
// real tokens are unguessable runtime credentials - so a placeholder stands in,
// the same way the review page uses its sample token.
export function generateStaticParams() {
    return [{ token: 'sample' }];
}

/** Tokenized and personal - never indexed (same rule as the TYP, cancel and review pages). */
export const metadata: Metadata = { robots: { index: false, follow: false } };

async function UnsubscribeBody({
    token,
    locale,
}: {
    token: string;
    locale: Locale;
}) {
    await connection();
    const [dict, info] = await Promise.all([
        getDictionary(locale),
        getUnsubscribeInfo(token),
    ]);

    // The card renders all states - valid, already-opted-out, and the shared
    // invalid state (`info === null`, no oracle) - so that a single hydration
    // marker covers every rendering (see the component doc).
    return (
        <MountReveal>
            <UnsubscribeConfirm
                token={token}
                info={
                    info
                        ? {
                              email: info.email,
                              stream: info.stream,
                              optedOut: info.optedOut,
                          }
                        : null
                }
                browseHref={localizeHref(locale, '/')}
                dict={dict.unsubscribe}
            />
        </MountReveal>
    );
}

export default async function UnsubscribePage({
    params,
}: {
    params: Promise<PageParams>;
}) {
    const { locale: rawLocale, token } = await params;
    if (!isLocale(rawLocale)) notFound();
    const locale: Locale = rawLocale;

    return (
        <section className='it-section flex min-h-[70vh] items-center justify-center bg-it-surface'>
            <div className='it-container [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-xl'>
                <Suspense fallback={<UnsubscribeCardSkeleton />}>
                    <UnsubscribeBody token={token} locale={locale} />
                </Suspense>
            </div>
        </section>
    );
}
