import { MotionLink } from '@/components/frontend/motion-link';
import { MotionA } from '@/components/frontend/motion-primitives';
import { Reveal } from '@/components/frontend/reveal';
import type { PublicRecommendation } from '@/lib/api/public/recommendation';
import { localizeHref } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { springPop } from '@/lib/motion';
import { currencySymbol } from '@/lib/tours/booking';
import Image from 'next/image';
import { Fragment, type ReactNode } from 'react';

type ThankYouDict = Dictionary['thankYou'];

const factText = 'text-[13px] font-semibold leading-[1.6] text-it-ink';
const factTextSm =
    'text-[13px] leading-[1.5] tracking-[-0.012em] text-it-heading/70';

/**
 * The brand palm that opens the eyebrow line (design v2 .apteyebrow). Rendered
 * here rather than stored in the dictionary or typed by an admin: it is part
 * of the card's design, identical in every language.
 */
const EyebrowMark = (
    <Image
        src='/logo/it-palm-orange.svg'
        alt=''
        width={12}
        height={16}
        className='h-4 w-auto shrink-0'
    />
);
const dot = (
    <span aria-hidden='true' className='text-it-ink-muted'>
        ·
    </span>
);

const ctaClassSm =
    'flex h-10 w-full items-center justify-center rounded-full bg-it-primary px-4 font-normal text-[13.5px] leading-none tracking-[-0.012em] text-it-white transition-colors hover:bg-it-primary-hover';

/**
 * Post-booking recommendations section. Admin-managed (Dashboard > Recommendations),
 * shown after a booking in celebratory mode.
 *
 * LAYOUT SWITCH: up to 3 picks stack as the single-row .aptcard (photo left,
 * details right, visually smaller than the upsell grid); more than 3 flips to a
 * responsive 4-column grid of compact cards (same shape as the tour grid),
 * because a long stack of big cards reads as a wall.
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
            <div className={asGrid ? 'it-container' : 'it-wrap'}>
                {asGrid ? (
                    <div className='grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-8 lg:grid-cols-4'>
                        {recommendations.map((rec, i) => (
                            <Reveal key={i} listItem>
                                <GridCard recommendation={rec} dict={dict} />
                            </Reveal>
                        ))}
                    </div>
                ) : (
                    <div className='flex flex-col gap-4'>
                        {recommendations.map((rec, i) => (
                            <Reveal key={i}>
                                <AptCard recommendation={rec} dict={dict} />
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
    size: 'md' | 'sm'
): { key: string; node: ReactNode }[] {
    const cls = size === 'sm' ? factTextSm : factText;
    const facts: { key: string; node: ReactNode }[] = [];

    if (r.rating !== null) {
        facts.push({
            key: 'rating',
            node: (
                <span className={`${cls} font-medium text-it-star`}>
                    ★ {r.rating}
                    {r.reviewCount !== null &&
                        ` (${r.reviewCount.toLocaleString('en-US')})`}
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
                <span className={cls}>
                    {dict.from}{' '}
                    {/* The record's OWN currency, never a literal '$'. */}
                    {currencySymbol(r.currency)}
                    {r.priceAmount}
                    {/* "/per night" is a STAY unit - only shown when the pick has
                        a "sleeps" (hotel/apartment/villa). A tour or car reads
                        "from $X" with no per-night suffix. */}
                    {r.sleeps !== null && dict.perNight}
                </span>
            ),
        });
    }
    return facts;
}

/**
 * A recommendation link. EXTERNAL opens off-site in a new tab; INTERNAL keeps
 * client-side nav same-tab and localizes the href.
 *
 * ONE definition. `Cta` and `CardLink` were the same twenty lines - the same
 * `external` branch, the same `rel='noopener noreferrer'`, the same non-null
 * assertions on `linkUrl`, the same `localizeHref` - differing only in a tap
 * scale of 0.98 vs 0.99. That routing rule is the fact being shared: a
 * `prefetch` hint or a click-tracking hook would otherwise have to be added
 * twice, and a miss would silently send external picks through client-side nav.
 */
