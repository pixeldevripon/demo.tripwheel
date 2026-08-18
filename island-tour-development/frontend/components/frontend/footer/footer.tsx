import { MotionSpan } from '@/components/frontend/motion-primitives';
import { Reveal } from '@/components/frontend/reveal';
import { getDestinationCategories } from '@/lib/api/public/categories';
import { getDestinationHubs } from '@/lib/api/public/hubs';
import {
    getPublicCompanyInfo,
    getPublicSiteInfo,
    getPublicSocialMedia,
} from '@/lib/api/public/settings';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import { buildWhatsappUrl } from '@/lib/whatsapp';
import { springPop } from '@/lib/motion';
import Image from 'next/image';
import Link from 'next/link';
import { CurrentYear } from './current-year';
import { CurrencySelector, LanguageSelector } from './footer-selectors';

type FooterDict = {
    tagline: string;
    ourStory: string;
    explore: string;
    support: string;
    workWithUs: string;
    legal: string;
    language: string;
    currency: string;
    links: {
        boatTours: string;
        trackBooking: string;
        help: string;
        contact: string;
        listTour: string;
        affiliate: string;
        privacy: string;
        cookies: string;
        terms: string;
        cancellation: string;
        legalNotice: string;
    };
    copyright: string;
    registration: string;
    manageCookies: string;
};

// Explore column anchors - the launch destination plus two always-present
// entities (a category and a hub). Up to 2 extra links (5 max) are
// data-driven: the most popular remaining categories/hubs, gated to at least
// EXPLORE_TOUR_GATE published tours ("more than 4") so a thin page never
// earns a sitewide footer link.
const EXPLORE_DESTINATION = { label: 'Curaçao', slug: 'curacao' };
const PINNED_CATEGORY_SLUG = 'boat-tours';
const PINNED_HUB_SLUG = 'klein-curacao';
const EXPLORE_TOUR_GATE = 5; // published tours required to earn a dynamic slot

// Social ring icons - each SVG bakes in the grey-ringed circle + white glyph.
// Only networks with a dashboard-managed URL render; Twitter/LinkedIn exist in
// settings but have no ring assets yet, so they stay unused here.
const SOCIAL_ICONS = {
    instagram: { src: '/footer/social/social-1.svg', alt: 'Instagram' },
    facebook: { src: '/footer/social/social-2.svg', alt: 'Facebook' },
    youtube: { src: '/footer/social/social-3.svg', alt: 'YouTube' },
    tiktok: { src: '/footer/social/social-4.svg', alt: 'TikTok' },
} as const;

// Payment marks - white Figma glyphs. `cls` carries the exact mobile + desktop
// box from Figma (mobile renders ~1.6× larger than desktop).
const paymentsRow1 = [
    {
        src: '/footer/payment/pay-1.svg',
        alt: 'Visa',
        w: 55,
        h: 20,
        cls: 'h-4 w-[44px] lg:h-3 lg:w-[34px]',
    },
    {
        src: '/footer/payment/pay-2.svg',
        alt: 'Mastercard',
        w: 38,
        h: 23,
        cls: 'h-[18px] w-[30px] lg:h-3.5 lg:w-[23px]',
    },
    {
        src: '/footer/payment/pay-3.svg',
        alt: 'PayPal',
        w: 43,
        h: 41,
        cls: 'h-8 w-[34px] lg:h-[25px] lg:w-[26px]',
    },
    {
        src: '/footer/payment/pay-4.svg',
        alt: 'iDEAL',
        w: 41,
        h: 38,
        cls: 'h-[30px] w-8 lg:h-[25px] lg:w-[25px]',
    },
];
const paymentsRow2 = [
    {
        src: '/footer/payment/pay-5.svg',
        alt: 'Apple Pay',
        w: 51,
        h: 23,
        cls: 'h-[18px] w-10 lg:h-3.5 lg:w-[31px]',
    },
    {
        src: '/footer/payment/pay-6.svg',
        alt: 'Google Pay',
        w: 68,
        h: 26,
        cls: 'h-5 w-[53px] lg:h-4 lg:w-[41px]',
    },
    {
        src: '/footer/payment/pay-7.svg',
        alt: 'Klarna',
        w: 56,
        h: 18,
        cls: 'h-3.5 w-[44px] lg:h-[11px] lg:w-[35px]',
    },
    {
        src: '/footer/payment/pay-8.svg',
        alt: 'American Express',
        w: 58,
        h: 21,
        cls: 'h-4 w-[45px] lg:h-[13px] lg:w-[35px]',
    },
];

/**
 * A single link column (heading + list). Links without an `href` are pages
 * that do not exist yet - they render as plain text (same look, no hover, no
 * navigation) so nothing in the footer can land on a 404.
 */
