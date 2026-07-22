import Image from 'next/image';
import { MotionLink } from '@/components/frontend/motion-link';
import { MountReveal } from '@/components/frontend/mount-reveal';
import { springPop } from '@/lib/motion';
import { ReviewSubmitFlow } from '@/components/frontend/review/review-submit-flow';
import { getReviewInvitation } from '@/lib/api/public/review-invitation';
import { isLocale, localizeHref, type Locale } from '@/lib/constants/locales';
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
            <MountReveal>
                <div className='w-full max-w-xl rounded-[16px] bg-it-white p-8 text-center shadow-[0_26px_70px_-20px_rgba(0,0,0,0.25)] sm:p-12'>
                    <Image
                        src='/icons/review-verified.svg'
                        alt=''
                        width={56}
                        height={56}
                        className='mx-auto size-14 opacity-25'
                    />
                    <h1 className='mx-auto mt-6 mb-0 max-w-md font-medium text-[24px] leading-[1.25] tracking-[-0.012em] text-it-heading sm:text-[28px]'>
                        {rd.invalidTitle}
                    </h1>
                    <p className='mx-auto mt-3 mb-0 max-w-md text-[15px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                        {rd.invalidBody}
                    </p>
                    {/* A dead end is where people leave. Give them somewhere to
                        go: their bookings if the link was theirs, tours if they
                        were only curious. */}
                    <div className='mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row'>
                        <MotionLink
                            href={localizeHref(locale, '/bookings')}
                            whileTap={{ scale: 0.98 }}
                            transition={springPop}
                            className='flex w-full items-center justify-center rounded-it-full bg-it-primary px-8 py-[13px] font-medium text-[15px] leading-[1.6] tracking-[-0.012em] text-it-white no-underline transition-colors hover:bg-it-primary-hover sm:w-auto'>
                            {rd.invalidFindBooking}
                        </MotionLink>
                        <MotionLink
                            href={localizeHref(locale, '/')}
                            whileTap={{ scale: 0.98 }}
                            transition={springPop}
                            className='flex w-full items-center justify-center rounded-it-full border border-it-border bg-it-white px-8 py-[13px] font-medium text-[15px] leading-[1.6] tracking-[-0.012em] text-it-heading no-underline transition-colors hover:border-it-heading sm:w-auto'>
                            {rd.invalidBrowse}
                        </MotionLink>
                    </div>
                </div>
            </MountReveal>
        );
    }

    const tourHref =
        invitation.destinationSlug && invitation.tourSlug
            ? localizeHref(
                  locale,
                  `/${invitation.destinationSlug}/${invitation.tourSlug}`
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
        <div className='w-full max-w-xl animate-pulse rounded-[16px] bg-it-white p-6 sm:p-8'>
            <div className='h-40 w-full rounded-[12px] bg-it-border' />
            <div className='mt-5 h-7 w-3/4 rounded-[6px] bg-it-border' />
            <div className='mt-2 h-4 w-1/2 rounded-[6px] bg-it-border' />
            <div className='mt-5 flex gap-2'>
                {Array.from({ length: 5 }).map((_, i) => (
                    <div
                        key={i}
                        className='size-8 rounded-[6px] bg-it-border'
                    />
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
            <div className='it-container [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-xl'>
                <Suspense fallback={<ReviewSkeleton />}>
                    <ReviewBody token={token} locale={locale} />
                </Suspense>
            </div>
        </section>
    );
}

