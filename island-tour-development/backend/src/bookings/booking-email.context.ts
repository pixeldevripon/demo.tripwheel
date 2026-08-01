import { Locale, OnArrivalPayment, PaymentModel } from '@prisma/client';
import type { Currency } from '@prisma/client';
import { buildWhatsappUrl } from '@/common/utils/whatsapp.util';
import { emailSafeLogoUrl } from '@/mail/email-logo.util';
import type { EmailTemplateContext } from '@/mail/templates/email-template.renderer';

/**
 * Builds the token context for the LOCKED confirmation-email template
 * (`mail/templates/booking-confirmation-email.template.html`).
 *
 * Deliberately a PURE function over already-loaded rows: every rule the wireframe
 * and the master pin down (24-hour times, locale money/dates, the pickup-vs-meeting
 * -point branch, the payment-model variants) is then unit-testable without a
 * database. `BookingsService.loadConfirmationEmailData` does the I/O.
 *
 * The template is design-owned and its token list is the contract - a token this
 * builder forgets is caught by `findUnresolvedTokens` in the template spec, not by
 * a traveler reading a literal `{whatToBring}`.
 */

// ── Formatting rules (wireframe build notes + master) ────────────────────────

/**
 * BCP-47 tag per platform locale, for `Intl` money/date formatting.
 *
 * `en` maps to en-GB, not en-US: the wireframe renders "22 May 2026", and master
 * 8.3 records that the tracking spec's "en-US-only dates" were superseded by the
 * seven-locale scope. A US reader seeing day-month is a non-issue; a Curacao/EU
 * traveler seeing "May 22" against every other surface is a real one.
 */
const INTL_LOCALE: Record<Locale, string> = {
  en: 'en-GB',
  nl: 'nl-NL',
  de: 'de-DE',
  fr: 'fr-FR',
  es: 'es-ES',
  pt: 'pt-PT',
  zh: 'zh-CN',
};

/**
 * Local wall-clock instants are stored `Z`-labelled (see `timezone.util.ts`), so
 * every `Intl` call MUST format in UTC to read the wall clock back. Formatting in
 * the server's zone would silently shift a traveler's tour date by a day.
 */
const WALL_CLOCK_ZONE = 'UTC';

function intlLocale(locale: Locale | null | undefined): string {
  return INTL_LOCALE[locale ?? Locale.en] ?? INTL_LOCALE.en;
}

const LOCALES = new Set<string>(Object.values(Locale));

/**
 * `Booking.customerLocale` is a free-form `String?` column, not the `Locale` enum, so
 * it can hold anything a client sent ("en-US", "", junk). Coerce to a real platform
 * locale, defaulting to English - master's fallback for every content read.
 */
export function toLocale(value: string | null | undefined): Locale {
  const base = (value ?? '').toLowerCase().split(/[-_]/)[0];
  return LOCALES.has(base) ? (base as Locale) : Locale.en;
}

/**
 * "Friday, 22 May 2026" - exported for the notice emails (cancellation ack,
 * operator notices), which share the shell and must format dates identically.
 */
export function formatDateLong(date: Date, locale: Locale | null): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: WALL_CLOCK_ZONE,
  }).format(date);
}

/** "22 May 2026" - the subject line. */
function formatDateShort(date: Date, locale: Locale | null): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: WALL_CLOCK_ZONE,
  }).format(date);
}

/**
 * "Wed, 20 May 2026, 08:00" - the cancellation/balance deadline, exactly as the
 * wireframe locks it: SHORT weekday, and a comma before the time.
 *
 * Date and time are formatted separately and joined, because `Intl` with both
 * renders a connector ("Wed, 20 May 2026 at 08:00" in en-GB, and a locale-specific
 * one elsewhere) that the design does not use.
 *
 * The time part is 24-hour ACROSS ALL LOCALES per the wireframe build note, hence
 * the explicit `hourCycle: 'h23'` - en-GB and zh-CN both default to 12-hour
 * ("8:00 am" / "上午8:00"). The thank-you page renders 12-hour on purpose; the
 * email rule genuinely differs.
 */
