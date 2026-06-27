import Image from 'next/image';
import { type Locale } from '@/lib/constants/locales';

export type TourHeaderDict = {
    save: string;
    share: string;
    localsFavorite: string;
};

/**
 * Tour detail page title + header band (Figma node 47936:3370) - sits directly
 * under the breadcrumb. Left: H1 + a meta row (rating, "Locals' favorite",
 * location), each meta group separated by a small dot. Right: Save / Share
 * action pills.
 *
 * The source frame is a wireframe, so the pills (pure white in Figma) carry a
 * hairline `it-border` to read on the white page. Icons are the platform's
 * Figma SVG exports: the orange rating star + location pin, the heart-outline
 * (shared with the listing Save button), and the new share-outline.
 */
export function TourHeader({
    title,
    rating,
    reviewCount,
    isLocalsFavourite,
    locationLabel,
    locale,
    dict,
}: {
    title: string;
    rating: number | null;
    reviewCount: number;
    isLocalsFavourite: boolean;
    locationLabel: string | null;
    locale: Locale;
    dict: TourHeaderDict;
}) {
    const metaText =
        'text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted';

    // Meta groups in Figma order; only the present ones render, joined by dots.
    const metaItems: React.ReactNode[] = [];
    if (rating != null) {
        metaItems.push(
            <span key='rating' className='flex items-center gap-2'>
                <Image
                    src='/icons/star-listings.svg'
                    alt=''
                    width={24}
                    height={24}
                    className='size-6 shrink-0'
                />
                <span className={metaText}>
                    {rating.toFixed(1)} ({new Intl.NumberFormat(locale).format(reviewCount)})
                </span>
            </span>,
        );
    }
    if (isLocalsFavourite) {
        metaItems.push(
            <span key='locals' className={metaText}>
                {dict.localsFavorite}
            </span>,
        );
    }
    if (locationLabel) {
        metaItems.push(
            <span key='location' className='flex items-center gap-2'>
                <Image
                    src='/icons/hero-location.svg'
                    alt=''
                    width={24}
                    height={24}
                    className='size-6 shrink-0'
                />
                <span className={metaText}>{locationLabel}</span>
            </span>,
        );
    }

    // Plain text buttons: no pill, background, or container border - icon + label
    // with an underline (border-bottom) under the label only.
    const actionClass =
        'inline-flex cursor-pointer items-center gap-2 border-none bg-transparent p-0 font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading';
    const actionLabel = 'underline decoration-1.5 underline-offset-2';

    return (
        <section className='bg-it-white'>
            <div className='it-container'>
                <div className='flex flex-col gap-5 py-5 md:flex-row md:items-start md:justify-between md:gap-8'>
                    <div className='flex flex-col gap-2'>
                        <h1 className='m-0 font-medium text-[28px] md:text-[48px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                            {title}
                        </h1>
                        {metaItems.length > 0 && (
                            <div className='flex flex-wrap items-center gap-x-4 gap-y-2'>
                                {metaItems.map((item, i) => (
                                    <span key={i} className='flex items-center gap-4'>
                                        {i > 0 && (
                                            <span className='size-1.5 shrink-0 rounded-it-full bg-it-heading' />
                                        )}
                                        {item}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className='flex shrink-0 items-center gap-6'>
                        <button type='button' className={actionClass}>
                            <Image
                                src='/icons/heart-outline.svg'
                                alt=''
                                width={24}
                                height={24}
                                className='size-6 shrink-0'
                            />
                            <span className={actionLabel}>{dict.save}</span>
                        </button>
                        <button type='button' className={actionClass}>
                            <Image
                                src='/icons/share-outline.svg'
                                alt=''
                                width={24}
                                height={24}
                                className='size-6 shrink-0'
                            />
                            <span className={actionLabel}>{dict.share}</span>
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}
