'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { MotionLink } from '@/components/frontend/motion-link';
import { Reveal } from '@/components/frontend/reveal';
import {
    statusPrimaryClass,
    statusSecondaryClass,
} from '@/components/frontend/status/status-screen';
import { TourCard, type TourCardDict } from '@/components/frontend/tour-card';
import { isLocale, localizeHref } from '@/lib/constants/locales';
import { getStatusCopy, localeFromPathname } from '@/lib/i18n/status-copy';
import { springPop } from '@/lib/motion';
import { searchHitToListing, type DurationDict } from '@/lib/tours/listing';
import type { SearchHit } from '@/types/search';

/**
 * A quick-link chip under the actions (MCK-10: the featured hub first, then
 * the destination's categories). `path` is locale-free - the client localizes
 * it the same way as every other link on this screen.
 */
export type NotFoundQuickLink = { name: string; path: string };

/**
 * The featured hub placement in the hero's right column (MCK-10: the Klein
 * Curaçao hub photo with its caption pill). `src` is the hub's OWN hero image
 * only - no stand-in art. When it is null the figure keeps its `bg-it-border`
 * fallback background, exactly like every tour-card image container sitewide.
 */
export type NotFoundHub = { src: string | null; caption: string; path: string };

/**
 * "Popular right now" strip data, fetched server-side in the default locale
 * (same rationale as the island chips: a 404 has no locale params, and the
 * strip degrades to hidden when the backend is unreachable).
 */
export type NotFoundPopular = {
    hits: SearchHit[];
    /** Destination-wide LIVE total, for "View all {count} tours". */
    total?: number;
    /** Locale-free path of the destination's All Tours archive. */
    browsePath?: string;
    cardDict: TourCardDict;
    durationDict: DurationDict;
};

/**
 * The 404 screen (mockup MCK-10 adapted to the island.tours design system),
 * shared by the public `[locale]/not-found.tsx` and the root `not-found.tsx`.
 *
 * Client, and deliberately so: `not-found.tsx` receives no `params`, so the
 * pathname is the only signal for which language the traveler was reading in -
 * correct on a direct hit and on a client navigation alike.
 *
 * Layout: a two-column hero - giant faded "404", headline, two ways out
 * (explore tours / homepage), island quick-link chips and a WhatsApp help line
 * on the left; a destination photo with a caption pill on the right - followed
 * by a "Popular right now" tour strip on the surface background. Every extra
 * (photo, chips, WhatsApp, popular row) is optional, so the root 404 renders
 * the same hero with nothing to fetch and nothing broken.
 */