function formatDeadline(date: Date, locale: Locale | null): string {
  const day = new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: WALL_CLOCK_ZONE,
  }).format(date);
  const time = new Intl.DateTimeFormat(intlLocale(locale), {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: WALL_CLOCK_ZONE,
  }).format(date);
  return `${day}, ${time}`;
}

/**
 * ISO 639-1 codes ("en", "es", "nl") rendered as names in the reader's language
 * ("English, Spanish, Dutch"). `TourLanguage.language` stores codes; emailing them
 * raw is a bug the design caught ("Language: en, es, nl").
 *
 * These are the languages the TOUR is run in. The row is labelled "Guided in:"
 * rather than the wireframe's "Language:" because that label was ambiguous the
 * moment a tour had more than one (founder, 2026-08-01: "showing language, does
 * this have any meaning?") - it read as the language of the email or of the
 * booking. "Guided in" says whose language it is and stays grammatical for any
 * number of them.
 */
function formatLanguages(
  codes: readonly string[],
  locale: Locale | null,
): string {
  if (!codes.length) return '';
  const names = new Intl.DisplayNames([intlLocale(locale)], {
    type: 'language',
    fallback: 'code',
  });
  const list = codes.map((code) => {
    const name = names.of(code) ?? code;
    // Intl leaves an unknown code lowercase; a bare code looks like a bug either
    // way, so at least present it consistently.
    return name === code ? code.toUpperCase() : capitalize(name);
  });
  return list.join(', ');
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * "island.tours/bookings" - the human label the design shows for a link whose href
 * is the full URL. Emailing "http://localhost:3000/bookings" (or any raw scheme)
 * is what the design review caught.
 */
function urlLabel(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/**
 * Money in the CHARGED currency, formatted for the reader's locale.
 *
 * The currency is always the booking's own (what Stripe actually took), never the
 * locale's default: the wireframe's "USD for EN/ZH, EUR for NL/DE/FR/ES/PT" note
 * describes which currency a shopper is *quoted*, and re-deriving it here would
 * relabel a real charge - a $220 booking reading "220 EUR".
 */
function formatMoney(
  amount: string,
  currency: Currency,
  locale: Locale | null,
): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${currency} ${amount}`;
  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'currency',
    currency,
    // `narrowSymbol` is required, not cosmetic: en-GB renders USD as "US$220.00"
    // by default, while the wireframe locks "$60.00" / "from $45". This keeps the
    // symbol the design asked for without giving up locale number formatting
    // (nl-NL still reads "€ 220,00").
    currencyDisplay: 'narrowSymbol',
  }).format(value);
}

/**
 * Trim + drop blanks. Returned as a LIST, not a joined line: the wireframe renders
 * each bullet as its own row with an orange marker, which the template does with
 * `[EACH]`. (An earlier version joined these with a middot into one line - visibly
 * wrong against the design.)
 */
function bullets(items: readonly string[]): string[] {
  return items.map((i) => i.trim()).filter(Boolean);
}

/** "2 adults, 1 child" - already-pluralised party lines from the caller. */
function joinParty(lines: readonly string[]): string {
  return lines.filter(Boolean).join(', ');
}

/**
 * A Google Maps link for an arbitrary place. Coordinates win when present (an
 * operator's free-text address is frequently ambiguous across islands); the
 * address string is the fallback.
 */
function mapsUrl(
  lat: number | null | undefined,
  lng: number | null | undefined,
  address: string | null | undefined,
): string {
  const query =
    lat != null && lng != null ? `${lat},${lng}` : (address ?? '').trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Template conditions match lowercase snake_case; the Prisma enums are upper. */
function paymentModelToken(model: PaymentModel): string {
  return model.toLowerCase();
}

function onArrivalToken(value: OnArrivalPayment | null): string {
  return value ? value.toLowerCase() : '';
}

// ── Input contract ───────────────────────────────────────────────────────────

export type RelatedTourInput = {
  name: string;
  slug: string;
  imageUrl: string | null;
  aggregateRating: number | null;
  priceFrom: string | null;
  currency: Currency;
};

/**
 * One recommendation featured in the confirmation email (the admin-managed
 * post-booking promo, placed on the CONFIRMATION_EMAIL surface). The caller passes
 * an array (up to a few); an empty array hides the whole block. `linkUrl` is
 * absolute for an EXTERNAL pick and a site-relative path for an INTERNAL one - the
 * builder absolutizes the latter with `frontendUrl`.
 */
export type RecommendationInput = {
  title: string;
  imageUrl: string;
  linkUrl: string;
  external: boolean;
  ctaLabel: string | null;
  rating: number | null;
  priceAmount: number | null;
  currency: Currency;
};

export type ConfirmationEmailInput = {
  booking: {
    displayRef: string;
    publicRef: string;
    island: string;
    currency: Currency;
    customerLocale: Locale | null;
    contactFirstName: string | null;
    paymentModel: PaymentModel;
    onArrivalPayment: OnArrivalPayment | null;
    depositPct: string;
    depositAmount: string;
    balanceAmount: string;
    totalAmount: string;
    /** Local wall-clock start; null only for pre-snapshot bookings. */
    tourStartDateTime: Date | null;
    /** `@db.Date` fallback when the full start instant is missing. */
    localDate: Date;
    startTime: string | null;
    pickupRequested: boolean;
    pickupAddress: string | null;
    pickupMinutesPrior: number | null;
    pickupWindowStart: string | null;
    pickupWindowEnd: string | null;
    notes: string | null;
    /** Free-cancellation deadline (local wall clock), computed by the caller. */
    cancelDeadline: Date | null;
    partyLines: readonly string[];
  };
  tour: {
    name: string;
    slug: string;
    heroImageUrl: string | null;
    durationLabel: string | null;
    /** ISO 639-1 codes; rendered as names in the reader's language. */
    languageCodes: readonly string[];
    checkInMinutesBefore: number | null;
    meetingPoint: string | null;
    meetingPointLat: number | null;
    meetingPointLng: number | null;
    endPoint: string | null;
    whatToBring: readonly string[];
    knowBeforeYouGo: readonly string[];
    /** Per-tour note from the operator; empty hides the whole blue card. */
    operatorNote: string | null;
  };
  operator: {
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  site: {
    logoUrl: string | null;
    whatsappNumber: string | null;
    whatsappEnabled: boolean;
  };
  destination: {
    name: string;
    slug: string;
  };
  relatedTours: readonly RelatedTourInput[];
  /** The featured post-booking recommendations (up to a few); empty hides the block. */
  recommendations: readonly RecommendationInput[];
  config: {
    frontendUrl: string;
    /**
     * The BACKEND's public origin. The .ics link is served by the API, not the site,
     * so it cannot be built off `frontendUrl` - that would 404 in every inbox.
     */
    apiUrl: string;
    emailIconBase: string;
  };
};

// ── Builder ──────────────────────────────────────────────────────────────────

export function buildConfirmationEmailContext(
  input: ConfirmationEmailInput,
): EmailTemplateContext {
  const {
    booking,
    tour,
    operator,
    site,
    destination,
    relatedTours,
    recommendations,
    config,
  } = input;

  const locale = booking.customerLocale;
  const urlLocale = locale ?? Locale.en;
  const base = config.frontendUrl.replace(/\/$/, '');
  const money = (amount: string) =>
    formatMoney(amount, booking.currency, locale);

  const start = booking.tourStartDateTime ?? booking.localDate;

  // Pickup vs meeting point is the template's single biggest branch. `hasPickup`
  // requires a real ADDRESS, not just the flag: a booking that requested pickup but
  // snapshotted no address would otherwise render "Pickup: , 07:15".
  const hasPickup = booking.pickupRequested && !!booking.pickupAddress;

  const [one, two] = relatedTours;

  return {
    // Chrome + brand
    locale: urlLocale,
    emailIconBase: config.emailIconBase,
    siteLogoUrl: emailSafeLogoUrl(site.logoUrl) ?? '',

    // Headline + summary
    firstName: booking.contactFirstName ?? 'there',
    bookingRef: booking.displayRef,
    tourName: tour.name,
    operatorName: operator.name ?? 'your operator',
    featuredImageUrl: tour.heroImageUrl ?? '',
    dateLong: formatDateLong(start, locale),
    dateShort: formatDateShort(start, locale),
    startTime: booking.startTime ?? '',

    // Meeting / pickup
    hasPickup,
    pickupLocation: booking.pickupAddress ?? '',
    pickupTime: pickupTimeLabel(booking),
    meetingPoint: tour.meetingPoint ?? '',
    mapUrl: hasPickup
      ? mapsUrl(null, null, booking.pickupAddress)
      : mapsUrl(tour.meetingPointLat, tour.meetingPointLng, tour.meetingPoint),
    // "Be ready N minutes before pickup" vs "arrive N minutes early" read from
    // different fields (master C6 decision 2): the pickup point's own lead time,
    // else the tour's check-in buffer.
    arrivalBufferMin:
      (hasPickup ? booking.pickupMinutesPrior : tour.checkInMinutesBefore) ??
      15,
    endPoint: tour.endPoint ?? '',

    // Trip facts (each hides with its icon when empty)
    partyBreakdown: joinParty(booking.partyLines),
    duration: tour.durationLabel ?? '',
    tourLanguage: formatLanguages(tour.languageCodes, locale),
    specialRequests: booking.notes ?? '',
    operatorNote: tour.operatorNote ?? '',

    // Money
    paymentModel: paymentModelToken(booking.paymentModel),
    onArrivalPayment: onArrivalToken(booking.onArrivalPayment),
    depositPct: booking.depositPct,
    depositAmount: money(booking.depositAmount),
    balanceAmount: money(booking.balanceAmount),
    totalAmount: money(booking.totalAmount),
    cancelDeadlineDateTime: booking.cancelDeadline
      ? formatDeadline(booking.cancelDeadline, locale)
      : '',

    // Contact
    operatorPhone: operator.phone ?? '',
    operatorEmail: operator.email ?? '',
    whatsappUrl:
      buildWhatsappUrl(site.whatsappNumber, site.whatsappEnabled) ?? '',

    // Content - lists, so the template can render the wireframe's orange bullet
    // rows via [EACH] and hide the heading via [IF] when empty.
    whatToBring: bullets(tour.whatToBring),
    knowBeforeYouGo: bullets(tour.knowBeforeYouGo),

    // Links
    tourUrl: `${base}/${urlLocale}/${destination.slug}/${tour.slug}/`,
    calendarUrl: `${config.apiUrl.replace(/\/$/, '')}/api/v1/bookings/typ/${booking.publicRef}/calendar.ics`,
    // Master 6.4/C1: a TOKENIZED confirmation page, never a cancel-on-raw-click.
    cancelUrl: `${base}/cancel/${booking.publicRef}`,
    accountUrl: `${base}/bookings`,
    // The design shows the link's LABEL ("island.tours/bookings"), not the raw href.
    accountUrlLabel: urlLabel(`${base}/bookings`),
    allToursUrl: `${base}/${urlLocale}/${destination.slug}/tours/`,

    // "More {island} experiences"
    islandName: destination.name,
    relatedTourOneImageUrl: one?.imageUrl ?? '',
    relatedTourOneName: one?.name ?? '',
    relatedTourOneRating: ratingLabel(one),
    relatedTourOnePrice: priceLabel(one, locale),
    relatedTourTwoImageUrl: two?.imageUrl ?? '',
    relatedTourTwoName: two?.name ?? '',
    relatedTourTwoRating: ratingLabel(two),
    relatedTourTwoPrice: priceLabel(two, locale),

    // "You might also like" - up to three featured recommendations as fixed slots
    // (mirroring the relatedTour one/two pattern). An empty Name hides that slot's
    // block ([IF recommendationOneName] etc. in the template); an empty first slot
    // hides the whole section.
    ...recommendationSlot(
      'recommendationOne',
      recommendations[0],
      base,
      urlLocale,
      locale,
    ),
    ...recommendationSlot(
      'recommendationTwo',
      recommendations[1],
      base,
      urlLocale,
      locale,
    ),
    ...recommendationSlot(
      'recommendationThree',
      recommendations[2],
      base,
      urlLocale,
      locale,
    ),
  };
}

/**
 * The five tokens for one recommendation slot, all empty when the slot is unused so
 * the template's `[IF <prefix>Name]` hides it.
 */
function recommendationSlot(
  prefix: string,
  rec: RecommendationInput | undefined,
  base: string,
  urlLocale: Locale,
  locale: Locale | null,
): Record<string, string> {
  return {
    [`${prefix}Name`]: rec?.title ?? '',
    [`${prefix}ImageUrl`]: rec?.imageUrl ?? '',
    [`${prefix}Meta`]: rec ? recommendationMeta(rec, locale) : '',
    [`${prefix}CtaLabel`]: rec?.ctaLabel?.trim() || 'See more',
    [`${prefix}Url`]: rec ? recommendationUrl(rec, base, urlLocale) : '',
  };
}

/**
 * "4.8 · from $160" - the recommendation's meta line, each part optional. Money is
 * the recommendation's OWN currency (never converted), matching the card on the TYP.
 */
function recommendationMeta(
  rec: RecommendationInput,
  locale: Locale | null,
): string {
  const parts: string[] = [];
  if (rec.rating != null) parts.push(rec.rating.toFixed(1));
  if (rec.priceAmount != null) {
    parts.push(
      `from ${formatMoney(String(rec.priceAmount), rec.currency, locale)}`,
    );
  }
  return parts.join(' · ');
}

/**
 * The CTA href. EXTERNAL picks link off-site (absolute already); INTERNAL ones
 * carry a site-relative path (`/curacao/...`) that must be absolutized against the
 * public site and locale-prefixed, since an inbox has no site to resolve it.
 */
function recommendationUrl(
  rec: RecommendationInput,
  base: string,
  urlLocale: Locale,
): string {
  if (rec.external) return rec.linkUrl;
  const path = rec.linkUrl.startsWith('/') ? rec.linkUrl : `/${rec.linkUrl}`;
  return `${base}/${urlLocale}${path}`;
}

/**
 * "07:15" or the operator's window "07:45-08:15".
 *
 * Both come from the BOOKING's snapshot, never a live join: the traveler was told a
 * time, and a later edit to the pickup point must not rewrite it (guide §17).
 */
function pickupTimeLabel(booking: ConfirmationEmailInput['booking']): string {
  const { pickupWindowStart, pickupWindowEnd, pickupMinutesPrior, startTime } =
    booking;
  if (pickupWindowStart && pickupWindowEnd) {
    return `${pickupWindowStart}-${pickupWindowEnd}`;
  }
  if (pickupWindowStart) return pickupWindowStart;
  if (startTime && pickupMinutesPrior != null) {
    return subtractMinutes(startTime, pickupMinutesPrior);
  }
  return startTime ?? '';
}

/** "HH:MM" minus N minutes, wrapping safely within the day. */
function subtractMinutes(hhmm: string, minutes: number): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  const total = Number(m[1]) * 60 + Number(m[2]) - minutes;
  const wrapped = ((total % 1440) + 1440) % 1440;
  const h = String(Math.floor(wrapped / 60)).padStart(2, '0');
  const min = String(wrapped % 60).padStart(2, '0');
  return `${h}:${min}`;
}

/**
 * "4.8" - or empty when the tour has no rating yet.
 *
 * Never invents a number: LD11's cold-start rule is that a tour without enough
 * approved reviews shows no rating at all, and a fabricated "0" on a marketing
 * card would be worse than a blank one.
 */
function ratingLabel(tour: RelatedTourInput | undefined): string {
  if (!tour?.aggregateRating) return '';
  return tour.aggregateRating.toFixed(1);
}

/**
 * "$89" - the upsell card's price line, exactly as the wireframe shows it
 * ("4.9 · $89"): no "from" prefix, and whole amounts drop their zero cents.
 * Empty for an unpriced tour.
 */
function priceLabel(
  tour: RelatedTourInput | undefined,
  locale: Locale | null,
): string {
  if (!tour?.priceFrom) return '';
  // Strip ".00"/",00" only when the cents are zero; a real fraction stays.
  return formatMoney(tour.priceFrom, tour.currency, locale).replace(
    /([.,])00(?=\D|$)/,
    '',
  );
}

// ── Branded notice (shared shell) ────────────────────────────────────────────

/** Plain-text part of a `booking-notice.template.html` send. */
export function buildNoticeText(ctx: EmailTemplateContext): string {
  const get = (key: string): string => String(ctx[key] ?? '').trim();
  const paragraphs = Array.isArray(ctx.noticeParagraphs)
    ? ctx.noticeParagraphs
    : [];
  const lines: Array<string | null> = [
    get('noticeTitle'),
    `Booking reference: ${get('bookingRef')}`,
    '',
    get('tourName'),
    `${get('dateLong')}${get('startTime') ? ` at ${get('startTime')}` : ''}`,
    '',
    ...paragraphs,
    '',
    optional(get('ctaUrl'), (v) => `${get('ctaLabel')}: ${v}`),
    'Island Tours. Built by Islanders.',
  ];
  return lines.filter((line): line is string => line !== null).join('\n');
}

// ── Operator "Booking Received" notification (C7) ───────────────────────────

/**
 * Token context for `operator-booking-received.template.html`.
 *
 * Built ON TOP of the traveller context - the shared tokens (tour, dates, money,
 * pickup, payment model) must read identically in both emails, so deriving them
 * twice would be a divergence bug waiting to happen. The caller builds the
 * traveller context with `Locale.en` first: operators work in English (the
 * dashboard language), so their dates/amounts are English-formatted even when
 * the traveller booked in German.
 */
export function buildOperatorNotificationContext(
  travellerCtx: EmailTemplateContext,
  extras: {
    guestName: string | null;
    guestEmail: string | null;
    guestPhone: string | null;
    dashboardUrl: string;
  },
): EmailTemplateContext {
  return {
    ...travellerCtx,
    guestName: extras.guestName ?? 'A traveller',
    guestEmail: extras.guestEmail ?? '',
    guestPhone: extras.guestPhone ?? '',
    dashboardUrl: extras.dashboardUrl,
  };
}

/** "New booking IT-2026-04821: Klein Curacao Day Trip on 22 May 2026" */
export function buildOperatorNotificationSubject(
  ctx: EmailTemplateContext,
): string {
  return `New booking ${String(ctx.bookingRef)}: ${String(ctx.tourName)} on ${String(ctx.dateShort)}`;
}

/** Plain-text part of the operator notification (same rationale as the traveller one). */
export function buildOperatorNotificationText(
  ctx: EmailTemplateContext,
): string {
  const get = (key: string): string => String(ctx[key] ?? '').trim();
  const model = get('paymentModel');

  const action =
    model === 'operator_link'
      ? `Email ${get('guestName')} your secure payment link for the remaining ${get('balanceAmount')} before ${get('cancelDeadlineDateTime')} (Curacao time). An unpaid balance cancels the booking.`
      : model === 'on_arrival'
        ? `Collect the remaining ${get('balanceAmount')}${get('onArrivalPayment') === 'cash_only' ? ' in cash' : ''} when the traveller arrives.`
        : 'The tour is fully paid to Island Tours. Send the traveller your own confirmation and arrival details.';

  const where = ctx.hasPickup
    ? `Pickup requested: ${get('pickupLocation')}, ${get('pickupTime')}`
    : `No pickup - the traveller meets you at ${get('meetingPoint')}`;

  const lines: Array<string | null> = [
    'You have a new booking.',
    `Booking reference: ${get('bookingRef')}`,
    '',
    get('tourName'),
    `${get('dateLong')} at ${get('startTime')}`,
    `Guests: ${get('partyBreakdown')}`,
    where,
    `Lead traveller: ${get('guestName')} · ${get('guestEmail')}${get('guestPhone') ? ` · ${get('guestPhone')}` : ''}`,
    optional(get('specialRequests'), (v) => `Traveller's note: ${v}`),
    '',
    'PAYMENT',
    optional(
      get('depositAmount'),
      (v) => `Deposit paid to Island Tours (${get('depositPct')}%): ${v}`,
    ),
    optional(get('balanceAmount'), (v) => `Balance you collect: ${v}`),
    `Total: ${get('totalAmount')}`,
    action,
    '',
    `View the booking: ${get('dashboardUrl')}`,
    '',
    'Island Tours. Built by Islanders.',
    'This is a transactional booking notification.',
  ];
  return lines.filter((line): line is string => line !== null).join('\n');
}

