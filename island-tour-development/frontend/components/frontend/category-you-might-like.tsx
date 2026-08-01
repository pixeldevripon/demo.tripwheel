import { localizeHref, type Locale } from '@/lib/constants/locales';
import { springPop } from '@/lib/motion';
import { cn } from '@/lib/utils';
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
                        <h2 className='m-0 mt-11 font-it-display text-[22px] font-bold leading-[1.2] tracking-[-0.013em] text-it-ink'>
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
                                        <b className='mt-2.5 block text-[15px] font-bold leading-[1.6] text-it-ink'>
                                            {item.name}
                                        </b>
                                        {item.tours != null && (
                                            <span className='text-[12.5px] leading-[1.6] text-it-text-muted tabular-nums'>
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

    // ── Collection variant (unchanged pending its own v2 pass) ────────────
    return (
        <section className='it-section max-md:py-[32px]! bg-it-white'>
            <div className='it-container'>
                <Reveal>
                    {/* 24px heading->cards on mobile, 48px on desktop (Figma). */}
                    <div className='flex flex-col gap-6 md:gap-12'>
                        <h2 className='m-0 font-medium text-[24px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                            {title}
                        </h2>

                        {/* Mobile: horizontal snap-scroll of 274px cards (16px gap).
                            lg+: static 3-column grid (24px gap). */}
                        <div className='flex snap-x snap-mandatory gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible'>
                            {items.map(item => (
                                <Reveal
                                    key={item.slug}
                                    width='auto'
                                    listItem
                                    className='w-68.5 shrink-0 snap-start lg:w-auto'>
                                    <MotionLink
                                        href={localizeHref(
                                            locale,
                                            `/${destinationSlug}/${item.slug}`
                                        )}
                                        whileTap={{ scale: 0.99 }}
                                        transition={springPop}
                                        className={cn(
                                            'group relative block overflow-hidden rounded-[8px] bg-it-bg lg:rounded-[16px]',
                                            'aspect-384/361'
                                        )}>
                                        {item.image && (
                                            <Image
                                                src={item.image}
                                                alt={item.name}
                                                fill
                                                sizes='(min-width: 1024px) 384px, 274px'
                                                className='object-cover transition-transform duration-500 ease-out group-hover:scale-105'
                                            />
                                        )}
                                        {/* Bottom scrim - photo only; the
                                            flat fallback stays gradient-free. */}
                                        {item.image && (
                                            <div className='pointer-events-none absolute inset-x-0 bottom-0 h-34.75 bg-linear-to-b from-transparent to-it-ink' />
                                        )}
                                        <span
                                            className={cn(
                                                'absolute bottom-6 left-6 font-medium tracking-[-0.012em] text-[20px] leading-[1.2] md:text-[24px]',
                                                item.image
                                                    ? 'text-it-white'
                                                    : 'text-it-ink'
                                            )}>
                                            {item.name}
                                        </span>
                                    </MotionLink>
                                </Reveal>
                            ))}
                        </div>
                    </div>

                    {/* Optional CTA row: full-width hairline with a centered white chip
                        interrupting it - "Not sure yet? See all {destination} tours ->". */}
                    {footer && (
                        <div className='relative mt-10 flex items-center justify-center md:mt-[90px]'>
                            <span
                                aria-hidden='true'
                                className='absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-it-heading/10'
                            />
                            <span className='relative flex items-center gap-2 bg-it-white px-2.5 py-2.5'>
                                <span className='text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                    {footer.prompt}
                                </span>
                                <Link
                                    href={localizeHref(locale, footer.href)}
                                    className='group inline-flex items-center gap-1'>
                                    <span className='font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-primary underline underline-offset-2 transition-colors duration-300 group-hover:text-it-primary-hover'>
                                        {footer.cta}
                                    </span>
                                    <Image
                                        src='/icons/cta-arrow-right.svg'
                                        alt=''
                                        width={20}
                                        height={20}
                                        aria-hidden='true'
                                        className='size-6'
                                    />
                                </Link>
                            </span>
                        </div>
                    )}
                </Reveal>
            </div>
        </section>
    );
}
