import { localizeHref, type Locale } from '@/lib/constants/locales';
import Image from 'next/image';
import Link from 'next/link';
import { Reveal } from '../reveal';

export type HubAlsoWorthItem = { name: string; slug: string; image?: string };

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
                <Reveal className='flex flex-col gap-[22px]'>
                    <h2 className='m-0 font-it-display text-[clamp(22px,2.8vw,30px)] font-medium leading-[1.2] tracking-[-0.015em] text-it-ink'>
                        {title}
                    </h2>

                    {/* Mobile: horizontal snap-scroll of 274px cards (16px gap).
                        lg+: static 3-column grid (24px gap). */}
                    <div className='flex snap-x snap-mandatory gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-3 lg:gap-4 lg:overflow-visible'>
                        {items.map(item => (
                            <Reveal key={item.slug} delay={0.02} listItem>
                                <Link
                                    href={localizeHref(
                                        locale,
                                        `/${destinationSlug}/${item.slug}`
                                    )}
                                    className='group relative flex aspect-274/210 w-68.5 shrink-0 snap-start items-end overflow-hidden rounded-it-lg bg-it-bg p-[18px] lg:aspect-[3/3.4] lg:w-auto'>
                                    {item.image && (
                                        <Image
                                            src={item.image}
                                            alt={item.name}
                                            fill
                                            sizes='(min-width: 1024px) 384px, 274px'
                                            className='object-cover transition-transform duration-(--it-duration-md) ease-(--it-ease) group-hover:scale-[1.04]'
                                        />
                                    )}
                                    {/* Scrim over real photos only - the flat
                                        paper fallback stays gradient-free, and
                                        the label flips to ink on it. */}
                                    {item.image && (
                                        <div className='pointer-events-none absolute inset-0 bg-linear-to-b from-transparent from-40% to-it-dark/78' />
                                    )}
                                    <span
                                        className={`relative z-2 font-it-display text-[18px] font-medium leading-[1.3] tracking-[-0.01em] ${item.image ? 'text-it-white' : 'text-it-ink'}`}>
                                        {item.name}
                                    </span>
                                </Link>
                            </Reveal>
                        ))}
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