// ── Subject ──────────────────────────────────────────────────────────────────

/**
 * Master (conflict log, June 11 2026): the locked subject gains a less-than-24-hours
 * variant, "You're booked for tomorrow: {tour}" (or "today"), which doubles as the
 * reminder for last-minute bookings - the pre-tour reminder fires at 24h before start
 * and deliberately skips them. Get this wrong and a same-day traveler gets no nudge.
 *
 * Both instants are LOCAL wall clock, so "today"/"tomorrow" mean the traveler's day.
 */
export function buildConfirmationEmailSubject(input: {
  tourName: string;
  dateShort: string;
  start: Date | null;
  localNow: Date;
}): string {
  const { tourName, dateShort, start, localNow } = input;
  if (start) {
    const hoursAway = (start.getTime() - localNow.getTime()) / 3_600_000;
    if (hoursAway < 24 && hoursAway >= 0) {
      const sameDay =
        start.toISOString().slice(0, 10) ===
        localNow.toISOString().slice(0, 10);
      return sameDay
        ? `You're booked today: ${tourName}`
        : `You're booked for tomorrow: ${tourName}`;
    }
  }
  return `You're booked: ${tourName} on ${dateShort}`;
}

// ── Plain-text alternative ───────────────────────────────────────────────────

/**
 * The `text/plain` part, built from the same context as the HTML.
 *
 * Not optional and not derivable by stripping tags: the template carries a `<style>`
 * block, so a naive strip would dump raw CSS into the body. A missing or junk text
 * part also costs real spam score, and deliverability is the actual lever on the C2
 * anti-phishing mitigation (wireframe build note).
 */
