'use client';

import { Map } from 'lucide-react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

import { MotionLink } from '@/components/frontend/motion-link';
import {
    StatusScreen,
    statusPrimaryClass,
    statusSecondaryClass,
} from '@/components/frontend/status/status-screen';
import { isLocale, localizeHref } from '@/lib/constants/locales';
import { getStatusCopy, localeFromPathname } from '@/lib/i18n/status-copy';
import { springPop } from '@/lib/motion';

/** Just enough of a destination to offer it as a way out. */
export type NotFoundIsland = { name: string; slug: string };

/**
 * The 404 screen, shared by the public `[locale]/not-found.tsx` and the root
 * `not-found.tsx`.
 *
 * Client, and deliberately so: `not-found.tsx` receives no `params`, so the
 * pathname is the only signal for which language the traveler was reading in -
 * correct on a direct hit and on a client navigation alike.
 *
 * `islands` turns the dead end into a real recovery surface: this is a
 * destination-first marketplace, so the fastest route back is the island the
 * traveler was browsing. Pass `[]` (or omit) outside the locale tree, where
 * there is no destination data to offer.
 */
export function NotFoundScreen({
    islands = [],
    fill = 'section',
}: {
    islands?: NotFoundIsland[];
    fill?: 'section' | 'viewport';
}) {
    const pathname = usePathname();
    const locale = localeFromPathname(pathname);
    const copy = getStatusCopy(locale).notFound;

    // Inside the locale tree, link straight to the localized URL - no redirect
    // hop. Outside it (an unmatched root URL) the locale is a guess, so hand
    // the bare path to the proxy and let it resolve cookie/Accept-Language.
    const inLocaleTree = isLocale(pathname?.split('/')[1]);
    const href = (path: string) =>
        inLocaleTree ? localizeHref(locale, path) : path;

    return (
        <StatusScreen
            tone='coral'
            fill={fill}
            // A map, matching the headline word for word ("drifted off the
            // map"). No struck-through or crossed-out glyph: a 404 is a wrong
            // turn, not a failure, and a negation mark gives it a severity the
            // moment does not have. The dashed ring and the headline carry the
            // "not found" meaning; the icon stays travel-coded and warm.
            icon={<Map className='size-10 md:size-11' strokeWidth={1.5} />}
            eyebrow={copy.eyebrow}
            eyebrowTone='error'
            title={copy.title}
            description={copy.description}
            actions={
                <>
                    <MotionLink
                        href={href('/')}
                        whileTap={{ scale: 0.98 }}
                        transition={springPop}
                        className={statusPrimaryClass}>
                        {copy.primaryCta}
                        <Image
                            src='/icons/hero-arrow-right.svg'
                            alt=''
                            width={24}
                            height={24}
                            className='size-5'
                        />
                    </MotionLink>
                    <MotionLink
                        href={href('/search')}
                        whileTap={{ scale: 0.98 }}
                        transition={springPop}
                        className={statusSecondaryClass}>
                        {copy.secondaryCta}
                    </MotionLink>
                </>
            }
            footer={
                islands.length > 0 ? (
                    <>
                        <span className='text-[14px] leading-none tracking-[-0.012em] text-it-text-muted'>
                            {copy.islandsLabel}
                        </span>
                        <div className='mt-5 flex flex-wrap items-center justify-center gap-2 md:gap-3'>
                            {islands.map(island => (
                                <MotionLink
                                    key={island.slug}
                                    href={href(`/${island.slug}`)}
                                    whileTap={{ scale: 0.97 }}
                                    transition={springPop}
                                    className='inline-flex items-center rounded-it-full border border-it-border bg-it-white px-4 py-2 text-[14px] font-medium leading-[1.6] tracking-[-0.012em] text-it-ink-secondary no-underline transition-colors duration-300 hover:border-it-primary hover:text-it-primary'>
                                    {island.name}
                                </MotionLink>
                            ))}
                        </div>
                    </>
                ) : undefined
            }
        />
    );
}
