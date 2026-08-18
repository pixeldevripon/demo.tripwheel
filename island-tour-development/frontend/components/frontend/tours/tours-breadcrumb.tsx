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
        'shrink-0 text-it-text-muted no-underline hover:underline text-[14px] leading-[1.6] tracking-[-0.012em]';

    const separator = (
        <span aria-hidden='true' className='mx-[7px] shrink-0 text-it-text-muted'>
            ›
        </span>
    );

    return (
        <div className='it-container'>
            <nav
                aria-label='Breadcrumb'
                className='flex items-center overflow-x-auto whitespace-nowrap pt-[26px] pb-2.5 text-[12.5px] leading-[1.6] text-it-text-muted [scrollbar-width:none] md:overflow-visible md:whitespace-normal [&::-webkit-scrollbar]:hidden'>
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
                    className='max-w-[55vw] truncate text-it-white md:max-w-none text-[16px] leading-[1.6] tracking-[-0.012em] font-medium'>
                    {dict.current}
                </span>
            </nav>
        </div>
    );
}