export function buildConfirmationEmailText(ctx: EmailTemplateContext): string {
  const get = (key: string): string => String(ctx[key] ?? '').trim();
  const model = get('paymentModel');

  const balanceLine =
    model === 'operator_link'
      ? `${get('operatorName')} will email you a secure link to pay the remaining ${get('balanceAmount')}. We will never ask for card details by reply, message, or phone.`
      : model === 'on_arrival'
        ? `You pay the remaining ${get('balanceAmount')} to ${get('operatorName')} on arrival${get('onArrivalPayment') === 'cash_only' ? ', in cash (no card, no ATM on site)' : ' (card or cash)'}.`
        : model === 'paid_in_full'
          ? 'Your tour is fully paid. No one should ask you for further payment.'
          : `${get('operatorName')} will email you a secure link to pay the full ${get('totalAmount')}.`;

  const where = ctx.hasPickup
    ? `Pickup: ${get('pickupLocation')}, ${get('pickupTime')}`
    : `Meeting point: ${get('meetingPoint')}`;

  // `null` = drop the line entirely; '' = a deliberate blank separator.
  const lines: Array<string | null> = [
    `You're booked, ${get('firstName')}.`,
    `Booking reference: ${get('bookingRef')}`,
    '',
    get('tourName'),
    get('operatorName'),
    `${get('dateLong')} at ${get('startTime')}`,
    '',
    where,
    optional(get('endPoint'), (v) => `Ends at: ${v}`),
    `Guests: ${get('partyBreakdown')}`,
    optional(get('duration'), (v) => `Duration: ${v}`),
    optional(get('tourLanguage'), (v) => `Guided in: ${v}`),
    '',
    'PAYMENT',
    optional(
      get('depositAmount'),
      (v) => `Deposit paid today (${get('depositPct')}%): ${v}`,
    ),
    optional(get('balanceAmount'), (v) => `Balance: ${v}`),
    `Total: ${get('totalAmount')}`,
    balanceLine,
    '',
    optional(
      get('cancelDeadlineDateTime'),
      (v) =>
        `Cancel for a full refund up to ${v} (Curacao time): ${get('cancelUrl')}`,
    ),
    `Questions about the day? ${get('operatorName')}: ${get('operatorPhone')} · ${get('operatorEmail')}`,
    optional(
      get('whatsappUrl'),
      (v) => `Questions about your booking? WhatsApp: ${v}`,
    ),
    `View your tour: ${get('tourUrl')}`,
    ...['recommendationOne', 'recommendationTwo', 'recommendationThree'].map(
      (p) => {
        const name = get(`${p}Name`);
        if (!name) return null;
        const meta = get(`${p}Meta`);
        return `You might also like: ${name}${meta ? ` (${meta})` : ''} - ${get(`${p}Url`)}`;
      },
    ),
    '',
    'Island Tours. Built by Islanders.',
    'This is a transactional booking email.',
  ];

  return lines.filter((line): line is string => line !== null).join('\n');
}