function LinkColumn({
    locale,
    title,
    links,
    className,
}: {
    locale: Locale;
    title: string;
    /** `href` = internal (localized); `external` = full URL (wa.me etc.). */
    links: { label: string; href?: string; external?: string }[];
    className?: string;
}) {
    const linkCls =
        'inline-block text-sm lg:text-base leading-[1.6] text-it-footer-muted hover:text-it-white no-underline transition-colors duration-300 tracking-[-0.012em]';
    return (
        <div className={`flex flex-col gap-3.5 ${className ?? ''}`}>
            <h3 className='m-0 text-lg lg:text-xl font-medium leading-[1.6] text-it-white tracking-[-0.012em]'>
                {title}
            </h3>
            <ul className='m-0 flex list-none flex-col gap-2.5 p-0'>
                {links.map(link => (
                    <li key={link.label}>
                        {link.href ? (
                            <Link
                                href={localizeHref(locale, link.href)}
                                className={linkCls}>
                                {link.label}
                            </Link>
                        ) : link.external ? (
                            <a
                                href={link.external}
                                target='_blank'
                                rel='noopener noreferrer'
                                className={linkCls}>
                                {link.label}
                            </a>
                        ) : (
                            <span className='inline-block cursor-default text-sm lg:text-base leading-[1.6] text-it-footer-muted tracking-[-0.012em]'>
                                {link.label}
                            </span>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}

/**
 * One payment-mark row - four marks, 4x2 overall.
 *
 * FOUR EQUAL COLUMNS at every width, which is what makes the mobile block read
 * like the desktop one. Both rows use the same track count and the same
 * container width, so the eight marks line up in four columns rather than two
 * independently-packed rows.
 *
 * This has now been through both failure modes, so read before changing:
 *
 * - `justify-between` at every width stretched four marks edge to edge of a
 *   phone-wide column and read as scattered logos, not one payment group
 *   (client, 2026-08-05).
 * - Packing them left with a fixed 12px flex gap fixed the spread but bunched
 *   them into the left edge, where they read as cropped (client, 2026-08-06).
 *
 * A capped-width grid is the thing that is neither: `max-w-64` (256px) keeps
 * the block off the full phone width, and equal `1fr` tracks give even spacing
 * inside it. Marks are LEFT-aligned in their track, not centred, so the first
 * one stays flush with the language pill and the Stripe badge - centring
 * indented it away from that edge.
 *
 * ## Why 256px and not less
 *
 * The tracks are sized by the container, not the content, so the visible gap
 * between two marks is `track - glyph` and therefore varies: the WIDEST glyph
 * gets the TIGHTEST gap. Google Pay is 53px, so a 64px track leaves it 11px
 * while Mastercard (30px) gets 34px.
 *
 * That makes 53px a hard floor on the track. 240px was tried and rejected -
 * 60px tracks left Google Pay and Klarna 7px apart, close enough to read as
 * touching. Anything below ~64px tracks trades the "gaps are too wide"
 * complaint for a collision.
 *
 * Do NOT "even out" the gaps by sizing tracks to content: that is the flex
 * behaviour that produced the left-bunching above, and it also breaks the
 * column alignment between the two rows.
 *
 * DESKTOP is unchanged: the column is only ~221px, so the same four tracks
 * fill it exactly as `justify-between` did, under the pills with no ragged
 * right edge.
 */
function PaymentRow({ items }: { items: typeof paymentsRow1 }) {
    return (
        <div className='grid w-full max-w-64 grid-cols-4 items-center justify-items-start lg:max-w-none'>
            {items.map(p => (
                <Image
                    key={p.alt}
                    src={p.src}
                    alt={p.alt}
                    width={p.w}
                    height={p.h}
                    className={`${p.cls} object-contain`}
                />
            ))}
        </div>
    );
}

export async function Footer({
    locale,
    dict,
}: {
    locale: Locale;
    dict: FooterDict;
}) {
    // Dashboard-managed settings (Settings > Social Media / Company). Cached
    // under the `site-info` tag, so an admin save shows up without a redeploy.
    // Categories/hubs feed the dynamic Explore column (both tour-gated + cached).
    const [social, company, categories, hubs, siteInfo] = await Promise.all([
        getPublicSocialMedia(),
        getPublicCompanyInfo(),
        getDestinationCategories(EXPLORE_DESTINATION.slug, locale),
        getDestinationHubs(EXPLORE_DESTINATION.slug, locale),
        getPublicSiteInfo(),
    ]);
    // Help/contact route to WhatsApp for now (founder 2026-07-31) - the same
    // dashboard-managed number as every other support entry point. When the
    // chat is disabled they fall back to the deactivated plain-text state.
    const whatsappHref = buildWhatsappUrl(
        siteInfo.whatsappNumber,
        siteInfo.enableWhatsappChat
    );

    const socials = [
        { ...SOCIAL_ICONS.instagram, href: social.instagramUrl },
        { ...SOCIAL_ICONS.facebook, href: social.facebookUrl },
        { ...SOCIAL_ICONS.youtube, href: social.youtubeUrl },
        { ...SOCIAL_ICONS.tiktok, href: social.tiktokUrl },
    ].filter((s): s is typeof s & { href: string } => !!s.href);

    // The year renders via a client leaf: Server Components may not read the
    // current time during prerender (next-prerender-current-time).
    const copyrightLine = company.companyName ? (
        <>
            © <CurrentYear /> ITG B.V. (Island Tours Group)
        </>
    ) : (
        dict.copyright
    );
    const registrationLine = company.companyVat
        ? company.companyVat
        : dict.registration;

    // Explore column: 3 pinned anchors + up to 2 data-driven picks (5 links
    // max). Pinned labels come from the localized API rows when available
    // (dict/proper-noun fallback keeps them rendered even if the backend is
    // unreachable). Category and hub pages share the flat
    // `/{destination}/{slug}` URL, so both map the same way.
    const pinnedCategory = categories.find(
        c => c.slug === PINNED_CATEGORY_SLUG,
    );
    const pinnedHub = hubs.find(h => h.slug === PINNED_HUB_SLUG);
    // Most popular remaining categories/hubs - popularity proxy is the
    // published tour count, gated so only substantial pages win a slot.
    const topPicks = [
        ...categories.filter(c => c.slug !== PINNED_CATEGORY_SLUG),
        ...hubs.filter(h => h.slug !== PINNED_HUB_SLUG),
    ]
        .filter(e => e.publishedTourCount >= EXPLORE_TOUR_GATE)
        .sort((a, b) => b.publishedTourCount - a.publishedTourCount)
        .slice(0, 2);

    const destinationBase = `/${EXPLORE_DESTINATION.slug}`;
    const exploreLinks = [
        { label: EXPLORE_DESTINATION.label, href: destinationBase },
        {
            label: pinnedCategory?.name ?? dict.links.boatTours,
            href: `${destinationBase}/${PINNED_CATEGORY_SLUG}`,
        },
        ...topPicks.map(pick => ({
            label: pick.name,
            href: `${destinationBase}/${pick.slug}`,
        })),
        {
            label: pinnedHub?.name ?? 'Klein Curaçao',
            href: `${destinationBase}/${PINNED_HUB_SLUG}`,
        },
    ];
    // "Track your booking" is the `/bookings` reference lookup. It lives here
    // rather than in the account menu because the people who need it are the ones
    // who have a confirmation email and no account - and that menu only opens
    // once you are signed in, where the account area already lists every
    // booking. The footer is on every page, signed in or not.
    //
    // Help/contact/list-your-tour/affiliate pages don't exist yet - no href
    // deactivates them (plain text, no 404) until those pages are built.
    const supportLinks = [
        { label: dict.links.trackBooking, href: '/bookings' },
        { label: dict.links.help, ...(whatsappHref && { external: whatsappHref }) },
        { label: dict.links.contact, ...(whatsappHref && { external: whatsappHref }) },
    ];
    const workLinks = [
        { label: dict.links.listTour },
        { label: dict.links.affiliate },
    ];
    // Slugs from the legal handover README (public/Legal Pages): static
    // routes, English on every locale.
    const legalLinks = [
        { label: dict.links.privacy, href: '/privacy-policy' },
        { label: dict.links.cookies, href: '/cookie-policy' },
        { label: dict.links.terms, href: '/terms' },
        { label: dict.links.cancellation, href: '/cancellation-policy' },
        { label: dict.links.legalNotice, href: '/legal-notice' },
    ];

    return (
        <footer className='bg-it-dark text-it-white tracking-[-0.012em]'>
            <div className='it-container pt-12 pb-6 lg:pt-16 lg:pb-8'>
                <div className='flex flex-col gap-11'>
                    {/* ── Top section ──
                        Desktop uses justify-between (which naturally yields the ~110px
                        Figma gaps at 1440); only a small min-gap overrides the mobile
                        gap-16 so the row fits cleanly from 1024 up without shrinking.
                        Reveal = the sitewide scroll-in (footer is always below fold). */}
                    <Reveal className='flex flex-col gap-16 lg:flex-row lg:justify-between lg:gap-6'>
                        {/* Brand + Explore - paired on mobile, flattened into the row on desktop */}
                        <div className='grid grid-cols-2 gap-x-6 lg:contents'>
                            <div className='flex flex-col gap-6 lg:w-52.5 lg:gap-8'>
                                <div className='flex flex-col gap-4 lg:gap-6'>
                                    <Link
                                        href={localizeHref(locale, '/')}
                                        className='inline-flex'>
                                        <Image
                                            src='/logo/footer-logo.png'
                                            alt='Island Tours'
                                            width={176}
                                            height={131}
                                            className='h-14 w-auto object-contain lg:h-19'
                                        />
                                    </Link>
                                    <p className='m-0 text-sm lg:text-base leading-[1.6] text-it-footer-muted tracking-[-0.012em]'>
                                        {dict.tagline}
                                    </p>
                                </div>

                                <div className='flex flex-col gap-2 lg:gap-3'>
                                    {/* /about doesn't exist yet - plain text until it does. */}
                                    <span className='inline-block w-fit cursor-default text-sm lg:text-base leading-[1.6] text-it-white tracking-[-0.012em]'>
                                        {dict.ourStory}
                                    </span>
                                    {socials.length > 0 && (
                                        <div className='flex items-center gap-1.25 lg:gap-2'>
                                            {socials.map(s => (
                                                <a
                                                    key={s.alt}
                                                    href={s.href}
                                                    target='_blank'
                                                    rel='noopener noreferrer'
                                                    aria-label={s.alt}
                                                    className='inline-flex'>
                                                    <MotionSpan
                                                        className='inline-flex'
                                                        whileTap={{
                                                            scale: 0.9,
                                                        }}
                                                        transition={springPop}>
                                                        <Image
                                                            src={s.src}
                                                            alt={s.alt}
                                                            width={40}
                                                            height={40}
                                                            className='size-6 lg:size-8.5'
                                                        />
                                                    </MotionSpan>
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <LinkColumn
                                locale={locale}
                                title={dict.explore}
                                links={exploreLinks}
                                className='lg:whitespace-nowrap'
                            />
                        </div>

                        {/* Support + Work with us - same 2-col grid as Brand|Explore (so
                            "Work with us" lines up under "Explore"), stacked on desktop */}
                        <div className='grid grid-cols-2 gap-x-6 lg:flex lg:flex-col lg:justify-start lg:gap-9.5 lg:whitespace-nowrap'>
                            <LinkColumn
                                locale={locale}
                                title={dict.support}
                                links={supportLinks}
                            />
                            <LinkColumn
                                locale={locale}
                                title={dict.workWithUs}
                                links={workLinks}
                            />
                        </div>

                        <LinkColumn
                            locale={locale}
                            title={dict.legal}
                            links={legalLinks}
                            className='lg:whitespace-nowrap'
                        />

                        {/* Right column: selectors + payments. Full-width on phones, but
                            capped above 480px so the pills + justified payment row don't
                            stretch uglily across tablet widths. */}
                        <div className='flex w-full flex-col gap-8 min-[480px]:max-w-92.5 lg:w-55.25 lg:max-w-none lg:gap-12'>
                            <div className='flex flex-col gap-4'>
                                <LanguageSelector
                                    locale={locale}
                                    label={dict.language}
                                />
                                <CurrencySelector
                                    locale={locale}
                                    label={dict.currency}
                                />
                            </div>

                            <div className='flex flex-col gap-8 lg:gap-6'>
                                {/* Same gap down as across, so the eight marks
                                    read as one block rather than two bands. */}
                                <div className='flex flex-col gap-3 lg:gap-2.5'>
                                    <PaymentRow items={paymentsRow1} />
                                    <PaymentRow items={paymentsRow2} />
                                </div>

                                <Image
                                    src='/footer/stripe.svg'
                                    alt='Powered by Stripe'
                                    width={114}
                                    height={26}
                                    className='h-6.5 w-28.5'
                                />
                            </div>
                        </div>
                    </Reveal>

                    {/* ── Bottom bar ── */}
                    <Reveal delay={0.35} yOffset={20}>
                        <div className='h-px w-full bg-it-ink-on-dark/15' />
                        <div className='flex flex-col gap-2.5 pt-5 lg:flex-row lg:items-center lg:justify-between lg:gap-4'>
                            <div className='flex flex-wrap items-center gap-3 lg:gap-4'>
                                <span className='text-xs lg:text-base leading-[1.6] text-it-footer-muted tracking-[-0.012em]'>
                                    {copyrightLine}
                                </span>
                                <span className='size-1 shrink-0 rounded-full bg-it-soft-on-dark/60' />
                                <span className='text-xs lg:text-base leading-[1.6] text-it-footer-muted tracking-[-0.012em]'>
                                    {registrationLine}
                                </span>
                            </div>
                            {/* Cookie preferences live on /manage-cookies (the page's
                                button reopens the Cookiebot dialog once it ships). */}
                            <Link
                                href={localizeHref(locale, '/manage-cookies')}
                                className='w-fit text-sm lg:text-base leading-[1.6] text-it-footer-muted no-underline transition-colors hover:text-it-white tracking-[-0.012em]'>
                                {dict.manageCookies}
                            </Link>
                        </div>
                    </Reveal>
                </div>
            </div>
        </footer>
    );
}

