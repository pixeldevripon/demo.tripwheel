import { JsonLd } from '@/components/frontend/seo/json-ld';
import {
    TourRelatedSkeleton,
    TourReviewsPreviewSkeleton,
    TourReviewsSectionSkeleton,
} from '@/components/frontend/skeletons/tour-page-skeleton';
import { getDestinationCategories } from '@/lib/api/public/categories';
import { getMediaSeo, normalizeUrl } from '@/lib/api/public/media';
import { getTourReviewSummary } from '@/lib/api/public/reviews';
import { getTourBySlug } from '@/lib/api/public/tours';
import { type Locale } from '@/lib/constants/locales';
import { getServerCurrency } from '@/lib/currency/server';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import {
    buildBreadcrumbJsonLd,
    buildTouristTripJsonLd,
} from '@/lib/seo/jsonld';
import { getSiteUrl } from '@/lib/seo/site-url';
import { buildTourBookingData } from '@/lib/tours/booking';
import { formatDuration } from '@/lib/tours/listing';
import type { PublicTourExclusion } from '@/types/tour-detail';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { MountReveal } from '../mount-reveal';
import { Reveal } from '../reveal';
import {
    ToursBreadcrumb,
    type BreadcrumbAnchor,
} from '../tours/tours-breadcrumb';
import { TourBookingCard } from './tour-booking-card/tour-booking-card';
import { TourDetailTabs, type TourTab } from './tour-detail-tabs';
import { TourGallery } from './tour-gallery';
import { TourHeader } from './tour-header';
import { TourHeaderActions } from './tour-header-actions';
import { TourMeetingCard } from './tour-meeting-card';
import { TourRelatedTours } from './tour-related-tours';
import { TourReviewsBlock, TourReviewsPreview } from './tour-reviews-blocks';
import { TourSection } from './tour-section';

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
    // because it is keyed by the resolved tour id. `getSiteUrl` (cached) rides
    // along to absolutize the structured-data URLs.
    const [reviewSummary, siteUrl] = await Promise.all([
        getTourReviewSummary(detail.id),
        getSiteUrl(),
    ]);

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
    //
    // Alt text is resolved HERE rather than in the gallery: that component is a
    // client leaf and the media loader is server-only. Precedence is live media
    // library (localized) -> the TourImage snapshot (English, taken when the
    // image was picked, so it goes stale) -> the tour title.
    const galleryUrls =
        detail.images.length > 0
            ? detail.images.map(img => img.url)
            : FALLBACK_GALLERY_IMAGES;
    const galleryAlts = await getMediaSeo(galleryUrls, locale);
    const galleryImages = galleryUrls.map((url, i) => ({
        url,
        alt:
            galleryAlts.get(normalizeUrl(url))?.altText ||
            detail.images[i]?.altText ||
            title,
    }));

    // Quick-info badges under the gallery (design v2 .quickinfo, LD7: at most
    // three) - duration / pickup / crew languages, each a bordered card with a
    // peach icon tile, a bold line and a muted sub-line.
    const qiDict = tourDict.quickInfo;
    const durationLabel = formatDuration(
        detail.durationMinutesFrom,
        detail.durationMinutesTo,
        dict.search
    );
    const languageNames = new Intl.DisplayNames(locale, { type: 'language' });
    const quickInfo: { icon: string; title: string; sub: string }[] = [];
    if (durationLabel) {
        quickInfo.push({
            icon: '/icons/qi-clock.svg',
            title: durationLabel,
            sub: qiDict.durationSub,
        });
    }
    if (detail.pickupModel !== 'NONE') {
        quickInfo.push({
            icon: '/icons/qi-car.svg',
            title: dict.destination.listings.pickupAvailable,
            sub:
                detail.pickupModel === 'INCLUDED'
                    ? qiDict.pickupIncluded
                    : qiDict.pickupPaid,
        });
    }
    if (detail.languages.length > 0) {
        const names = detail.languages
            .map(code => {
                const name = languageNames.of(code.toLowerCase());
                if (!name) return code.toUpperCase();
                return name.charAt(0).toUpperCase() + name.slice(1);
            })
            .join(', ');
        quickInfo.push({
            icon: '/icons/qi-globe.svg',
            title: names,
            sub: qiDict.languagesSub,
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
            // .warnlist - the caution list carries amber bullets.
            warn: true,
        },
        {
            title: infoDict.knowBeforeYouGo,
            items: detail.translation?.knowBeforeYouGo ?? [],
            warn: false,
        },
        {
            title: infoDict.whatToBring,
            items: detail.translation?.whatToBring ?? [],
            warn: false,
        },
    ].filter(g => g.items.length > 0);

    // "Cancellation Policy" - templated from the tour's free-cancellation window
    // (`cancellationHours`, NOT NULL, enum-bound) + the supplying operator name.
    const cancelDict = tourDict.cancellation;
    const cancellationBody = cancelDict.body.replace(
        /\{hours\}/g,
        String(detail.cancellationHours)
    );
    // The locked policy copy renders as separate paragraphs in the .cancelbox;
    // the "Plans change. No problem." lead opens the first paragraph (mockup
    // renders them as one line).
    const cancellationParagraphs = cancellationBody
        .split(/\n+/)
        .map(para => para.trim())
        .filter(Boolean)
        .map((para, i) => (i === 0 ? `${cancelDict.title} ${para}` : para));

    // Reviews aggregate + histogram come off the tour payload (same source as the
    // header rating); the individual cards stream in a separate boundary from the
    // reviews list. A review's operator IS the tour's operator.
    const reviewHostLabel = detail.operatorName ?? '';
    // Straight from the summary (approved-only, already ordered [5*..1*]) rather
    // than from the tour row, so the chart cannot disagree with the number above it.
    const reviewHistogram = reviewSummary.distribution;
    // FE-7b: with no reviews AND no operator rating to borrow, the section
    // renders nothing at all. Computed here as well as inside the section so the
    // tab can be dropped in the same breath - a nav tab that scrolls to a
    // non-existent anchor is worse than no tab.
    const hasReviewsSection = !(
        reviewSummary.approvedCount === 0 && reviewSummary.source === 'none'
    );
    // FE-2 product facts. Prefers the converted display price so the marked-up
    // amount matches what the page shows in the shopper's currency.
    const reviewProduct = {
        name: title,
        description: detail.translation?.shortDescription ?? null,
        images: detail.images.map(img => img.url),
        // Relative: `metadataBase` is admin-configured and may be absent, and a
        // fabricated absolute URL is worse markup than none.
        url: null,
        price: detail.money?.priceFrom ?? detail.priceFrom,
        currency: detail.money?.currency ?? detail.defaultCurrency,
    };

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
        ...(hasReviewsSection
            ? [{ id: 'tour-reviews', label: tourDict.sections.reviews }]
            : []),
    ];

    // Structured data: the breadcrumb trail mirrors the visible crumb
    // (Home > Destination > [primary Category] > Tour), and the tour itself as a
    // TouristTrip. The review Product graph (price + aggregateRating) is emitted
    // separately inside TourReviewsBlock, so this stays lean to avoid a second
    // Offer/rating.
    const tourPath = `/${destinationSlug}/${slug}`;
    const breadcrumbTrail = [
        { name: destinationName, path: `/${destinationSlug}` },
        ...(anchor ? [{ name: anchor.label, path: anchor.href }] : []),
        { name: breadcrumbLabel, path: tourPath },
    ];
    const breadcrumbJsonLd = buildBreadcrumbJsonLd({
        siteUrl,
        locale,
        trail: breadcrumbTrail,
    });
    const touristTripJsonLd = buildTouristTripJsonLd({
        siteUrl,
        locale,
        path: tourPath,
        name: title,
        description: detail.translation?.shortDescription ?? null,
        images: detail.images.map(img => img.url).slice(0, 6),
        destinationName,
        providerName: detail.operatorName ?? null,
    });

    return (
        <>
            <JsonLd data={breadcrumbJsonLd} />
            <JsonLd data={touristTripJsonLd} />
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
                    title={title}
                    rating={rating}
                    reviewCount={reviewCount}
                    isLocalsFavourite={isLocalsFavourite}
                    locationLabel={locationLabel}
                    locale={locale}
                    dict={{ localsFavorite: tourDict.localsFavorite }}
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
                            {/* Deliberately NOT wrapped in <MountReveal>. The
                                gallery hero is this page's LCP element, and
                                Chrome times LCP at the element's FINAL rendered
                                state - so a 0.1s-delayed 0.6s opacity fade-in
                                pushed the LCP timestamp back by up to ~0.7s on
                                the most revenue-critical page on the site. The
                                siblings below still animate; the entrance reads
                                the same without the hero fading in. */}
                            <TourGallery
                                images={galleryImages}
                                title={title}
                                showAllPhotosLabel={tourDict.showAllPhotos}
                            />
                            {quickInfo.length > 0 && (
                                <div className='mt-[18px] flex flex-wrap gap-2 md:gap-3'>
                                    {quickInfo.map(qi => (
                                        <div
                                            key={qi.sub}
                                            className='flex items-center gap-[11px] rounded-it-md border border-it-divider bg-it-white px-3 py-[9px] md:px-4 md:py-[11px]'>
                                            <span className='grid size-[34px] shrink-0 place-items-center rounded-it-sm bg-it-peach'>
                                                <Image
                                                    src={qi.icon}
                                                    alt=''
                                                    width={24}
                                                    height={24}
                                                    className='size-[17px]'
                                                />
                                            </span>
                                            <span className='flex flex-col'>
                                                <b className='text-[13.5px] font-bold leading-[1.5] tracking-[-0.005em] text-it-ink'>
                                                    {qi.title}
                                                </b>
                                                <span className='text-[12px] leading-[1.5] text-it-text-muted'>
                                                    {qi.sub}
                                                </span>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Booking card - right rail, sticky across the whole page
                            scroll (spans both left-column rows). */}
                        {/* The viewport cap lives on the CARD, not here (see
                            tour-booking-card.tsx). Capping this rail instead
                            and flexing the card inside it looks tidier - the
                            notices then sit inside the cap too - but it makes
                            the card and the notices compete for the same
                            height: on a 720px screen the notices won, the card
                            was crushed past its own contents, and the CTA
                            printed straight over them. The notices are static
                            copy and come back into view when the sticky rail
                            releases at the end of the page; the card is the
                            thing that must always be whole. */}
                        <div className='lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-24'>
                            {/* Live tour pricing / party bands / start times.
                                Real availability (remaining spots, sold-out) still
                                lands with the availability wiring (checklist §4). */}
                            <MountReveal delay={0.15}>
                                {/* Save/Share (.wtools) live above the widget
                                    in the rail (GAP-18), not in the header. */}
                                <div className='mb-2.5'>
                                    <TourHeaderActions
                                        tourId={detail.id}
                                        title={title}
                                        dict={{
                                            save: tourDict.save,
                                            share: tourDict.share,
                                            linkCopied: tourDict.linkCopied,
                                        }}
                                    />
                                </div>
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
                            <div className='flex max-w-178.5 flex-col gap-[34px]'>
                                <TourSection
                                    id='tour-overview'
                                    title={tourDict.sections.overview}>
                                    {overviewParagraphs.length > 0 && (
                                        <div className='flex flex-col gap-4 text-[14.5px] leading-[1.68] text-it-ink'>
                                            {overviewParagraphs.map((p, i) => (
                                                <p key={i} className='m-0'>
                                                    {p}
                                                </p>
                                            ))}
                                        </div>
                                    )}
                                    {/* Merged highlights (.hl): two-column list
                                    with the orange bullet glyph. */}
                                    {highlights.length > 0 && (
                                        <div className='grid grid-cols-1 gap-x-[22px] gap-y-2 sm:grid-cols-2'>
                                            {highlights.map((h, i) => (
                                                <Reveal
                                                    key={i}
                                                    width='auto'
                                                    listItem
                                                    className='flex items-start gap-[9px] text-[14px] font-semibold leading-[1.6] text-it-ink'>
                                                    <span
                                                        aria-hidden='true'
                                                        className='font-medium text-it-primary'>
                                                        •
                                                    </span>
                                                    {h}
                                                </Reveal>
                                            ))}
                                        </div>
                                    )}
                                    {/* Local tip callout (Figma node): bold headline
                                    over a muted description. Renders when either
                                    line is present; each line only if it exists. */}
                                    {(localTipTitle || localTipBody) && (
                                        <div className='mt-1 flex items-start gap-[11px] rounded-it-md border border-it-peach-border bg-it-peach px-4 py-3.5 text-[13.5px] leading-[1.6]'>
                                            <Image
                                                src='/icons/tip-sun.svg'
                                                alt=''
                                                width={24}
                                                height={24}
                                                className='mt-0.5 size-5 shrink-0'
                                            />
                                            <div>
                                                {localTipTitle && (
                                                    <b className='mb-[3px] block text-[12px] font-bold uppercase tracking-[0.08em] text-it-primary-hover'>
                                                        {localTipTitle}
                                                    </b>
                                                )}
                                                {localTipBody && (
                                                    <span className='text-it-ink'>
                                                        {localTipBody}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </TourSection>

                                {(includedItems.length > 0 ||
                                    excludedItems.length > 0) && (
                                    <>
                                        <TourSection
                                            id='tour-included'
                                            title={tourDict.sections.included}>
                                            <div className='grid grid-cols-1 gap-x-6 gap-y-0 sm:grid-cols-2'>
                                                {includedItems.map(item => (
                                                    <Reveal
                                                        key={item.id}
                                                        width='auto'
                                                        listItem
                                                        className='flex items-start gap-[9px] py-[5px] text-[14px] leading-[1.6] text-it-ink'>
                                                        <Image
                                                            src='/icons/trust-check-green.svg'
                                                            alt=''
                                                            width={24}
                                                            height={24}
                                                            className='mt-[3px] size-[15px] shrink-0'
                                                        />
                                                        {item.label}
                                                    </Reveal>
                                                ))}
                                                {excludedItems.map(item => (
                                                    <Reveal
                                                        key={item.id}
                                                        width='auto'
                                                        listItem
                                                        className='flex items-start gap-[9px] py-[5px] text-[14px] leading-[1.6] text-it-text-muted'>
                                                        <Image
                                                            src='/icons/x-faint.svg'
                                                            alt=''
                                                            width={24}
                                                            height={24}
                                                            className='mt-[3px] size-[15px] shrink-0'
                                                        />
                                                        {item.label}
                                                    </Reveal>
                                                ))}
                                            </div>
                                        </TourSection>
                                    </>
                                )}

                                {(expectIntro || expectSteps.length > 0) && (
                                    <>
                                        <TourSection
                                            id='tour-expect'
                                            title={tourDict.sections.expect}>
                                            {expectIntro && (
                                                <p className='m-0 max-w-172 text-[14.5px] leading-[1.68] text-it-text-muted'>
                                                    {expectIntro}
                                                </p>
                                            )}
                                            {/* Numbered timeline - orange step badges
                                            joined by a vertical connector. */}
                                            {expectSteps.length > 0 && (
                                                <ol className='m-0 flex list-none flex-col p-0'>
                                                    {expectSteps.map(
                                                        (step, i) => (
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
                                                                            className='absolute top-9 bottom-0 left-[15px] w-px -translate-x-1/2 bg-it-divider'
                                                                        />
                                                                    )}
                                                                    <span className='relative z-10 grid size-[30px] shrink-0 place-items-center rounded-it-full bg-it-primary-subtle text-[13px] font-medium text-it-primary-hover tabular-nums'>
                                                                        {i + 1}
                                                                    </span>
                                                                    <div className='flex flex-col gap-0.5'>
                                                                        <span className='text-[14.5px] font-bold leading-[1.6] text-it-ink'>
                                                                            {
                                                                                step.title
                                                                            }
                                                                        </span>
                                                                        {step.detail && (
                                                                            <span className='text-[13.5px] leading-[1.6] text-it-text-muted'>
                                                                                {
                                                                                    step.detail
                                                                                }
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </Reveal>
                                                            </li>
                                                        )
                                                    )}
                                                </ol>
                                            )}
                                        </TourSection>
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
                                    </>
                                )}

                                {infoGroups.length > 0 && (
                                    <>
                                        <TourSection
                                            id='tour-info'
                                            title={tourDict.sections.info}>
                                            <div className='flex flex-col gap-[18px]'>
                                                {infoGroups.map(group => (
                                                    <Reveal
                                                        key={group.title}
                                                        listItem
                                                        className='flex flex-col gap-1.5'>
                                                        <h3 className='m-0 text-[15px] font-bold leading-[1.6] text-it-ink'>
                                                            {group.title}
                                                        </h3>
                                                        <ul className='m-0 mt-1 list-none p-0'>
                                                            {group.items.map(
                                                                (item, i) => (
                                                                    <li
                                                                        key={`${group.title}-${i}`}
                                                                        className='relative py-[5px] pl-[22px] text-[14px] leading-[1.6] text-it-ink'>
                                                                        <span
                                                                            aria-hidden='true'
                                                                            className={`absolute top-[13px] left-1 size-[5px] rounded-it-full ${group.warn ? 'bg-it-star' : 'bg-it-ink-muted'}`}
                                                                        />
                                                                        {item}
                                                                    </li>
                                                                )
                                                            )}
                                                        </ul>
                                                    </Reveal>
                                                ))}
                                            </div>
                                        </TourSection>
                                    </>
                                )}

                                <TourSection
                                    id='tour-cancellation'
                                    title={tourDict.sections.cancellation}>
                                    <div className='flex flex-col gap-2.5 rounded-it-md border border-it-divider bg-it-white px-5 py-[18px]'>
                                        {cancellationParagraphs.map(
                                            (para, i) => (
                                                <p
                                                    key={i}
                                                    className='m-0 text-[14.5px] leading-[1.68] text-it-ink'>
                                                    {para}
                                                </p>
                                            )
                                        )}
                                    </div>
                                </TourSection>

                                {/* Full reviews section - streams from the reviews
                                fetch; aggregate + histogram come from the tour.
                                Both the divider and the block are dropped when
                                there is nothing to show (FE-7b), so the page does
                                not end on a hairline under the last section. */}
                                {hasReviewsSection && (
                                    <>
                                        <Suspense
                                            fallback={
                                                <TourReviewsSectionSkeleton
                                                    count={Math.min(
                                                        10,
                                                        ownReviewCount
                                                    )}
                                                />
                                            }>
                                            <TourReviewsBlock
                                                tourId={detail.id}
                                                locale={locale}
                                                rating={rating ?? 0}
                                                reviewCount={reviewCount}
                                                ownReviewCount={ownReviewCount}
                                                ratingSource={
                                                    reviewSummary.source
                                                }
                                                operatorName={reviewHostLabel}
                                                histogram={reviewHistogram}
                                                themes={reviewSummary.themes}
                                                guestTypes={
                                                    reviewSummary.guestTypes
                                                }
                                                languages={
                                                    reviewSummary.languages
                                                }
                                                photoCount={
                                                    reviewSummary.photoCount
                                                }
                                                hostLabel={reviewHostLabel}
                                                explainerHref={`/${locale}/reviews-policy`}
                                                product={reviewProduct}
                                                dict={{
                                                    title: tourDict.sections
                                                        .reviews,
                                                    ...tourDict.reviewsSection,
                                                }}
                                            />
                                        </Suspense>
                                    </>
                                )}

                                {/* LD14 supplied-by tail line. */}
                                {detail.operatorName && (
                                    <p className='m-0 text-[12.5px] leading-[1.6] text-it-ink-muted'>
                                        {cancelDict.suppliedBy}{' '}
                                        {detail.operatorName}
                                    </p>
                                )}
                            </div>

                            {/* Related tours (LD33) - INSIDE the detail column so
                            the grids keep the content width, and the sticky
                            rail (row-span-2) keeps sticking past them until
                            the section ends at the footer. Own boundary: it
                            fetches the destination listings and must not hold
                            the sections above hostage. */}
                            <Suspense fallback={<TourRelatedSkeleton />}>
                                <TourRelatedTours
                                    destinationSlug={destinationSlug}
                                    slug={slug}
                                    destinationName={destinationName}
                                    locale={locale}
                                    dict={dict}
                                />
                            </Suspense>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}

