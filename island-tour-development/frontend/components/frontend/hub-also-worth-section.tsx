import Image from 'next/image';
import Link from 'next/link';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import { Reveal } from './reveal';

export type HubAlsoWorthItem = {
    name: string;
    slug: string;
    image?: string;
};

/**
 * "Also worth your time on {destination}" - related-activity grid shown after the
 * FAQ on an Activity Hub page (Figma desktop 48024:12096 / mobile 48621:8785).
 *
 * Sibling of `CategoryYouMightLike`: same Reveal + mobile snap-scroll / lg grid
 * structure, but the hub card is taller (384x361, 16px radius) with a larger,
 * horizontally-centred 24px label on desktop, dropping to 274x210 / 8px radius
 * with a bottom-left 16px label on mobile. Each card links to a sibling activity
 * category at the same destination.
 */
export function HubAlsoWorthSection({
    title,
    items,
    locale,
    destinationSlug,
}: {
    title: string;
    items: HubAlsoWorthItem[];
    locale: Locale;
    destinationSlug: string;
}) {
    if (items.length === 0) return null;

    return (
        <section className='it-section max-md:py-[32px]! bg-it-white'>
            <div className='it-container'>
                {/* 24px heading→cards on mobile, 48px on desktop (Figma). */}
                <Reveal className='flex flex-col gap-6 md:gap-12'>
                    <h2 className='m-0 font-medium text-[24px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                        {title}
                    </h2>

                    {/* Mobile: horizontal snap-scroll of 274px cards (16px gap).
                        lg+: static 3-column grid (24px gap). */}
                    <div className='flex snap-x snap-mandatory gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible'>
                        {items.map((item) => (
                            <Link
                                key={item.slug}
                                href={localizeHref(
                                    locale,
                                    `/${destinationSlug}/${item.slug}`,
                                )}
                                className='group relative block aspect-274/210 w-68.5 shrink-0 snap-start overflow-hidden rounded-[8px] bg-it-border lg:aspect-384/361 lg:w-auto lg:rounded-[16px]'>
                                {item.image && (
                                    <Image
                                        src={item.image}
                                        alt={item.name}
                                        fill
                                        sizes='(min-width: 1024px) 384px, 274px'
                                        className='object-cover transition-transform duration-500 ease-out group-hover:scale-105'
                                    />
                                )}
                                {/* Bottom scrim - transparent → #1a1a1a; bottom
                                    139px on mobile, 247px on desktop (Figma). */}
                                <div className='pointer-events-none absolute inset-x-0 bottom-0 h-34.75 bg-linear-to-b from-transparent to-it-ink lg:h-[247px]' />
                                {/* Label - bottom-left 16px on mobile, centred
                                    24px on desktop (Figma). */}
                                <span className='absolute bottom-6 left-6 font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-white lg:left-1/2 lg:-translate-x-1/2 lg:text-[24px] lg:leading-[1.2]'>
                                    {item.name}
                                </span>
                            </Link>
                        ))}
                    </div>
                </Reveal>
            </div>
        </section>
    );
}
