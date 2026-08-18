import { type Locale } from '@/lib/constants/locales';
import Image from 'next/image';

export type TourHeaderDict = { localsFavorite: string };

/**
 * Tour detail title block - sits directly under the breadcrumb. Rebuilt to
 * Figma 47936:3370: a 48px H1 over one muted 16px meta row - star + rating,
 * "Locals' favorite", pin + location - joined by 6px dots, with Save/Share at
 * the right end.
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
    // Meta groups in Figma order (47936:3370), each rendered only when it has a
    // value, separated by 6px dots.
    //
    // All three read as ONE muted line at 16px/regular in #767676 - the colour
    // lives in the icons, not the words. Two treatments were dropped to get
    // there, and both were deliberate before, so they are worth naming:
    // the rating number was amber, and "Locals' favorite" was orange with a
    // leading. Figma draws both as plain muted text; the star's orange
    // fill and the pin's orange stroke are the only colour on the row.
    const metaItems: React.ReactNode[] = [];
    if (rating != null) {
        metaItems.push(
            <span key='rating' className='flex items-center gap-2'>
                <Image
                    src='/icons/tour/hdr-star.svg'
                    alt=''
                    width={24}
                    height={23}
                    className='size-4 shrink-0 lg:size-5'
                />
                <span className='tabular-nums'>{`${rating.toFixed(1)} (${new Intl.NumberFormat(locale).format(reviewCount)})`}</span>
            </span>
        );
    }
    if (isLocalsFavourite) {
        metaItems.push(<span key='locals'>{dict.localsFavorite}</span>);
    }
    if (locationLabel) {
        metaItems.push(
            <span key='location' className='flex items-center gap-2'>
                <Image
                    src='/icons/tour/hdr-location.svg'
                    alt=''
                    width={24}
                    height={24}
                    className='size-4 shrink-0 lg:size-5'
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
                <div className='flex flex-col pt-5 pb-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6'>
                    <div className='flex min-w-0 flex-col gap-2'>
                        {/* Figma: 48px/510/1.2. That is the largest type on the
                            site by a wide margin - the hub hero H1 tops out at
                            37px - and it reverses the sitewide type reduction
                            of Aug 18. It is the node's value, asked for
                            explicitly; the clamp keeps a phone readable and
                            lands on exactly 48px at the 1440 frame. */}
                        <h1 className='m-0 max-w-[22em] font-it-display it-h1 text-balance text-it-heading font-medium'>
                            {title}
                        </h1>
                        {metaItems.length > 0 && (
                            <div className='flex flex-wrap items-center gap-x-3 gap-y-1.5 it-text text-it-text-muted lg:gap-x-4 '>
                                {metaItems.map((item, i) => (
                                    <span
                                        key={i}
                                        className='flex items-center gap-x-3 lg:gap-x-4'>
                                        {/* 6px @ 20% ink, drawn BETWEEN items
                                            only - never leading or trailing a
                                            wrapped line. */}
                                        {i > 0 && (
                                            <span
                                                aria-hidden='true'
                                                className='size-1.5 shrink-0 rounded-full bg-it-heading/20'
                                            />
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