/** Render `line(value)` only when the token has a value; otherwise drop the line. */
function optional(
  value: string,
  line: (value: string) => string,
): string | null {
  return value ? line(value) : null;
}

// ── Party lines ──────────────────────────────────────────────────────────────

const IRREGULAR_PLURALS: Record<string, string> = {
  child: 'children',
  person: 'people',
  adult: 'adults',
  infant: 'infants',
  youth: 'youths',
  senior: 'seniors',
  guest: 'guests',
  traveler: 'travelers',
};

/**
 * "2 adults", "1 child" - the email renders the party itself, so it pluralises
 * server-side (the TYP does the same job in the browser).
 *
 * Age-band labels are OPERATOR free text, so this never blindly appends an "s":
 * a band already named "Adults" would otherwise read "2 adultss" - the exact bug
 * the thank-you page shipped.
 */
export function buildPartyLines(
  items: ReadonlyArray<{ ageBandId: string | null }>,
  bandLabels: ReadonlyMap<string, string>,
): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = item.ageBandId ?? '';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([key, quantity]) => {
    const label = key ? (bandLabels.get(key) ?? 'Traveler') : 'Guest';
    return `${quantity} ${pluralise(label.toLowerCase(), quantity)}`;
  });
}

function pluralise(base: string, quantity: number): string {
  if (quantity <= 1) return base;
  const irregular = IRREGULAR_PLURALS[base];
  if (irregular) return irregular;
  // Only a single bare word that is not already plural is safe to suffix.
  if (!/^[a-z]+$/.test(base) || base.endsWith('s')) return base;
  return `${base}s`;
}

