import { type Locale } from '@/lib/constants/locales';
import Image from 'next/image';

export type TourHeaderDict = { localsFavorite: string };

/**
 * Tour detail title block (design v2 .titleblock) - sits directly under the
 * breadcrumb. Display H1 over the meta row: amber star rating, the deep-orange
 * "✦ Locals' favorite" flag, and the location pin, joined by faint middots
 * (3.4).
 *
 * On desktop Save/Share sit at the right end of this row, level with the meta
 * line. They used to open the booking rail (GAP-18), a block lower - which also
 * held the booking card a row further down than it belonged (Pastel #33).
 */
export function TourHeader({
    title,
    rating,
    reviewCount,
    isLocalsFavourite,
    locationLabel,
    locale,
    dict,
    actions,
}: {
    title: string;
    rating: number | null;
    reviewCount: number;
    isLocalsFavourite: boolean;
    locationLabel: string | null;
    locale: Locale;
    dict: TourHeaderDict;
    /** Save/Share pair, rendered at lg+ only (see the rail for the mobile copy). */
    actions?: React.ReactNode;
}) {
    // Meta groups in mockup order; only the present ones render, joined by dots.
    const metaItems: React.ReactNode[] = [];
    if (rating != null) {
        metaItems.push(
            <span key='rating' className='flex items-center gap-1.5'>
                <span className='font-bold text-it-star'>
                    ★ {rating.toFixed(1)}
                </span>
                <span className='tabular-nums'>
                    ({new Intl.NumberFormat(locale).format(reviewCount)})
                </span>
            </span>
        );
    }
    if (isLocalsFavourite) {
        metaItems.push(
            <span key='locals' className='font-bold text-it-primary-hover'>
                ✦ {dict.localsFavorite}
            </span>
        );
    }
    if (locationLabel) {
        metaItems.push(
            <span key='location' className='flex items-center gap-[5px]'>
                <Image
                    src='/icons/hero-location.svg'
                    alt=''
                    width={24}
                    height={24}
                    className='size-3.5 shrink-0'
                />
                {locationLabel}
            </span>
        );
    }

    return (
        <section className='bg-it-white'>
            <div className='it-container'>
                {/* `items-end` puts the actions on the meta row's baseline - the
                    "level with the subtitle" the client asked for - rather than
                    beside the H1, which on a two-line title would leave them
                    floating in the middle of nothing. */}
                <div className='flex flex-col pt-2.5 pb-4 lg:flex-row lg:items-end lg:justify-between lg:gap-6'>
                    <div className='flex min-w-0 flex-col'>
                        <h1 className='m-0 max-w-[22em] font-it-display text-[clamp(24px,3vw,32px)] font-bold leading-[1.12] tracking-[-0.015em] text-balance text-it-ink'>
                            {title}
                        </h1>
                        {metaItems.length > 0 && (
                            <div className='mt-2.5 flex flex-wrap items-center gap-[7px] text-[13.5px] font-normal leading-[1.6] text-it-text-muted'>
                                {metaItems.map((item, i) => (
                                    <span
                                        key={i}
                                        className='flex items-center gap-[7px]'>
                                        {i > 0 && (
                                            <span className='text-it-ink-muted'>
                                                ·
                                            </span>
                                        )}
                                        {item}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                    {/* Desktop only. Below lg they stay in the booking rail,
                        which is where the mobile design still wants them until
                        Pastel #36 moves them onto the photo. */}
                    {actions && (
                        <div className='hidden shrink-0 lg:block'>
                            {actions}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
