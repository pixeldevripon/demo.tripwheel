import { localizeHref, type Locale } from '@/lib/constants/locales';
import { springPop } from '@/lib/motion';
import Image from 'next/image';
import Link from 'next/link';
import { MotionLink } from './motion-link';
import { Reveal } from './reveal';

export type RelatedCategory = {
    name: string;
    slug: string;
    image?: string;
    /** Published tour count - rendered under the name (category variant). */
    tours?: number;
};

/** Optional "Not sure yet? See all X tours ->" CTA row shown under the grid. */
export type YouMightLikeFooter = {
    /** Muted lead-in text, e.g. "Not sure yet?". */
    prompt: string;
    /** Underlined primary link label, e.g. "See all Curacao tours". */
    cta: string;
    /** Raw (un-localized) path the CTA links to, e.g. `/curacao/tours`. */
    href: string;
};

/**
 * "You might also like" - related-suggestion grid shown after the tour listing.
 *
 * Two designs share this component:
 * - `variant='category'` (default, design v2 .relgrid): white band, 3-col grid
 *   of photo cards (3:2, 12px radius) with the name + tour count BELOW the
 *   photo. A category with no image keeps the flat paper surface.
 * - `variant='collection'` (Figma 47433:2429, "Keep exploring {destination}"): white
 *   background, taller 384x361 scrim cards, 24px white labels, plus an optional
 *   `footer` CTA row (divider + "Not sure yet? See all {destination} tours ->").
 *
 * Each item links to a sibling page at the same destination
 * (`/{destinationSlug}/{slug}`) - works for category and collection slugs alike
 * (same flat resolution route).
 */
export function CategoryYouMightLike({
    title,
    items,
    locale,
    destinationSlug,
    variant = 'category',
    /** "{count} tours" word for the category-variant count line. */
    toursWord = 'tours',
    footer,
}: {
    title: string;
    items: RelatedCategory[];
    locale: Locale;
    destinationSlug: string;
    variant?: 'category' | 'collection';
    toursWord?: string;
    footer?: YouMightLikeFooter;
}) {
    if (items.length === 0) return null;

    const isCollection = variant === 'collection';

    if (!isCollection) {
        // ── Design v2 category variant (.relcats/.relgrid) ────────────────
        return (
            <section className='bg-it-white'>
                <div className='it-container'>
                    <Reveal className='flex flex-col gap-4'>
                        <h2 className='m-0 mt-11 text-[24px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading font-medium'>
                            {title}
                        </h2>

                        <div className='grid gap-3 md:grid-cols-3 md:gap-4'>
                            {items.map(item => (
                                <Reveal key={item.slug} width='auto' listItem>
                                    <MotionLink
                                        href={localizeHref(
                                            locale,
                                            `/${destinationSlug}/${item.slug}`
                                        )}
                                        whileTap={{ scale: 0.99 }}
                                        transition={springPop}
                                        className='group block rounded-it-md no-underline transition-transform duration-(--it-duration-sm) ease-(--it-ease) hover:-translate-y-0.5'>
                                        <div className='relative aspect-3/2 overflow-hidden rounded-it-md bg-it-bg'>
                                            {item.image && (
                                                <Image
                                                    src={item.image}
                                                    alt={item.name}
                                                    fill
                                                    sizes='(min-width: 768px) 384px, 100vw'
                                                    className='object-cover transition-transform duration-(--it-duration-md) ease-(--it-ease) group-hover:scale-[1.03]'
                                                />
                                            )}
                                        </div>
                                        <b className='mt-2.5 block text-[15px] font-medium leading-[1.6] text-it-heading tracking-[-0.012em]'>
                                            {item.name}
                                        </b>
                                        {item.tours != null && (
                                            <span className='text-[14px] leading-[1.6] text-it-heading/70 tabular-nums tracking-[-0.012em]'>
                                                {item.tours} {toursWord}
                                            </span>
                                        )}
                                    </MotionLink>
                                </Reveal>
                            ))}
                        </div>
                    </Reveal>
                </div>
            </section>
        );
    }

    // ── Collection variant (design v2 .explore, 5.6): the same .relcol
    // photo tiles as the category grid - name BELOW the photo - plus the
    // subtle text-link recovery CTA (never a button).
    return (
        <section className='bg-it-white pt-16 pb-20'>
            <div className='it-container'>
                <Reveal className='flex flex-col gap-4'>
                    <h2 className='m-0 text-[20px] md:text-[32px] leading-[1.2] tracking-[-0.012em] text-it-heading font-medium'>
                        {title}
                    </h2>

                    <div className='grid gap-3 md:grid-cols-3 md:gap-4'>
                        {items.map(item => (
                            <Reveal key={item.slug} width='auto' listItem>
                                <MotionLink
                                    href={localizeHref(
                                        locale,
                                        `/${destinationSlug}/${item.slug}`
                                    )}
                                    whileTap={{ scale: 0.99 }}
                                    transition={springPop}
                                    className='group block rounded-it-md no-underline transition-transform duration-(--it-duration-sm) ease-(--it-ease) hover:-translate-y-0.5'>
                                    <div className='relative aspect-3/2 overflow-hidden rounded-it-md bg-it-bg'>
                                        {item.image && (
                                            <Image
                                                src={item.image}
                                                alt={item.name}
                                                fill
                                                sizes='(min-width: 768px) 384px, 100vw'
                                                className='object-cover transition-transform duration-(--it-duration-md) ease-(--it-ease) group-hover:scale-[1.03]'
                                            />
                                        )}
                                    </div>
                                    <b className='mt-2.5 block text-[15px] font-medium leading-[1.6] text-it-heading tracking-[-0.012em]'>
                                        {item.name}
                                    </b>
                                </MotionLink>
                            </Reveal>
                        ))}
                    </div>

                    {/* Recovery CTA - a subtle text link to the destination
                        page (5.6: never a button). */}
                    {footer && (
                        <div className='mt-3.5'>
                            <span className='text-[16px] leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
                                {footer.prompt}
                            </span>{' '}
                            <Link
                                href={localizeHref(locale, footer.href)}
                                className='text-[14.5px] font-medium leading-[1.6] text-it-primary-hover underline underline-offset-[3px] transition-colors duration-300 hover:text-it-primary tracking-[-0.012em]'>
                                {footer.cta} →
                            </Link>
                        </div>
                    )}
                </Reveal>
            </div>
        </section>
    );
}

