import { Locale } from '@prisma/client';
import type { Currency } from '@prisma/client';
import {
  formatMoney,
  intlLocale,
  toLocale,
} from '@/bookings/booking-email.context';
import { emailSafeLogoUrl } from './email-logo.util';
import { copyFor, fillCopy } from './templates/email-copy.util';
import { NEXT_ADVENTURE_COPY } from './templates/next-adventure-email.copy';
import type { EmailTemplateContext } from './templates/email-template.renderer';

/**
 * Builds the token context for the LOCKED MK-1 template
 * (`mail/templates/next-adventure-email.template.html`).
 *
 * Deliberately a PURE function over already-loaded rows, exactly like
 * `buildConfirmationEmailContext`: the wireframe's rules (three cards, the
 * open-days line from live availability, no discount/countdown/scarcity
 * vocabulary anywhere) are then unit-testable without a database.
 * `NextAdventureEmailsService` does the I/O and the card selection.
 *
 * Subject A ships (G-08). `subjectB` stays in the copy module, deliberately
 * unused, as the future A/B arm.
 */

export interface NextAdventureCardInput {
  name: string;
  slug: string;
  imageUrl: string | null;
  /** Null = cold start; the card shows no rating rather than inventing one (LD11). */
  aggregateRating: number | null;
  aggregateReviewCount: number;
  durationMinutesFrom: number | null;
  /** Listing "From" anchor as a decimal string; null hides the price part. */
  priceFrom: string | null;
  currency: Currency;
  /** Localized card teaser (TourTranslation.shortDescription); empty hides the line. */
  oneLiner: string | null;
  /**
   * The card's OPEN departure dates inside the 7-day send window
   * (`Departure.date`, `@db.Date` → UTC-midnight instants). Resolved at send
   * time by the service — this is what makes MK-1 an availability email.
   */
  openDates: readonly Date[];
}

export interface NextAdventureEmailInput {
  booking: {
    customerLocale: string | null;
    contactEmail: string;
  };
  bookedTourName: string;
  destination: {
    name: string;
    slug: string;
  };
  /** LIVE tours on the island — the "See all {n} tours" count. */
  destinationTourCount: number;
  /** Exactly three (the sender suppressed otherwise): contrast, adjacent, flagship. */
  cards: readonly [
    NextAdventureCardInput,
    NextAdventureCardInput,
    NextAdventureCardInput,
  ];
  site: {
    logoUrl: string | null;
  };
  /** `${islandToursBase()}/unsubscribe/{token}` — minted by the sender (G-14). */
  unsubscribeUrl: string;
  config: {
    frontendUrl: string;
    emailIconBase: string;
  };
}

export function buildNextAdventureEmailContext(
  input: NextAdventureEmailInput,
): EmailTemplateContext {
  const locale = toLocale(input.booking.customerLocale);
  const copy = copyFor(NEXT_ADVENTURE_COPY, locale);
  const base = input.config.frontendUrl.replace(/\/$/, '');

  const cardSlots = (['cardOne', 'cardTwo', 'cardThree'] as const).reduce<
    Record<string, string>
  >((acc, prefix, i) => {
    const card = input.cards[i];
    return {
      ...acc,
      [`${prefix}Url`]: `${base}/${locale}/${input.destination.slug}/${card.slug}/`,
      [`${prefix}ImageUrl`]: card.imageUrl ?? '',
      [`${prefix}Name`]: card.name,
      [`${prefix}MetaPrefix`]: metaPrefix(card, copy.fromLabel, locale),
      [`${prefix}Price`]: priceLabel(card, locale),
      [`${prefix}OpenDays`]: openDaysLine(
        card.openDates,
        copy.openPrefix,
        copy.openDaily,
        locale,
      ),
      [`${prefix}Line`]: card.oneLiner?.trim() ?? '',
    };
  }, {});

  return {
    // Chrome + head
    locale,
    emailIconBase: input.config.emailIconBase,
    siteLogoUrl: emailSafeLogoUrl(input.site.logoUrl) ?? '',
    subjectLine: fillCopy(copy.subjectA, { tourName: input.bookedTourName }),
    previewText: copy.preview,

    // Block 1
    headline: copy.headline,
    introBeforeTourName: copy.introBeforeTourName,
    bookedTourName: input.bookedTourName,
    introAfterTourName: copy.introAfterTourName,
    alreadyHome: copy.alreadyHome,

    // Cards
    ...cardSlots,
    seeTimes: copy.seeTimes,

    // Fill note + see-all
    fillNote: copy.fillNote,
    allToursUrl: `${base}/${locale}/${input.destination.slug}/tours/`,
    seeAllLabel: fillCopy(copy.seeAllLabel, {
      count: input.destinationTourCount,
      island: input.destination.name,
    }),

    // Free reschedule (the flexibility promise that replaces any discount)
    rescheduleBold: copy.rescheduleBold,
    rescheduleRest: copy.rescheduleRest,

    // Marketing footer (G-14)
    footerBeforeTourName: copy.footerBeforeTourName,
    footerAfterTourName: copy.footerAfterTourName,
    unsubscribeUrl: input.unsubscribeUrl,
    unsubscribeLabel: copy.unsubscribeLabel,
    fewerEmailsLabel: copy.fewerEmailsLabel,
  };
}