function RecLink({
    r,
    className,
    tapScale = 0.98,
    children,
}: {
    r: PublicRecommendation;
    className: string;
    /** Whole-card links tap a touch shallower than a button does. */
    tapScale?: number;
    children: ReactNode;
}) {
    return r.external ? (
        <MotionA
            href={r.linkUrl!}
            target='_blank'
            rel='noopener noreferrer'
            whileTap={{ scale: tapScale }}
            transition={springPop}
            className={className}>
            {children}
        </MotionA>
    ) : (
        <MotionLink
            href={localizeHref(r.locale, r.linkUrl!)}
            whileTap={{ scale: tapScale }}
            transition={springPop}
            className={className}>
            {children}
        </MotionLink>
    );
}

/** The button-style CTA. */
function Cta(props: {
    r: PublicRecommendation;
    className: string;
    children: ReactNode;
}) {
    return <RecLink {...props} />;
}

/**
 * Wrap the WHOLE card in a link - used for picks with no CTA label (internal picks
 * that carry no copy of their own), so the card behaves like a tour card: no
 * button, the whole thing clickable.
 */
function CardLink(props: {
    r: PublicRecommendation;
    className: string;
    children: ReactNode;
}) {
    return <RecLink {...props} tapScale={0.99} />;
}

/**
 * The single-row card (design v2 .aptcard, the ≤3 stack): 280px photo left,
 * centred details right - palm eyebrow, display title, one-line pitch, facts
 * with the amber star, then a quiet outline CTA (subtle border, paper hover -
 * never a dark border).
 */
function AptCard({
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
        <div className='grid overflow-hidden rounded-it-lg border border-it-divider bg-it-white shadow-it-sm md:grid-cols-[280px_1fr]'>
            <div className='relative h-[170px] bg-it-bg md:h-auto md:min-h-[220px]'>
                <Image
                    src={imageUrl}
                    alt={title}
                    fill
                    sizes='(min-width: 768px) 280px, 100vw'
                    className='object-cover'
                />
            </div>
            <div className='flex flex-col items-start justify-center px-5 py-5 md:px-7 md:py-6'>
                {/* Eyebrow + area are admin copy; absent on internal picks. */}
                {(eyebrow || recommendation.areaLabel) && (
                    <div className='flex items-center gap-2 text-[11px] font-medium uppercase leading-[1.4] tracking-[0.12em] text-it-text-muted'>
                        {EyebrowMark}
                        <span className='flex items-center gap-2'>
                            {eyebrow}
                            {eyebrow && recommendation.areaLabel && dot}
                            {recommendation.areaLabel}
                        </span>
                    </div>
                )}
                <h3 className='m-0 mt-2 font-it-display text-[20px] font-medium leading-[1.3] tracking-[-0.01em] text-it-ink'>
                    {title}
                </h3>
                {recommendation.descriptionLines.length > 0 && (
                    <div className='mt-1 flex flex-col'>
                        {recommendation.descriptionLines.map(line => (
                            <p
                                key={line}
                                className='m-0 text-[14px] leading-[1.6] text-it-text-muted'>
                                {line}
                            </p>
                        ))}
                    </div>
                )}
                {facts.length > 0 && (
                    <div className='mt-2 flex flex-wrap items-center gap-2'>
                        {facts.map((fact, index) => (
                            <Fragment key={fact.key}>
                                {index > 0 && dot}
                                {fact.node}
                            </Fragment>
                        ))}
                    </div>
                )}
                {ctaLabel && (
                    <Cta
                        r={recommendation}
                        className='mt-3.5 inline-flex items-center gap-2 self-start rounded-it-sm border border-it-border bg-it-white px-[18px] py-2.5 text-[13.5px] font-medium leading-[1.4] text-it-ink no-underline transition-colors duration-(--it-duration-xs) hover:bg-it-bg'>
                        {ctaLabel}
                        {recommendation.external && (
                            <Image
                                src='/icons/thank-you/external-arrow.svg'
                                alt=''
                                width={16}
                                height={16}
                                className='size-4 shrink-0'
                            />
                        )}
                    </Cta>
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
                    <span className='flex items-center gap-1.5 text-[11px] font-medium uppercase leading-[1.4] tracking-[0.08em] text-it-text-muted'>
                        {EyebrowMark} {eyebrow}
                    </span>
                )}
                <h3 className='m-0 font-normal text-[16px] leading-[1.4] tracking-[-0.012em] text-it-heading line-clamp-2'>
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
                    <Cta r={recommendation} className={ctaClassSm}>
                        {ctaLabel}
                    </Cta>
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

