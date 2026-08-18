import Image from 'next/image';
import Link from 'next/link';
import { localizeHref, type Locale } from '@/lib/constants/locales';

type BreadcrumbDict = {
    home: string;
    /** Unused when `destinationIsCurrent` is set. */
    current?: string;
};

/** Optional clickable crumb between the destination and the current page. */
export type BreadcrumbAnchor = {
    label: string;
    /** Path relative to the locale root, e.g. `/curacao/klein-curacao`. */
    href: string;
};

/**
 * THE breadcrumb row - `Home > {Destination} [> {Anchor}] > {current}`.
 *
 * One component for every page that has crumbs: All Tours, hub, category,
 * collection, the tour page, and the destination page. The destination page
 * used to carry its own inline copy, which is how the three surfaces ended up
 * with different type sizes AND different vertical padding (py-4 there against
 * pt-[26px] pb-2.5 here). A second copy of a row this small is all it takes.
 *
 * Set `destinationIsCurrent` when the destination IS the page being viewed;
 * the row then ends at `Home > {Destination}` with the destination as plain
 * text rather than linking to itself.
 *
 * An optional `anchor` adds one clickable crumb between the destination and the
 * current page - the tour page's hub-/category-anchored variant (master §9).
 * Omit it for the flat `Home > Destination > current` shape.
 */
export function ToursBreadcrumb({
    locale,
    destinationName,
    destinationSlug,
    anchor,
    dict,
    destinationIsCurrent = false,
}: {
    locale: Locale;
    destinationName: string;
    destinationSlug: string;
    anchor?: BreadcrumbAnchor | null;
    dict: BreadcrumbDict;
    /** The destination is the current page: no self-link, no trailing crumb. */
    destinationIsCurrent?: boolean;
}) {
    // shrink-0 + the nav's nowrap/overflow: crumbs must never wrap into
    // multi-line stacks on mobile - the row stays one line and scrolls.
    const linkClass =
        'shrink-0 text-[13px] leading-[1.6] tracking-[-0.012em] text-it-heading no-underline hover:underline';

    // The final crumb: same size as the links, muted, never a link.
    const currentClass =
        'max-w-[55vw] shrink-0 truncate text-[13px] leading-[1.6] tracking-[-0.012em] text-it-text-muted md:max-w-none';

    const separator = (
        <Image
            src='/icons/breadcrumb-arrow.svg'
            alt=''
            aria-hidden
            width={20}
            height={20}
            className='mx-0.5 size-3.5 shrink-0'
        />
    );

    return (
        <div className='it-container'>
            <nav
                aria-label='Breadcrumb'
                className='flex items-center overflow-x-auto whitespace-nowrap py-4 [scrollbar-width:none] md:overflow-visible md:whitespace-normal [&::-webkit-scrollbar]:hidden'>
                <Link href={localizeHref(locale, '/')} className={linkClass}>
                    {dict.home}
                </Link>
                {separator}
                {destinationIsCurrent ? (
                    <span aria-current='page' className={currentClass}>
                        {destinationName}
                    </span>
                ) : (
                    <>
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
                <span aria-current='page' className={currentClass}>
                    {dict.current}
                </span>
                    </>
                )}
            </nav>
        </div>
    );
}
