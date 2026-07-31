import { MotionA } from '@/components/frontend/motion-primitives';
import { MotionLink } from '@/components/frontend/motion-link';
import { Reveal } from '@/components/frontend/reveal';
import type { PublicRecommendation } from '@/lib/api/public/recommendation';
import { localizeHref } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { springPop } from '@/lib/motion';
import { currencySymbol } from '@/lib/tours/booking';
import Image from 'next/image';
import { Fragment, type ReactNode } from 'react';

type ThankYouDict = Dictionary['thankYou'];

const metaText = 'text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading/70';

/**
 * The palm that opens the eyebrow line. Rendered here rather than stored, in the
 * dictionary or typed by an admin: it is part of the card's design, identical in
 * every language, and an emoji living in seven translation files is seven places
 * for it to go missing.
 */
const EYEBROW_MARK = '🌴';
const dot = <span className='size-1 shrink-0 rounded-full bg-it-heading/20' />;

const ctaClass =
    'flex h-12 w-full max-w-[340px] items-center justify-center rounded-full border border-it-primary font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-primary transition-colors hover:bg-it-primary/5';

/**
 * Post-booking recommendation promo card (Figma 47745-12127): photo half + details
 * half with the outline CTA. Generalises the old "Our apartment" card - the content
 * can now be an EXTERNAL place (off-site link) or an INTERNAL entity (a tour /
 * destination / collection / hub, linked same-tab).
 *
 * Content is admin-managed (Dashboard > Recommendations) rather than hardcoded, so
 * every row below is written to survive a half-filled record:
 *
 *   - The CALLER gates on `recommendation.enabled`, the backend's verdict that the
 *     essentials (photo, title, link) are all present. This component narrows them
 *     anyway and returns null if any is missing - a non-null assertion here would
 *     be a crash on the one page a traveller reaches straight after paying.
 *   - Each META FACT (rating, sleeps, price) renders only if it is set, and the
 *     separator dots are derived from what survived.
 *   - CHROME labels (eyebrow, CTA) fall back to the dictionary, which carries both
 *     in all 7 locales. An admin override is used verbatim.
 */
export function ThankYouRecommendation({
    recommendation,
    dict,
}: {
    recommendation: PublicRecommendation;
    dict: ThankYouDict;
}) {
    const { imageUrl, linkUrl, title, external, locale } = recommendation;
    if (!imageUrl || !linkUrl || !title) return null;

    // Only the facts the admin actually filled in, as a keyed list so the dots
    // sit BETWEEN whatever survived rather than at fixed positions.
    const facts: { key: string; node: ReactNode }[] = [];

    if (recommendation.rating !== null) {
        facts.push({
            key: 'rating',
            node: (
                <span className='flex items-center gap-2'>
                    <Image
                        src='/icons/star-listings.svg'
                        alt=''
                        width={16}
                        height={16}
                        className='size-4'
                    />
                    <span className={metaText}>
                        {recommendation.rating}
                        {/* The review count is its own optional field: a rating
                            with no count must not render an empty "4.8 ()". */}
                        {recommendation.reviewCount !== null &&
                            ` (${recommendation.reviewCount.toLocaleString('en-US')})`}
                    </span>
                </span>
            ),
        });
    }

    if (recommendation.sleeps !== null) {
        facts.push({
            key: 'sleeps',
            node: (
                <span className={metaText}>
                    {dict.sleeps.replace('{count}', String(recommendation.sleeps))}
                </span>
            ),
        });
    }

    if (recommendation.priceAmount !== null) {
        facts.push({
            key: 'price',
            node: (
                <span className='flex items-baseline gap-1'>
                    <span className={metaText}>{dict.from}</span>
                    <span className='font-medium text-[18px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                        {/* The record's OWN currency, never a literal '$' - that
                            would print dollars over a euro price. */}
                        {currencySymbol(recommendation.currency)}
                        {recommendation.priceAmount}
                    </span>
                    <span className={metaText}>{dict.perNight}</span>
                </span>
            ),
        });
    }

    const ctaLabel = recommendation.ctaLabel ?? dict.aptCta;

    return (
        <section className='it-section !pt-0 bg-it-white'>
            <div className='it-container'>
                <Reveal>
                    <div className='grid overflow-hidden rounded-[16px] border border-it-heading/10 bg-it-surface lg:grid-cols-2'>
                        <div className='relative h-[240px] bg-it-border lg:h-auto lg:min-h-[379px]'>
                            <Image
                                src={imageUrl}
                                alt={title}
                                fill
                                sizes='(min-width: 1024px) 588px, 100vw'
                                className='object-cover'
                            />
                        </div>
                        <div className='flex flex-col justify-between gap-6 p-6 lg:py-8 lg:pl-[42px] lg:pr-[22px]'>
                            <div className='flex flex-col gap-6'>
                                <div className='flex items-center gap-4'>
                                    <span className='text-[16px] leading-[1.6] tracking-[-0.012em] text-[#858585]'>
                                        {/* The palm is CHROME, owned by this
                                            component - not in the stored eyebrow
                                            and not in the dictionary. */}
                                        {EYEBROW_MARK}{' '}
                                        {recommendation.eyebrow ?? dict.aptEyebrow}
                                    </span>
                                    {recommendation.areaLabel && (
                                        <>
                                            {dot}
                                            <span className={metaText}>
                                                {recommendation.areaLabel}
                                            </span>
                                        </>
                                    )}
                                </div>
                                <div className='flex flex-col gap-5'>
                                    <div className='flex flex-col gap-1'>
                                        <h3 className='m-0 font-medium text-[24px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                                            {title}
                                        </h3>
                                        {facts.length > 0 && (
                                            <div className='flex flex-wrap items-center gap-4'>
                                                {facts.map((fact, index) => (
                                                    <Fragment key={fact.key}>
                                                        {index > 0 && dot}
                                                        {fact.node}
                                                    </Fragment>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {recommendation.descriptionLines.length > 0 && (
                                        <div className='flex flex-col'>
                                            {recommendation.descriptionLines.map(line => (
                                                <p
                                                    key={line}
                                                    className='m-0 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                                    {line}
                                                </p>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* EXTERNAL opens off-site in a new tab; INTERNAL keeps
                                client-side navigation (prefetch + page transition)
                                same-tab via MotionLink. */}
                            {external ? (
                                <MotionA
                                    href={linkUrl}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    whileTap={{ scale: 0.98 }}
                                    transition={springPop}
                                    className={ctaClass}>
                                    {ctaLabel}
                                </MotionA>
                            ) : (
                                <MotionLink
                                    href={localizeHref(locale, linkUrl)}
                                    whileTap={{ scale: 0.98 }}
                                    transition={springPop}
                                    className={ctaClass}>
                                    {ctaLabel}
                                </MotionLink>
                            )}
                        </div>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}