export function NotFoundScreen({
    quickLinks = [],
    hub,
    popular,
    whatsappUrl,
    destinationName,
    explorePath,
    fill = 'section',
}: {
    quickLinks?: NotFoundQuickLink[];
    hub?: NotFoundHub;
    popular?: NotFoundPopular;
    whatsappUrl?: string | null;
    /** Island name for the primary CTA ("Explore all Curaçao tours"). */
    destinationName?: string;
    /** Locale-free path the primary CTA leads to (the All Tours archive). */
    explorePath?: string;
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

    // "Explore all {destination} tours" - or the generic form on the root 404,
    // where no destination resolves.
    const exploreLabel = destinationName
        ? copy.primaryCta.replace('{destination}', destinationName)
        : copy.primaryCta
              .replace('{destination}', '')
              .replace(/\s{2,}/g, ' ')
              .trim();

    const tours =
        popular?.hits.map(hit =>
            searchHitToListing(hit, locale, popular.durationDict)
        ) ?? [];

    return (
        <div className='flex flex-1 flex-col'>
            {/* ── Hero ─────────────────────────────────────────────────────── */}
            <section
                className={`it-status-surface flex flex-1 items-center ${
                    fill === 'viewport' ? 'min-h-svh' : ''
                }`}>
                <div className='it-container w-full py-14 md:py-20'>
                    <div
                        className={
                            hub
                                ? 'grid items-center gap-10 lg:grid-cols-[1.04fr_0.96fr] lg:gap-14'
                                : ''
                        }>
                        <div>
                            {/* The status code as a watermark - the mockup drops
                                the eyebrow badge because the giant 404 IS the
                                code. Faded brand tint, never a full-strength
                                coral block. */}
                            <span
                                aria-hidden
                                className='block font-it-display font-medium text-[clamp(84px,11vw,138px)] leading-[0.92] tracking-[-2px] text-it-peach-border select-none'>
                                404
                            </span>

                            <h1 className='m-0 mt-2.5 font-it-display font-medium text-[clamp(34px,4.4vw,52px)] leading-[1.05] tracking-[-0.5px] text-it-ink'>
                                {copy.title}
                            </h1>

                            <p className='m-0 mt-4 max-w-[54ch] text-[17px] leading-[1.6] text-it-text-muted'>
                                {copy.description}
                            </p>

                            <div className='mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4'>
                                <MotionLink
                                    href={href(explorePath ?? '/search')}
                                    whileTap={{ scale: 0.98 }}
                                    transition={springPop}
                                    className={statusPrimaryClass}>
                                    {exploreLabel}
                                    <Image
                                        src='/icons/hero-arrow-right.svg'
                                        alt=''
                                        width={24}
                                        height={24}
                                        className='size-5'
                                    />
                                </MotionLink>
                                <MotionLink
                                    href={href('/')}
                                    whileTap={{ scale: 0.98 }}
                                    transition={springPop}
                                    className={statusSecondaryClass}>
                                    {copy.secondaryCta}
                                </MotionLink>
                            </div>

                            {quickLinks.length > 0 && (
                                <div className='mt-9'>
                                    <span className='block text-[11.5px] font-bold uppercase leading-none tracking-[0.12em] text-it-ink-muted'>
                                        {copy.jumpLabel}
                                    </span>
                                    <div className='mt-3 flex flex-wrap items-center gap-2 md:gap-3'>
                                        {quickLinks.map(link => (
                                            <MotionLink
                                                key={link.path}
                                                href={href(link.path)}
                                                whileTap={{ scale: 0.97 }}
                                                transition={springPop}
                                                className='inline-flex items-center rounded-it-full border border-it-border bg-it-white px-4 py-[9px] text-[13.5px] font-bold leading-none text-it-ink no-underline transition-colors duration-(--it-duration-xs) hover:border-it-primary hover:bg-it-primary-subtle hover:text-it-primary-hover'>
                                                {link.name}
                                            </MotionLink>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {whatsappUrl && (
                                <p className='m-0 mt-7 text-[14px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                    {copy.helpPrompt}{' '}
                                    <a
                                        href={whatsappUrl}
                                        target='_blank'
                                        rel='noreferrer'
                                        className='font-normal text-it-heading underline underline-offset-3 transition-colors duration-300 hover:text-it-primary'>
                                        {copy.helpLinkLabel}
                                    </a>{' '}
                                    {copy.helpSuffix}
                                </p>
                            )}
                        </div>

                        {hub && (
                            <Link
                                href={href(hub.path)}
                                aria-label={hub.caption}
                                className='block rounded-[24px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-it-primary'>
                                {/* No stand-in art: without a hero image the
                                    figure shows its bg-it-border fallback, the
                                    same treatment as every photo container
                                    sitewide. */}
                                <figure className='relative m-0 aspect-[16/10] overflow-hidden rounded-[24px] bg-it-border shadow-it-lg lg:aspect-[4/3.3]'>
                                    {hub.src && (
                                        <Image
                                            src={hub.src}
                                            alt={hub.caption}
                                            fill
                                            sizes='(max-width: 1024px) 100vw, 640px'
                                            className='object-cover'
                                        />
                                    )}
                                    <figcaption className='absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-it-full bg-it-white/90 px-4 py-2 text-[13px] font-normal leading-none tracking-[-0.012em] text-it-heading shadow-it-sm backdrop-blur-sm'>
                                        <span
                                            aria-hidden
                                            className='size-1.5 rounded-full bg-it-green'
                                        />
                                        {hub.caption}
                                    </figcaption>
                                </figure>
                            </Link>
                        )}
                    </div>
                </div>
            </section>

            {/* ── Popular right now ────────────────────────────────────────── */}
            {tours.length > 0 && popular && (
                <section className='it-section border-t border-it-border-subtle bg-it-surface'>
                    <div className='it-container'>
                        <Reveal>
                            <div className='mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 md:mb-10'>
                                <div>
                                    <h2 className='m-0 font-it-display text-[27px] font-medium leading-[1.2] tracking-[-0.3px] text-it-ink'>
                                        {copy.popularTitle}
                                    </h2>
                                    <p className='m-0 mt-2 text-[14px] leading-[1.6] tracking-[-0.012em] text-it-text-muted md:text-[16px]'>
                                        {copy.popularSubtitle}
                                    </p>
                                </div>
                                <Link
                                    href={href(popular.browsePath ?? '/search')}
                                    className='inline-flex items-center gap-1 border-b-2 border-it-peach-border pb-0.5 text-[14.5px] font-bold leading-[1.3] text-it-ink no-underline transition-colors duration-(--it-duration-sm) hover:border-it-primary hover:text-it-primary-hover'>
                                    {popular.total
                                        ? copy.viewAllTours.replace(
                                              '{count}',
                                              String(popular.total)
                                          )
                                        : copy.viewAllTours.replace(
                                              /\s*\{count\}\s*/,
                                              ' '
                                          )}
                                    <Image
                                        src='/icons/cta-arrow-right.svg'
                                        alt=''
                                        width={20}
                                        height={20}
                                        className='size-5 shrink-0'
                                    />
                                </Link>
                            </div>
                        </Reveal>

                        {/* Sitewide tour grid: mobile edge-bleed carousel, then
                            the standard 3-col (sm) / 4-col (lg) grid. */}
                        <div className='grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-5'>
                            {tours.map((tour, i) => (
                                <Reveal key={tour.id} width='auto' listItem>
                                    <TourCard
                                        tour={tour}
                                        dict={popular.cardDict}
                                        mobileRow
                                        priority={i < 3}
                                    />
                                </Reveal>
                            ))}
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}

