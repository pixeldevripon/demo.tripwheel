import { Locale, OnArrivalPayment, PaymentModel } from '@prisma/client';
import type { Currency } from '@prisma/client';
import { buildWhatsappUrl } from '@/common/utils/whatsapp.util';
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

/** "Friday, 22 May 2026" - the summary block's date line. */
function formatDateLong(date: Date, locale: Locale | null): string {
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
 * "Wednesday 20 May 2026, 08:00" - the cancellation/balance deadline.
 *
 * `hourCycle: 'h23'` is not decoration: the wireframe locks times to 24-hour
 * ACROSS ALL LOCALES, and en-GB/zh-CN would otherwise render "8:00 am"/"上午8:00".
 * (The thank-you page renders 12-hour on purpose - the email rule differs.)
 */
function formatDeadline(date: Date, locale: Locale | null): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: WALL_CLOCK_ZONE,
  }).format(date);
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
 * Bullet arrays ("what to bring", "good to know") as one plain-text line.
 *
 * The renderer HTML-escapes every value, so a `<ul>` here would email literal
 * `&lt;ul&gt;`. The template renders these into a single line by design; a middot
 * is the wireframe's own separator elsewhere.
 */
function joinBullets(items: readonly string[]): string {
  return items
    .map((i) => i.trim())
    .filter(Boolean)
    .join(' · ');
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
    languageLabel: string | null;
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
  const { booking, tour, operator, site, destination, relatedTours, config } =
    input;

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
    siteLogoUrl: site.logoUrl ?? '',

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
    tourLanguage: tour.languageLabel ?? '',
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

    // Content
    whatToBring: joinBullets(tour.whatToBring),
    knowBeforeYouGo: joinBullets(tour.knowBeforeYouGo),

    // Links
    tourUrl: `${base}/${urlLocale}/${destination.slug}/${tour.slug}/`,
    calendarUrl: `${config.apiUrl.replace(/\/$/, '')}/api/v1/bookings/typ/${booking.publicRef}/calendar.ics`,
    // Master 6.4/C1: a TOKENIZED confirmation page, never a cancel-on-raw-click.
    cancelUrl: `${base}/cancel/${booking.publicRef}`,
    accountUrl: `${base}/bookings`,
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
  };
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

/** "from $45" - master's price-from label; empty for an unpriced tour. */
function priceLabel(
  tour: RelatedTourInput | undefined,
  locale: Locale | null,
): string {
  if (!tour?.priceFrom) return '';
  return `from ${formatMoney(tour.priceFrom, tour.currency, locale)}`;
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
    optional(get('tourLanguage'), (v) => `Language: ${v}`),
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
