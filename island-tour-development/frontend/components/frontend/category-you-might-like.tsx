import { localizeHref, type Locale } from '@/lib/constants/locales';
import { springPop } from '@/lib/motion';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import { MotionLink } from './motion-link';
import { Reveal } from './reveal';

export type RelatedCategory = { name: string; slug: string; image?: string };

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
 * - `variant='category'` (default, Figma 47070:2238): surface background, 384x292
 *   cards, 16px white labels. Used on the category page. Existing usage untouched.
 * - `variant='collection'` (Figma 47433:2429, "Keep exploring {destination}"): white
 *   background, taller 384x361 cards, 24px white labels, plus an optional `footer`
 *   CTA row (divider + "Not sure yet? See all {destination} tours ->").
 *
 * Both render three large image cards (16px radius, bottom `#1a1a1a` scrim, white
 * label), mobile snap-scroll -> lg 3-column grid. Each item links to a sibling
 * page at the same destination (`/{destinationSlug}/{slug}`) - works for category
 * and collection slugs alike (same flat resolution route).
 */
export function CategoryYouMightLike({
    title,
    items,
    locale,
    destinationSlug,
    variant = 'category',
    footer,
}: {
    title: string;
    items: RelatedCategory[];
    locale: Locale;
    destinationSlug: string;
    variant?: 'category' | 'collection';
    footer?: YouMightLikeFooter;
}) {
    if (items.length === 0) return null;

    const isCollection = variant === 'collection';

    return (
        <section
            className={cn(
                'it-section max-md:py-[32px]!',
                isCollection ? 'bg-it-white' : 'bg-it-surface'
            )}>
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
                                            'group relative block overflow-hidden rounded-[8px] bg-it-border lg:rounded-[16px]',
                                            isCollection
                                                ? 'aspect-384/361'
                                                : 'aspect-384/292'
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
                                        {/* Bottom scrim - transparent -> #1a1a1a over the lower 139px (Figma). */}
                                        <div className='pointer-events-none absolute inset-x-0 bottom-0 h-34.75 bg-linear-to-b from-transparent to-it-ink' />
                                        <span
                                            className={cn(
                                                'absolute bottom-6 left-6 font-medium tracking-[-0.012em] text-it-white',
                                                isCollection
                                                    ? 'text-[20px] leading-[1.2] md:text-[24px]'
                                                    : 'text-[16px] leading-[1.6]'
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