// ── Misc labels ──────────────────────────────────────────────────────────────

/** "9 hours" / "90 minutes"; empty when the tour has no duration. */
export function durationLabel(minutes: number | null): string | null {
  if (!minutes || minutes <= 0) return null;
  if (minutes % 60 !== 0) return `${minutes} minutes`;
  const hours = minutes / 60;
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

/**
 * The traveler's locale row, falling back to English (master: every content read
 * falls back to `en` when a locale has no translation).
 */
export function preferLocale<T extends { locale: Locale }>(
  rows: readonly T[],
  locale: Locale,
): T | undefined {
  return (
    rows.find((r) => r.locale === locale) ??
    rows.find((r) => r.locale === Locale.en)
  );
}

/**
 * A tour location of the given type as a display string: localized title
 * first, street address as the fallback. ONE implementation for every surface
 * that names a place (confirmation email, traveller account list) - two
 * copies of this chain WILL drift and name two different meeting points.
 */
export function pickTourLocation(
  locations: readonly {
    types: string[];
    streetAddress: string | null;
    translations: readonly { locale: Locale; title: string | null }[];
  }[],
  type: string,
  locale: Locale,
): string | null {
  const loc = locations.find((l) => l.types.includes(type));
  if (!loc) return null;
  return preferLocale(loc.translations, locale)?.title ?? loc.streetAddress;
}

/**
 * The deposit percentage actually charged, derived from the money on the BOOKING
 * rather than read from `Tour.depositPct`.
 *
 * The tour's percentage is tier-driven and can change after booking; the snapshot
 * is what the traveler paid, so deriving keeps the email honest (rule #21).
 */
export function depositPctOf(deposit: string, total: string): string {
  const d = Number(deposit);
  const t = Number(total);
  if (!Number.isFinite(d) || !Number.isFinite(t) || t <= 0) return '0';
  return String(Math.round((d / t) * 100));
}

/**
 * Cloudinary delivery base for the email icons, matching `scripts/upload-email-icons.ts`
 * (`f_png` rasterizes the source SVGs - Gmail strips `<svg>` and Outlook never
 * supported it; `w_34` is the fixed 2x delivery width).
 */
export function emailIconBase(): string {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME ?? '';
  return `https://res.cloudinary.com/${cloud}/image/upload/f_png,w_34/islandtours/email/icons`;
}
