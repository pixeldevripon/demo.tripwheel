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
const metaTextSm = 'text-[13px] leading-[1.5] tracking-[-0.012em] text-it-heading/70';

/**
 * The palm that opens the eyebrow line. Rendered here rather than stored, in the
 * dictionary or typed by an admin: it is part of the card's design, identical in
 * every language, and an emoji living in seven translation files is seven places
 * for it to go missing.
 */
const EYEBROW_MARK = '🌴';
const dot = <span className='size-1 shrink-0 rounded-full bg-it-heading/20' />;

const ctaClass =
    'flex h-12 w-full max-w-[340px] items-center justify-center rounded-full bg-it-primary font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-white transition-colors hover:bg-it-primary-hover';
const ctaClassSm =
    'flex h-10 w-full items-center justify-center rounded-full bg-it-primary px-4 font-medium text-[13.5px] leading-none tracking-[-0.012em] text-it-white transition-colors hover:bg-it-primary-hover';

/**
 * Post-booking recommendations section. Admin-managed (Dashboard > Recommendations),
 * shown after a booking in celebratory mode.
 *
 * LAYOUT SWITCH: up to 3 picks stack as full-width photo-and-details cards; more
 * than 3 flips to a responsive 4-column grid of compact cards (same shape as the
 * tour grid), because a long stack of big cards reads as a wall.
 *
 * A card can be an EXTERNAL place (off-site link, new tab) or an INTERNAL entity (a
 * tour / destination / collection / hub, linked same-tab). The section gates on the
 * array being non-empty; each card narrows its own essentials and returns null if
 * one is missing - a non-null assertion here would crash the one page a traveller
 * reaches straight after paying.
 */
