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
 * Breadcrumb bar - `Home › {Destination} [› {Anchor}] › {current}`.
 * Matches Figma node 47167:4017 (All Tours) and 47936:3362 (Tour detail).
 *
 * The trailing item (current page) is muted and not a link; the full-width
 * divider beneath bleeds to the 1440 container band. An optional `anchor` adds
 * one clickable crumb between the destination and the current page - this is the
 * tour page's hub-/category-anchored variant (master §9). Omit it for the flat
 * `Home › Destination › current` shape used by All Tours / Hub / Category.
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
        'shrink-0 text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading no-underline transition-colors duration-300 hover:text-it-primary';

    const separator = (
        <Image
            src='/icons/breadcrumb/arrow-right.svg'
            alt=''
            width={20}
            height={20}
            className='size-5 shrink-0'
        />
    );

    return (
        <section className='bg-it-white'>
            <div className='mx-auto w-full max-w-[1440px]'>
                <nav
                    aria-label='Breadcrumb'
                    className='flex items-center gap-2 overflow-x-auto px-4 py-5 whitespace-nowrap [scrollbar-width:none] md:overflow-visible md:px-8 md:whitespace-normal xl:px-30 [&::-webkit-scrollbar]:hidden'>
                    <Link
                        href={localizeHref(locale, '/')}
                        className={linkClass}>
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
            <div className='h-px w-full bg-it-heading/10' />
        </section>
    );
}

