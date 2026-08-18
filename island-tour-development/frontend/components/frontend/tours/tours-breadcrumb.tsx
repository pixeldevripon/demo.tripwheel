import Image from 'next/image';
import Link from 'next/link';
import { localizeHref, type Locale } from '@/lib/constants/locales';

type BreadcrumbDict = {
    home: string;
    current: string;
};

/** Optional clickable crumb between the destination and the current page. */
export type BreadcrumbAnchor = {
    label: string;
    /** Path relative to the locale root, e.g. `/curacao/klein-curacao`. */
    href: string;
};

/**
 * Breadcrumb row - `Home › {Destination} [› {Anchor}] › {current}` (design v2
 * .crumbs: 12.5px muted links, `›` separators, current crumb in ink). Sits at
 * the top of the page-header block; the page's H1 follows directly beneath.
 *
 * An optional `anchor` adds one clickable crumb between the destination and the
 * current page - the tour page's hub-/category-anchored variant (master §9).
 * Omit it for the flat `Home › Destination › current` shape used by
 * All Tours / Hub / Category.
 */
export function ToursBreadcrumb({
    locale,
    destinationName,
    destinationSlug,
    anchor,
    dict,
}: {
    locale: Locale;
    destinationName: string;
    destinationSlug: string;
    anchor?: BreadcrumbAnchor | null;
    dict: BreadcrumbDict;
}) {
    // shrink-0 + the nav's nowrap/overflow: crumbs must never wrap into
    // multi-line stacks on mobile - the row stays one line and scrolls.
    const linkClass =
        'shrink-0 text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading no-underline hover:underline';

    const separator = (
        <Image
            src='/icons/breadcrumb-arrow.svg'
            alt=''
            aria-hidden
            width={20}
            height={20}
            className='mx-1 size-5 shrink-0'
        />
    );

    return (
        <div className='it-container'>
            <nav
                aria-label='Breadcrumb'
                className='flex items-center overflow-x-auto whitespace-nowrap pt-[26px] pb-2.5 [scrollbar-width:none] md:overflow-visible md:whitespace-normal [&::-webkit-scrollbar]:hidden tracking-[-0.012em]'>
                <Link href={localizeHref(locale, '/')} className={linkClass}>
                    {dict.home}
                </Link>
                {separator}
                <Link
                    href={localizeHref(locale, `/${destinationSlug}`)}
                    className={linkClass}>
                    {destinationName}
                </Link>
                {anchor && (
                    <>
                        {separator}
                        <Link
                            href={localizeHref(locale, anchor.href)}
                            className={linkClass}>
                            {anchor.label}
                        </Link>
                    </>
                )}
                {separator}
                {/* Truncated on mobile: the full name is the H1 directly
                    below, so the crumb only needs to identify the page. */}
                <span
                    aria-current='page'
                    className='max-w-[55vw] truncate text-[14px] leading-[1.6] tracking-[-0.012em] text-it-text-muted md:max-w-none'>
                    {dict.current}
                </span>
            </nav>
        </div>
    );
}
