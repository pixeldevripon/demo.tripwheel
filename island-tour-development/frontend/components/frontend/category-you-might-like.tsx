import Image from 'next/image';
import Link from 'next/link';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import { Reveal } from './reveal';

export type RelatedCategory = {
    name: string;
    slug: string;
    image?: string;
};

/**
 * "You might also like" — related-category grid shown after the tour listing on
 * a category page (Figma node 47070:2238). Three large image cards (384×292,
 * 16px radius) with a bottom `#1a1a1a` scrim and a white category label; each
 * links to the sibling category page at the same destination.
 */
export function CategoryYouMightLike({
    title,
    items,
    locale,
    destinationSlug,
}: {
    title: string;
    items: RelatedCategory[];
    locale: Locale;
    destinationSlug: string;
}) {
    if (items.length === 0) return null;

    return (
        <section className='it-section max-md:py-[32px]! bg-it-surface'>
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
                                className='group relative block aspect-384/292 w-68.5 shrink-0 snap-start overflow-hidden rounded-[8px] bg-it-border lg:w-auto lg:rounded-[16px]'>
                                {item.image && (
                                    <Image
                                        src={item.image}
                                        alt={item.name}
                                        fill
                                        sizes='(min-width: 1024px) 384px, 274px'
                                        className='object-cover transition-transform duration-500 ease-out group-hover:scale-105'
                                    />
                                )}
                                {/* Bottom scrim — transparent → #1a1a1a over the lower 139px (Figma). */}
                                <div className='pointer-events-none absolute inset-x-0 bottom-0 h-34.75 bg-linear-to-b from-transparent to-it-ink' />
                                <span className='absolute bottom-6 left-6 font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-white'>
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
