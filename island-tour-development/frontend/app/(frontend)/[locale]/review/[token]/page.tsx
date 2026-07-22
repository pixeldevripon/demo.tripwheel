import { MountReveal } from '@/components/frontend/mount-reveal';
import { ReviewSubmitFlow } from '@/components/frontend/review/review-submit-flow';
import { isLocale, localizeHref, type Locale } from '@/lib/constants/locales';
import { getReviewInvitation } from '@/lib/api/public/review-invitation';
import { getDictionary } from '@/lib/i18n/dictionaries';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';

type PageParams = { locale: string; token: string };

/**
 * The post-tour review page (requirements §4.2) - the collection surface the
 * whole review module was waiting on.
 *
 * Reached from the review-request email with no login, authenticated by the
 * single-use token in the URL, exactly like the cancellation flow. A sign-in
 * wall between the inbox and step 1 would cost more reviews than it protects.
 */

// Cache Components needs at least one prerendered entry per dynamic route, and
// real tokens are unguessable runtime credentials - so a placeholder stands in,
// the same way the cancel page uses its demo ref.
export function generateStaticParams() {
    return [{ token: 'sample' }];
}

/** Tokenized and personal - never indexed (same rule as the TYP and cancel pages). */
export const metadata: Metadata = { robots: { index: false, follow: false } };

async function ReviewBody({
    token,
    locale,
}: {
    token: string;
    locale: Locale;
}) {
    await connection();
    const [dict, invitation] = await Promise.all([
        getDictionary(locale),
        getReviewInvitation(token),
    ]);
    const rd = dict.reviewSubmit;

    // Unknown, spent and revoked all land here: the backend does not distinguish
    // them, and neither should the page.
    if (!invitation) {
        return (
            <div className='w-full max-w-125 rounded-[16px] bg-it-white p-6 shadow-[0_26px_70px_-20px_rgba(0,0,0,0.25)]'>
                <span className='font-medium text-[18px] leading-[1.4] tracking-[-0.012em] text-it-heading'>
                    {rd.invalidTitle}
                </span>
                <p className='mt-2.5 mb-0 text-[14px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                    {rd.invalidBody}
                </p>
            </div>
        );
    }

    const tourHref =
        invitation.destinationSlug && invitation.tourSlug
            ? localizeHref(
                  locale,
                  `/${invitation.destinationSlug}/${invitation.tourSlug}`,
              )
            : null;

    return (
        <MountReveal>
            <ReviewSubmitFlow
                token={invitation.token}
                tourName={invitation.tourName ?? ''}
                guestFirstName={invitation.guestFirstName}
                heroImage={invitation.heroImage}
                tourHref={tourHref}
                // Step 4 hides itself until the Trustpilot profile exists
                // (Phase 6). Rendering a dead invitation would be worse than
                // rendering none.
                trustpilotUrl={
                    process.env.NEXT_PUBLIC_TRUSTPILOT_REVIEW_URL ?? null
                }
                dict={rd}
            />
        </MountReveal>
    );
}

function ReviewSkeleton() {
    return (
        <div className='w-full max-w-125 animate-pulse rounded-[16px] bg-it-white p-6'>
            <div className='h-40 w-full rounded-[12px] bg-it-border' />
            <div className='mt-5 h-7 w-3/4 rounded-[6px] bg-it-border' />
            <div className='mt-2 h-4 w-1/2 rounded-[6px] bg-it-border' />
            <div className='mt-5 flex gap-2'>
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className='size-8 rounded-[6px] bg-it-border' />
                ))}
            </div>
        </div>
    );
}

export default async function ReviewPage({
    params,
}: {
    params: Promise<PageParams>;
}) {
    const { locale: rawLocale, token } = await params;
    if (!isLocale(rawLocale)) notFound();
    const locale: Locale = rawLocale;

    return (
        <section className='it-section flex min-h-[70vh] items-center justify-center bg-it-surface'>
            <div className='it-container flex justify-center'>
                <Suspense fallback={<ReviewSkeleton />}>
                    <ReviewBody token={token} locale={locale} />
                </Suspense>
            </div>
        </section>
    );
}
