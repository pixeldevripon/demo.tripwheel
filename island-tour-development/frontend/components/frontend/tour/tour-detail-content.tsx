import {
    TourReviewsPreviewSkeleton,
    TourReviewsSectionSkeleton,
} from '@/components/frontend/skeletons/tour-page-skeleton';
import { getDestinationCategories } from '@/lib/api/public/categories';
import { getTourReviewSummary } from '@/lib/api/public/reviews';
import { getTourBySlug } from '@/lib/api/public/tours';
import { getServerCurrency } from '@/lib/currency/server';
import { type Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { buildTourBookingData } from '@/lib/tours/booking';
import { formatDuration } from '@/lib/tours/listing';
import type { PublicTourExclusion } from '@/types/tour-detail';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { MountReveal } from '../mount-reveal';
import { Reveal } from '../reveal';
import { TourBookingCard } from './tour-booking-card/tour-booking-card';
import { TourDetailTabs, type TourTab } from './tour-detail-tabs';
import { TourGallery, type TourGalleryMeta } from './tour-gallery';
import { TourHeader } from './tour-header';
import { TourMeetingCard } from './tour-meeting-card';
import { TourReviewsBlock, TourReviewsPreview } from './tour-reviews-blocks';
import { TourSection } from './tour-section';
import { ToursBreadcrumb, type BreadcrumbAnchor } from '../tours/tours-breadcrumb';

// Last-resort gallery fallback: a LIVE tour is expected to carry images, but the
// gallery must never receive an empty set (its mobile slider indexes image[0]),
// so an image-less tour falls back to these placeholders.
const FALLBACK_GALLERY_IMAGES = [
    '/images/tours/tour-1-1.jpg',
    '/images/tours/tour-1-2.jpg',
    '/images/tours/tour-1-3.jpg',
    '/images/tours/tour-2-1.jpg',
    '/images/tours/tour-2-3.jpg',
];

/**
 * Compact language pill from ISO 639-1 codes: "EN", "EN, NL", "EN, NL, +2".
 * (The gallery meta strip, Figma node 47940:12742.)
 */
function formatLanguageCodes(codes: string[]): string {
    const upper = codes.map(c => c.toUpperCase());
    if (upper.length <= 2) return upper.join(', ');
    return `${upper.slice(0, 2).join(', ')}, +${upper.length - 2}`;
}

// A wall-clock "HH:MM" start time formatted for the locale (12h + AM/PM in en,
// 24h in most others). Built on a fixed UTC date so only the clock time shows.
function formatClockTime(hhmm: string, locale: string): string {
    const [h, m] = hhmm.split(':').map(Number);
    if (Number.isNaN(h)) return hhmm;
    const date = new Date(Date.UTC(2000, 0, 1, h, m || 0));
    return new Intl.DateTimeFormat(locale, {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
    }).format(date);
}

// "What's Included" section (Figma node 47936:3621) - two columns: included
// (green check) and not included / add-ons (orange cross). An exclusion's suffix
// is derived from its `type` + optional `priceText`: paid add-ons with a price
// read "(available - $X)", pay-on-site items with no price read "(pay on the
// day)", pay-in-advance items with no price read "(available)", and
// unavailable / not-permitted items carry no suffix (the label says it).
function exclusionSuffix(
    exclusion: PublicTourExclusion,
    dict: Dictionary['destination']['tour']['exclusion']
): string {
    const { type, priceText } = exclusion;
    const isPaid = type === 'PAID_ADVANCE' || type === 'PAID_ONSITE';
    if (isPaid && priceText) {
        return ` (${dict.availablePrice.replace('{price}', priceText)})`;
    }
    if (type === 'PAID_ONSITE') return ` (${dict.payOnDay})`;
    if (type === 'PAID_ADVANCE') return ` (${dict.available})`;
    return '';
}

interface TourDetailContentProps {
    destinationSlug: string;
    slug: string;
    destinationName: string;
    locale: Locale;
    dict: Dictionary;
}

/**
 * Everything driven by the single tour fetch (breadcrumb -> content sections).
 * `await connection()` marks it dynamic so its `<Suspense>` skeleton streams under
 * Cache Components; `getTourBySlug` stays cached (and is deduped with the related
 * block). Reviews render in nested `<Suspense>` boundaries that fetch on their own.
 */
export async function TourDetailContent({
    destinationSlug,
    slug,
    destinationName,
    locale,
    dict,
}: TourDetailContentProps) {
    await connection();
    // Shopper display currency (cookie) drives the converted `money` on the detail;
    // the widget renders it and converts its amounts (guide §21.5). Dependent, so
    // it precedes the currency-aware detail fetch.
    const currency = await getServerCurrency(locale);
    const detail = await getTourBySlug({
        slug,
        destinationSlug,
        locale,
        currency,
    });
    if (!detail) notFound();

    // LD11 lives on the backend (`review-display.util.ts`), not here: the tour
    // payload only carries the tour's OWN aggregates and cannot express the
    // cold-start fallback to the operator's rating. Fetched after the detail
    // because it is keyed by the resolved tour id.
    const reviewSummary = await getTourReviewSummary(detail.id);

    const tourDict = dict.destination.tour;

    // Live header / breadcrumb / title values (localized with EN fallback applied
    // server-side). `title` prefers the localized translation, then the canonical
    // name; `breadcrumbLabel` is the shorter English crumb, falling back to title.
    const title = detail.translation?.title ?? detail.name;
    const breadcrumbLabel = detail.breadcrumbLabel ?? title;
    // The DISPLAYED rating and its count - the tour's own, or the operator's when
    // LD11 borrows it, or null when neither qualifies.
    const rating = reviewSummary.rating;
    const reviewCount = reviewSummary.reviewCount;
    // The tour's OWN approved count. Every render threshold keys off this, never
    // off `reviewCount`, which may belong to the operator: a tour with 0 reviews
    // borrowing an operator's 40 must not thereby unlock the star chart, the sort
    // control or the LD29 preview - none of that data is about this tour.
    const ownReviewCount = reviewSummary.approvedCount;
    const isLocalsFavourite = detail.isLocalsFavourite;
    const locationLabel = detail.departureCity
        ? `${detail.departureCity}, ${destinationName}`
        : destinationName;
    // Breadcrumb variant (master §2.7): anchor on the tour's primary attachment.
    // The only relation flagged primary in the data model is the isPrimary
    // category (`TourCategory.isPrimary`), so a tour is category-anchored
    // (`Home › Destination › Category › Tour`) and falls back to flat when it has
    // no primary category. The hub-anchored variant is reserved for a primary-hub
    // attachment, which the schema doesn't express yet. The primary category of a
    // LIVE tour always appears in the destination's tour-gated category list (it
    // has ≥1 published tour - this one), so its crumb link never 404s.
    let anchor: BreadcrumbAnchor | null = null;
    if (detail.primaryCategoryId) {
        const categories = await getDestinationCategories(
            destinationSlug,
            locale
        );
        const primary = categories.find(c => c.id === detail.primaryCategoryId);
        if (primary) {
            anchor = {
                label: primary.name,
                href: `/${destinationSlug}/${primary.slug}`,
            };
        }
    }

    // Gallery (Figma node 47940:12742): live images in displayOrder (backend-
    // ordered), with a placeholder fallback so the slider never gets an empty set.
    const galleryImages =
        detail.images.length > 0
            ? detail.images.map(img => img.url)
            : FALLBACK_GALLERY_IMAGES;

    // Meta strip pills - only the applicable ones render (duration / pickup /
    // languages), all localized.
    const galleryMeta: TourGalleryMeta[] = [];
    const durationLabel = formatDuration(
        detail.durationMinutesFrom,
        detail.durationMinutesTo,
        dict.search
    );
    if (durationLabel) {
        galleryMeta.push({ icon: '/icons/clock.svg', label: durationLabel });
    }
    if (detail.pickupModel !== 'NONE') {
        galleryMeta.push({
            icon: '/icons/car.svg',
            label: dict.destination.listings.pickupAvailable,
        });
    }
    if (detail.languages.length > 0) {
        galleryMeta.push({
            icon: '/icons/nav-globe.svg',
            label: formatLanguageCodes(detail.languages),
        });
    }

    // Overview (Figma node 47936:3606): the localized `overview` prose (paragraph
    // breaks only - split into <p> blocks), the tour's highlights as a bullet list
    // (localized, ordered by displayOrder - backend-ordered), and an optional
    // "local tip" callout - a bold headline (`localTipTitle`) over a muted
    // description (`localTipBody`), both localized.
    const overviewParagraphs = (detail.translation?.overview ?? '')
        .split(/\n{2,}|\n/)
        .map(p => p.trim())
        .filter(Boolean);
    const highlights = detail.highlights.map(h => h.text).filter(Boolean);
    const localTipTitle = detail.translation?.localTipTitle ?? null;
    const localTipBody = detail.translation?.localTipBody ?? null;

    // "What's Included" - included column (green check) + not-included / add-ons
    // column (orange cross). Both come off the tour payload, already localized
    // and ordered by `displayOrder`; the exclusion suffix (price / "pay on the
    // day") is derived from its type.
    const includedItems = detail.inclusions.filter(i => i.label);
    const excludedItems = detail.exclusions
        .filter(e => e.label)
        .map(e => ({
            id: e.id,
            label: `${e.label}${exclusionSuffix(e, tourDict.exclusion)}`,
        }));

    // "What to Expect" - localized intro paragraph + a numbered timeline built
    // from the tour's locations (START -> ITINERARY_ITEM -> END -> POI, already
    // ordered by `displayOrder` on the backend). Each step is a location title +
    // its short description; a step with no title is skipped.
    const expectIntro = detail.translation?.whatToExpectIntro ?? null;
    const expectSteps = detail.locations
        .filter(l => l.title)
        .map(l => ({ id: l.id, title: l.title, detail: l.shortDescription }));

    // "Meeting & Pickup" (Figma 47936:3746). Meeting point = the START location
    // (title) + the free-text `meetingPointText`; the map link uses the tour's
    // meeting coords (falling back to the START location's). Hotel pickup shows
    // only when the tour offers it (`pickupModel != NONE` and a pickup location
    // exists). Departure lists the tour's start times (locale-formatted) + the
    // check-in lead time. Any block with no data is omitted.
    const meetDict = tourDict.meeting;
    const startLocation = detail.locations.find(l => l.types.includes('START'));
    const meetingText = detail.translation?.meetingPointText ?? null;
    const meetingTitle =
        startLocation?.title || detail.departureCity || detail.name;
    const meetingDetail = meetingText || startLocation?.shortDescription || '';
    const meetingBlock =
        meetingTitle || meetingDetail
            ? {
                  label: meetDict.meetingPoint,
                  title: meetingTitle,
                  detail: meetingDetail,
              }
            : null;

    const meetingLat =
        detail.meetingPointLat ?? startLocation?.latitude ?? null;
    const meetingLng =
        detail.meetingPointLng ?? startLocation?.longitude ?? null;
    const mapLink =
        meetingLat != null && meetingLng != null
            ? {
                  label: meetDict.openInMaps,
                  href: `https://www.google.com/maps/search/?api=1&query=${meetingLat},${meetingLng}`,
              }
            : null;

    const pickupLoc =
        detail.pickupModel !== 'NONE' ? detail.pickupLocations[0] : undefined;
    const pickupBlock = pickupLoc
        ? {
              label: meetDict.hotelPickup,
              title: pickupLoc.title || pickupLoc.name,
              detail: [
                  pickupLoc.windowStart && pickupLoc.windowEnd
                      ? meetDict.pickupWindow
                            .replace('{start}', pickupLoc.windowStart)
                            .replace('{end}', pickupLoc.windowEnd)
                      : null,
                  pickupLoc.directions,
              ]
                  .filter(Boolean)
                  .join('\n'),
          }
        : null;

    const departureBlock =
        detail.startTimes.length > 0
            ? {
                  label: meetDict.departureTime,
                  title: detail.startTimes
                      .map(t => formatClockTime(t, locale))
                      .join(', '),
                  detail: detail.checkInMinutesBefore
                      ? meetDict.checkInEarly.replace(
                            '{minutes}',
                            String(detail.checkInMinutesBefore)
                        )
                      : '',
              }
            : null;

    // "Important Info" - three labeled bullet lists off the localized
    // translation (each string[] a set of bullets). A group with no bullets is
    // omitted (notSuitableFor is frequently empty).
    const infoDict = tourDict.info;
    const infoGroups = [
        {
            title: infoDict.notSuitableFor,
            items: detail.translation?.notSuitableFor ?? [],
        },
        {
            title: infoDict.knowBeforeYouGo,
            items: detail.translation?.knowBeforeYouGo ?? [],
        },
        {
            title: infoDict.whatToBring,
            items: detail.translation?.whatToBring ?? [],
        },
    ].filter(g => g.items.length > 0);

    // "Cancellation Policy" - templated from the tour's free-cancellation window
    // (`cancellationHours`, NOT NULL, enum-bound) + the supplying operator name.
    const cancelDict = tourDict.cancellation;
    const cancellationBody = cancelDict.body.replace(
        /\{hours\}/g,
        String(detail.cancellationHours)
    );

    // Reviews aggregate + histogram come off the tour payload (same source as the
    // header rating); the individual cards stream in a separate boundary from the
    // reviews list. A review's operator IS the tour's operator.
    const reviewHostLabel = detail.operatorName ?? '';
    // Straight from the summary (approved-only, already ordered [5*..1*]) rather
    // than from the tour row, so the chart cannot disagree with the number above it.
    const reviewHistogram = reviewSummary.distribution;

    // In-page tab nav over the detail sections. Each tab scrolls to its `#id`
    // section; sections are added incrementally (each is collapsible, separated
    // by a hairline), so a tab whose section is not built yet is inert.
    const sectionTabs: TourTab[] = [
        { id: 'tour-overview', label: tourDict.sections.overview },
        { id: 'tour-included', label: tourDict.sections.included },
        { id: 'tour-expect', label: tourDict.sections.expect },
        { id: 'tour-meeting', label: tourDict.sections.meeting },
        { id: 'tour-info', label: tourDict.sections.info },
        { id: 'tour-cancellation', label: tourDict.sections.cancellation },
        { id: 'tour-reviews', label: tourDict.sections.reviews },
    ];

    return (
        <>
            <ToursBreadcrumb
                locale={locale}
                destinationName={destinationName}
                destinationSlug={destinationSlug}
                anchor={anchor}
                dict={{
                    home: dict.destination.allTours.breadcrumb.home,
                    current: breadcrumbLabel,
                }}
            />
            <MountReveal>
            <TourHeader
                tourId={detail.id}
                title={title}
                rating={rating}
                reviewCount={reviewCount}
                isLocalsFavourite={isLocalsFavourite}
                locationLabel={locationLabel}
                locale={locale}
                dict={{
                    save: tourDict.save,
                    share: tourDict.share,
                    linkCopied: tourDict.linkCopied,
                    localsFavorite: tourDict.localsFavorite,
                }}
            />
            </MountReveal>

            {/* Left column (gallery + reviews) + static booking card (right rail,
                sticky on lg). Figma nodes 47940:12742 + 47936:3499 + 47936:3386. */}
            {/* One two-column grid so the booking card (right rail) stays sticky
                across the WHOLE page scroll: gallery (col 1, row 1) + all detail
                content (col 1, row 2), with the card spanning both rows. Left
                column keeps the gallery width; right rail stays clear.
                Figma nodes 47940:12742 + 47936:3499 + 47936:3386 + 47936:3592. */}
            <section className='bg-it-white pb-16 md:pb-24'>
                <div className='it-container'>
                    <div className='flex flex-col gap-10 lg:grid lg:grid-cols-[792fr_384fr] lg:items-start lg:gap-x-6 lg:gap-y-10'>
                        {/* Gallery (left column, top row) */}
                        <div className='lg:col-start-1 lg:row-start-1'>
                            <MountReveal delay={0.1}>
                            <TourGallery
                                images={galleryImages}
                                title={title}
                                meta={galleryMeta}
                                showAllPhotosLabel={tourDict.showAllPhotos}
                            />
                            </MountReveal>
                        </div>

                        {/* Booking card - right rail, sticky across the whole page
                            scroll (spans both left-column rows). */}
                        <div className='lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-24'>
                            {/* Live tour pricing / party bands / start times.
                                Real availability (remaining spots, sold-out) still
                                lands with the availability wiring (checklist §4). */}
                            <MountReveal delay={0.15}>
                                <TourBookingCard
                                    dict={tourDict.booking}
                                    data={buildTourBookingData(detail)}
                                    locale={locale}
                                    tourId={detail.id}
                                    destinationSlug={destinationSlug}
                                    tourSlug={slug}
                                    currency={currency}
                                />
                            </MountReveal>
                        </div>

                        {/* Left column content: reviews preview + section tabs +
                            all detail sections + full reviews. */}
                        <div className='flex min-w-0 flex-col gap-10 lg:col-start-1 lg:row-start-2'>
                            {/* LD29 review preview, streamed in its own boundary.
                                Gated on the tour's OWN approved count and its own
                                rating: hidden under 3 reviews, and under a 4.0
                                aggregate. A borrowed operator rating never opens
                                this - the cards would have to come from reviews of
                                a different tour. */}
                            {ownReviewCount >= 3 && (rating ?? 0) >= 4 && (
                                <Suspense
                                    fallback={<TourReviewsPreviewSkeleton />}>
                                    <TourReviewsPreview
                                        tourId={detail.id}
                                        rating={rating}
                                        reviewCount={reviewCount}
                                        locale={locale}
                                        dict={tourDict.reviews}
                                    />
                                </Suspense>
                            )}
                            <TourDetailTabs tabs={sectionTabs} />

                        {/* Content sections - left-aligned readable measure. */}
                        <div className='flex max-w-178.5 flex-col gap-10'>
                            <TourSection
                                id='tour-overview'
                                title={tourDict.sections.overview}>
                                {(overviewParagraphs.length > 0 ||
                                    highlights.length > 0) && (
                                    <div className='flex flex-col gap-4 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                        {overviewParagraphs.map((p, i) => (
                                            <p key={i} className='m-0'>
                                                {p}
                                            </p>
                                        ))}
                                        {highlights.length > 0 && (
                                            <ul className='m-0 list-disc pl-5'>
                                                {highlights.map((h, i) => (
                                                    <li key={i}>
                                                        <Reveal
                                                            width='auto'
                                                            listItem>
                                                            {h}
                                                        </Reveal>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}
                                {/* Local tip callout (Figma node): bold headline
                                    over a muted description. Renders when either
                                    line is present; each line only if it exists. */}
                                {(localTipTitle || localTipBody) && (
                                    <div className='flex items-start gap-2 rounded-[8px] border border-it-primary/30 bg-it-primary/5 p-6'>
                                        <Image
                                            src='/icons/tip-bulb.svg'
                                            alt=''
                                            width={24}
                                            height={24}
                                            className='size-6 shrink-0'
                                        />
                                        <p className='m-0 flex flex-col text-[16px] leading-[1.6] tracking-[-0.012em]'>
                                            {localTipTitle && (
                                                <span className='text-[#8b390e]'>
                                                    {localTipTitle}
                                                </span>
                                            )}
                                            {localTipBody && (
                                                <span className='text-[#8b390e]/60'>
                                                    {localTipBody}
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                )}
                            </TourSection>

                            <div className='h-px w-full bg-it-heading/10' />

                            {(includedItems.length > 0 ||
                                excludedItems.length > 0) && (
                                <>
                                    <TourSection
                                        id='tour-included'
                                        title={tourDict.sections.included}>
                                        <div className='grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-x-16 md:gap-y-0'>
                                            {includedItems.length > 0 && (
                                                <ul className='m-0 flex list-none flex-col gap-2 p-0'>
                                                    {includedItems.map(item => (
                                                        <li key={item.id}>
                                                        <Reveal
                                                            width='auto'
                                                            listItem
                                                            className='flex items-start gap-2 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                                            <Image
                                                                src='/icons/check-green.svg'
                                                                alt=''
                                                                width={20}
                                                                height={20}
                                                                className='size-5 shrink-0'
                                                            />
                                                            {item.label}
                                                        </Reveal>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                            {excludedItems.length > 0 && (
                                                <ul className='m-0 flex list-none flex-col gap-2 p-0'>
                                                    {excludedItems.map(item => (
                                                        <li key={item.id}>
                                                        <Reveal
                                                            width='auto'
                                                            listItem
                                                            className='flex items-start gap-2 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                                            <Image
                                                                src='/icons/exclude-cross.svg'
                                                                alt=''
                                                                width={20}
                                                                height={20}
                                                                className='size-5 shrink-0'
                                                            />
                                                            {item.label}
                                                        </Reveal>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </TourSection>

                                    <div className='h-px w-full bg-it-heading/10' />
                                </>
                            )}

                            {(expectIntro || expectSteps.length > 0) && (
                                <>
                                    <TourSection
                                        id='tour-expect'
                                        title={tourDict.sections.expect}>
                                        {expectIntro && (
                                            <p className='m-0 max-w-172 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                                {expectIntro}
                                            </p>
                                        )}
                                        {/* Numbered timeline - orange step badges
                                            joined by a vertical connector. */}
                                        {expectSteps.length > 0 && (
                                            <ol className='m-0 flex list-none flex-col p-0'>
                                                {expectSteps.map((step, i) => (
                                                    <li
                                                        key={step.id}
                                                        className={`relative ${
                                                            i <
                                                            expectSteps.length -
                                                                1
                                                                ? 'pb-8'
                                                                : ''
                                                        }`}>
                                                        <Reveal
                                                            width='auto'
                                                            listItem
                                                            className='flex gap-4'>
                                                        {i <
                                                            expectSteps.length -
                                                                1 && (
                                                            <span
                                                                aria-hidden='true'
                                                                className='absolute top-10 bottom-0 left-5 w-px -translate-x-1/2 bg-it-heading/15'
                                                            />
                                                        )}
                                                        <span className='relative z-10 grid size-10 shrink-0 place-items-center rounded-it-full bg-it-primary font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-white'>
                                                            {i + 1}
                                                        </span>
                                                        <div className='flex flex-col gap-1 pt-1'>
                                                            <span className='font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                                                {step.title}
                                                            </span>
                                                            {step.detail && (
                                                                <span className='text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                                                    {
                                                                        step.detail
                                                                    }
                                                                </span>
                                                            )}
                                                        </div>
                                                        </Reveal>
                                                    </li>
                                                ))}
                                            </ol>
                                        )}
                                    </TourSection>

                                    <div className='h-px w-full bg-it-heading/10' />
                                </>
                            )}

                            {meetingBlock && (
                                <>
                                    <TourSection
                                        id='tour-meeting'
                                        title={tourDict.sections.meeting}>
                                        <TourMeetingCard
                                            meeting={meetingBlock}
                                            mapLink={mapLink}
                                            pickup={pickupBlock}
                                            departure={departureBlock}
                                        />
                                    </TourSection>

                                    <div className='h-px w-full bg-it-heading/10' />
                                </>
                            )}

                            {infoGroups.length > 0 && (
                                <>
                                    <TourSection
                                        id='tour-info'
                                        title={tourDict.sections.info}>
                                        <div className='flex flex-col gap-6'>
                                            {infoGroups.map(group => (
                                                <Reveal
                                                    key={group.title}
                                                    listItem
                                                    className='flex flex-col gap-2'>
                                                    <h3 className='m-0 font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                                        {group.title}
                                                    </h3>
                                                    <ul className='m-0 list-disc pl-5 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                                        {group.items.map(
                                                            (item, i) => (
                                                                <li
                                                                    key={`${group.title}-${i}`}>
                                                                    {item}
                                                                </li>
                                                            )
                                                        )}
                                                    </ul>
                                                </Reveal>
                                            ))}
                                        </div>
                                    </TourSection>

                                    <div className='h-px w-full bg-it-heading/10' />
                                </>
                            )}

                            <TourSection
                                id='tour-cancellation'
                                title={tourDict.sections.cancellation}>
                                <div className='flex flex-col gap-4'>
                                    <div className='flex flex-col gap-2'>
                                        <h3 className='m-0 font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                            {cancelDict.title}
                                        </h3>
                                        <p className='m-0 whitespace-pre-line text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                            {cancellationBody}
                                        </p>
                                    </div>
                                    {detail.operatorName && (
                                        <span className='self-end font-medium text-[16px] leading-[1.6] tracking-[-0.012em]'>
                                            <span className='text-it-text-muted'>
                                                {cancelDict.suppliedBy}
                                            </span>{' '}
                                            <span className='text-it-heading'>
                                                {detail.operatorName}
                                            </span>
                                        </span>
                                    )}
                                </div>
                            </TourSection>

                            <div className='h-px w-full bg-it-heading/10' />

                            {/* Full reviews section - streams from the reviews
                                fetch; aggregate + histogram come from the tour. */}
                            <Suspense
                                fallback={
                                    <TourReviewsSectionSkeleton
                                        count={Math.min(10, ownReviewCount)}
                                    />
                                }>
                                <TourReviewsBlock
                                    tourId={detail.id}
                                    locale={locale}
                                    rating={rating ?? 0}
                                    reviewCount={reviewCount}
                                    ownReviewCount={ownReviewCount}
                                    histogram={reviewHistogram}
                                    hostLabel={reviewHostLabel}
                                    dict={{
                                        title: tourDict.sections.reviews,
                                        ...tourDict.reviewsSection,
                                    }}
                                />
                            </Suspense>
                        </div>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}