/**
 * Plain-text part, built from the same context as the HTML (the family rule:
 * a missing text part costs real spam score, and a MARKETING send needs its
 * deliverability more than any transactional one).
 */
export function buildNextAdventureEmailText(ctx: EmailTemplateContext): string {
  const get = (key: string): string => String(ctx[key] ?? '').trim();

  const card = (prefix: string): string[] => {
    const meta = `${get(`${prefix}MetaPrefix`)}${get(`${prefix}Price`)}`.trim();
    return [
      get(`${prefix}Name`),
      ...(meta ? [meta] : []),
      get(`${prefix}OpenDays`),
      ...(get(`${prefix}Line`) ? [get(`${prefix}Line`)] : []),
      `${get('seeTimes')}: ${get(`${prefix}Url`)}`,
      '',
    ];
  };

  const lines: string[] = [
    get('headline'),
    `${get('introBeforeTourName')}${get('bookedTourName')}${get('introAfterTourName')}`,
    get('alreadyHome'),
    '',
    ...card('cardOne'),
    ...card('cardTwo'),
    ...card('cardThree'),
    get('fillNote'),
    `${get('seeAllLabel')}: ${get('allToursUrl')}`,
    '',
    `${get('rescheduleBold')} ${get('rescheduleRest')}`,
    '',
    'Shanice',
    'Island Tours · Willemstad, Curaçao',
    '',
    `${get('footerBeforeTourName')}${get('bookedTourName')}${get('footerAfterTourName')}`,
    `${get('unsubscribeLabel')}: ${get('unsubscribeUrl')}`,
    'ITG B.V. (Island Tours Group) · KvK Curaçao 169950',
    'Caracasbaaiweg 366, Willemstad, Curaçao',
    'Built by Islanders.',
  ];
  return lines.join('\n');
}

// ── internals ────────────────────────────────────────────────────────────────

/**
 * "★ 4.8 (212) · 4 hrs · from " — everything before the bold price. The
 * rating renders only when one exists (LD11 cold-start: never a fabricated
 * number) and the trailing from-label only when there is a price to follow.
 */
function metaPrefix(
  card: NextAdventureCardInput,
  fromLabel: string,
  locale: Locale,
): string {
  const parts: string[] = [];
  if (card.aggregateRating != null) {
    const count =
      card.aggregateReviewCount > 0 ? ` (${card.aggregateReviewCount})` : '';
    parts.push(`★ ${card.aggregateRating.toFixed(1)}${count}`);
  }
  const duration = durationShort(card.durationMinutesFrom, locale);
  if (duration) parts.push(duration);
  const joined = parts.join(' · ');
  if (!priceLabel(card, locale)) return joined;
  return joined ? `${joined} · ${fromLabel} ` : `${fromLabel} `;
}

/** "$89" — same whole-amount rule as the BK-1 rail cards (priceLabel there). */
function priceLabel(
  card: Pick<NextAdventureCardInput, 'priceFrom' | 'currency'>,
  locale: Locale,
): string {
  if (!card.priceFrom) return '';
  return formatMoney(card.priceFrom, card.currency, locale).replace(
    /([.,])00(?=\D|$)/,
    '',
  );
}

/** "4 hrs" / "2.5 hrs" / "45 min" — the wireframe's compact card duration. */
function durationShort(minutes: number | null, locale: Locale): string {
  if (!minutes || minutes <= 0) return '';
  const copy = copyFor(NEXT_ADVENTURE_COPY, locale);
  if (minutes < 60) return fillCopy(copy.minutesShort, { minutes });
  // One decimal at most ("2.5 hrs"), whole hours bare ("4 hrs").
  const hours = Math.round((minutes / 60) * 10) / 10;
  return fillCopy(copy.hoursShort, { hours });
}

/**
 * "Open: Thu, Fri, Sat" — the weekdays with an OPEN departure inside the
 * 7-day window, chronological, deduped; all seven weekdays collapse to
 * "Open: daily" (the wireframe's second card). `Departure.date` is `@db.Date`
 * (a UTC-midnight instant), so weekday and name both read in UTC.
 */
function openDaysLine(
  openDates: readonly Date[],
  openPrefix: string,
  openDaily: string,
  locale: Locale,
): string {
  const sorted = [...openDates].sort((a, b) => a.getTime() - b.getTime());
  const seen = new Set<number>();
  const names: string[] = [];
  const fmt = new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: 'short',
    timeZone: 'UTC',
  });
  for (const date of sorted) {
    const day = date.getUTCDay();
    if (seen.has(day)) continue;
    seen.add(day);
    names.push(fmt.format(date));
  }
  if (seen.size >= 7) return `${openPrefix} ${openDaily}`;
  return `${openPrefix} ${names.join(', ')}`;
}