export function ThankYouRecommendations({
    recommendations,
    dict,
}: {
    recommendations: PublicRecommendation[];
    dict: ThankYouDict;
}) {
    if (recommendations.length === 0) return null;
    const asGrid = recommendations.length > 3;

    return (
        <section className='bg-it-white pt-12 pb-0'>
            <div className='it-container'>
                {asGrid ? (
                    <div className='grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-8 lg:grid-cols-4'>
                        {recommendations.map((rec, i) => (
                            <Reveal key={i} listItem>
                                <GridCard recommendation={rec} dict={dict} />
                            </Reveal>
                        ))}
                    </div>
                ) : (
                    <div className='flex flex-col gap-6'>
                        {recommendations.map((rec, i) => (
                            <Reveal key={i}>
                                <FullCard recommendation={rec} dict={dict} />
                            </Reveal>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

/** The star/sleeps/price meta facts an admin filled in, keyed so dots sit between. */
function buildFacts(
    r: PublicRecommendation,
    dict: ThankYouDict,
    size: 'md' | 'sm',
): { key: string; node: ReactNode }[] {
    const cls = size === 'sm' ? metaTextSm : metaText;
    const priceSize =
        size === 'sm'
            ? 'font-medium text-[15px] leading-[1.5] tracking-[-0.012em] text-it-heading'
            : 'font-medium text-[18px] leading-[1.6] tracking-[-0.012em] text-it-heading';
    const facts: { key: string; node: ReactNode }[] = [];

    if (r.rating !== null) {
        facts.push({
            key: 'rating',
            node: (
                <span className='flex items-center gap-1.5'>
                    <Image
                        src='/icons/star-listings.svg'
                        alt=''
                        width={16}
                        height={16}
                        className='size-4'
                    />
                    <span className={cls}>
                        {r.rating}
                        {r.reviewCount !== null &&
                            ` (${r.reviewCount.toLocaleString('en-US')})`}
                    </span>
                </span>
            ),
        });
    }
    if (r.sleeps !== null) {
        facts.push({
            key: 'sleeps',
            node: (
                <span className={cls}>
                    {dict.sleeps.replace('{count}', String(r.sleeps))}
                </span>
            ),
        });
    }
    if (r.priceAmount !== null) {
        facts.push({
            key: 'price',
            node: (
                <span className='flex items-baseline gap-1'>
                    <span className={cls}>{dict.from}</span>
                    {/* The record's OWN currency, never a literal '$'. */}
                    <span className={priceSize}>
                        {currencySymbol(r.currency)}
                        {r.priceAmount}
                    </span>
                    {/* "/per night" is a STAY unit - only shown when the pick has
                        a "sleeps" (hotel/apartment/villa). A tour or car reads
                        "from $X" with no per-night suffix. */}
                    {r.sleeps !== null && (
                        <span className={cls}>{dict.perNight}</span>
                    )}
                </span>
            ),
        });
    }
    return facts;
}

/** EXTERNAL opens off-site (new tab); INTERNAL keeps client-side nav same-tab. */
function Cta({
    r,
    label,
    className,
}: {
    r: PublicRecommendation;
    label: string;
    className: string;
}) {
    return r.external ? (
        <MotionA
            href={r.linkUrl!}
            target='_blank'
            rel='noopener noreferrer'
            whileTap={{ scale: 0.98 }}
            transition={springPop}
            className={className}>
            {label}
        </MotionA>
    ) : (
        <MotionLink
            href={localizeHref(r.locale, r.linkUrl!)}
            whileTap={{ scale: 0.98 }}
            transition={springPop}
            className={className}>
            {label}
        </MotionLink>
    );
}

/**
 * Wrap the WHOLE card in a link - used for picks with no CTA label (internal picks
 * that carry no copy of their own), so the card behaves like a tour card: no
 * button, the whole thing clickable.
 */
function CardLink({
    r,
    className,
    children,
}: {
    r: PublicRecommendation;
    className: string;
    children: ReactNode;
}) {
    return r.external ? (
        <MotionA
            href={r.linkUrl!}
            target='_blank'
            rel='noopener noreferrer'
            whileTap={{ scale: 0.99 }}
            transition={springPop}
            className={className}>
            {children}
        </MotionA>
    ) : (
        <MotionLink
            href={localizeHref(r.locale, r.linkUrl!)}
            whileTap={{ scale: 0.99 }}
            transition={springPop}
            className={className}>
            {children}
        </MotionLink>
    );
}

/** The full-width photo-and-details card (the ≤3 stack). */
function FullCard({
    recommendation,
    dict,
}: {
    recommendation: PublicRecommendation;
    dict: ThankYouDict;
}) {
    const { imageUrl, linkUrl, title, eyebrow, ctaLabel } = recommendation;
    if (!imageUrl || !linkUrl || !title) return null;
    const facts = buildFacts(recommendation, dict, 'md');

    const inner = (
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
                    {/* Eyebrow + area are admin copy; absent on internal picks. */}
                    {(eyebrow || recommendation.areaLabel) && (
                        <div className='flex items-center gap-4'>
                            {eyebrow && (
                                <span className='text-[16px] leading-[1.6] tracking-[-0.012em] text-[#858585]'>
                                    {EYEBROW_MARK} {eyebrow}
                                </span>
                            )}
                            {recommendation.areaLabel && (
                                <>
                                    {eyebrow && dot}
                                    <span className={metaText}>
                                        {recommendation.areaLabel}
                                    </span>
                                </>
                            )}
                        </div>
                    )}
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
                {ctaLabel && (
                    <Cta
                        r={recommendation}
                        label={ctaLabel}
                        className={ctaClass}
                    />
                )}
            </div>
        </div>
    );

    // With a CTA label the card carries its button; without one (internal picks)
    // the whole card is the link.
    if (ctaLabel) return inner;
    return (
        <CardLink r={recommendation} className='block'>
            {inner}
        </CardLink>
    );
}

/**
 * The compact card in the responsive grid (the >3 layout). Mirrors the sitewide
 * <TourCard>: borderless on white, a rounded landscape photo, then the eyebrow,
 * title, meta facts and price - with a clean outline CTA button at the foot (which
 * the tour card lacks, because a recommendation's action is its labelled link).
 */
function GridCard({
    recommendation,
    dict,
}: {
    recommendation: PublicRecommendation;
    dict: ThankYouDict;
}) {
    const { imageUrl, linkUrl, title, eyebrow, ctaLabel } = recommendation;
    if (!imageUrl || !linkUrl || !title) return null;
    const facts = buildFacts(recommendation, dict, 'sm');

    const body = (
        <>
            <div className='relative aspect-[64/45] w-full shrink-0 overflow-hidden rounded-[16px] bg-it-border'>
                <Image
                    src={imageUrl}
                    alt={title}
                    fill
                    sizes='(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw'
                    className='object-cover transition-transform duration-300 group-hover:scale-[1.03]'
                />
            </div>
            <div className='flex flex-1 flex-col gap-1.5 pt-3'>
                {/* Eyebrow is admin copy (OUR VILLA / WHERE TO EAT). Absent on
                    internal picks, which then read like a plain tour card. */}
                {eyebrow && (
                    <span className='flex items-center gap-1 text-[11px] uppercase leading-[1.4] tracking-[0.04em] text-[#858585]'>
                        {EYEBROW_MARK} {eyebrow}
                    </span>
                )}
                <h3 className='m-0 font-medium text-[16px] leading-[1.4] tracking-[-0.012em] text-it-heading line-clamp-2'>
                    {title}
                </h3>
                {facts.length > 0 && (
                    <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
                        {facts.map((fact, index) => (
                            <Fragment key={fact.key}>
                                {index > 0 && dot}
                                {fact.node}
                            </Fragment>
                        ))}
                    </div>
                )}
            </div>
        </>
    );

    // A labelled pick (external content) carries its CTA button; a pick with no
    // label (internal) makes the whole card the link, like a tour card.
    if (ctaLabel) {
        return (
            <div className='group flex h-full flex-col'>
                {body}
                <div className='pt-3'>
                    <Cta
                        r={recommendation}
                        label={ctaLabel}
                        className={ctaClassSm}
                    />
                </div>
            </div>
        );
    }
    return (
        <CardLink r={recommendation} className='group flex h-full flex-col'>
            {body}
        </CardLink>
    );
}
