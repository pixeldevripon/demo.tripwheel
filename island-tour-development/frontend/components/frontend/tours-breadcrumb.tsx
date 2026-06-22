import Image from 'next/image';
import Link from 'next/link';
import { localizeHref, type Locale } from '@/lib/constants/locales';

type BreadcrumbDict = {
    home: string;
    current: string;
};

/**
 * All Tours breadcrumb bar - `Home › {Destination} › All Tours`.
 * Matches Figma node 47167:4017. The trailing item (current page) is muted and
 * not a link; the full-width divider beneath bleeds to the 1440 container band.
 */
export function ToursBreadcrumb({
    locale,
    destinationName,
    destinationSlug,
    dict,
}: {
    locale: Locale;
    destinationName: string;
    destinationSlug: string;
    dict: BreadcrumbDict;
}) {
    const linkClass =
        'text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading no-underline transition-colors hover:text-it-primary';

    return (
        <section className='bg-it-white'>
            <div className='mx-auto w-full max-w-[1440px]'>
                <nav
                    aria-label='Breadcrumb'
                    className='flex items-center gap-2 px-4 py-5 md:px-8 xl:px-30'>
                    <Link
                        href={localizeHref(locale, '/')}
                        className={linkClass}>
                        {dict.home}
                    </Link>
                    <Image
                        src='/icons/breadcrumb/arrow-right.svg'
                        alt=''
                        width={20}
                        height={20}
                        className='size-5 shrink-0'
                    />
                    <Link
                        href={localizeHref(locale, `/${destinationSlug}`)}
                        className={linkClass}>
                        {destinationName}
                    </Link>
                    <Image
                        src='/icons/breadcrumb/arrow-right.svg'
                        alt=''
                        width={20}
                        height={20}
                        className='size-5 shrink-0'
                    />
                    <span
                        aria-current='page'
                        className='text-[14px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                        {dict.current}
                    </span>
                </nav>
            </div>
            <div className='h-px w-full bg-it-heading/10' />
        </section>
    );
}

