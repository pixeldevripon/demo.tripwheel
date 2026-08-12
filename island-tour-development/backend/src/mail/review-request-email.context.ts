import { Locale } from '@prisma/client';
import {
  formatDateLong,
  formatDateShort,
} from '@/bookings/booking-email.context';
import { emailSafeLogoUrl } from './email-logo.util';
import { copyFor, fillCopy } from './templates/email-copy.util';
import { REVIEW_REQUEST_COPY } from './templates/review-request-email.copy';
import type { EmailTemplateContext } from './templates/email-template.renderer';

/**
 * Builds the token context for the LOCKED BK-3 / BK-3R template
 * (`mail/templates/review-request-email.template.html`).
 *
 * Deliberately a PURE function over already-loaded rows, exactly like
 * `buildConfirmationEmailContext` and `buildNextAdventureEmailContext`: the
 * wireframe's rules (nine blocks, the hero band that disappears with the image,
 * the five stars pointing plainly at the review page, no unsubscribe anywhere)
 * are then unit-testable without a database. The senders
 * (`ReviewRequestsService`, the admin "send now" path, the test-send service)
 * do the I/O.
 *
 * ## Why the date arrives as a `Date`
 * Because it kept arriving as a string. The shipped build formatted it with
 * `localDate.toISOString().slice(0, 10)`, so every review email in production
 * read "2026-05-22" while the whole rest of the family read "Friday, 22 May
 * 2026" - and it read that way in all seven locales, including the four where
 * ISO order is not even the local convention. Taking the raw instant here means
 * no caller can hand-roll it again: {@link formatDateLong} is the single
 * formatter, and it formats in UTC because local wall-clock instants are stored
 * Z-labelled (see `timezone.util.ts`).
 */

export interface ReviewRequestEmailInput {
  /** Lead traveller's first name; the caller supplies its own fallback. */
  firstName: string;
  tourName: string;
  /** Operator company name; null when none is on file. */
  operatorName: string | null;
  bookingRef: string;
  /**
   * The tour's LOCAL wall-clock date (`Booking.localDate`, a `@db.Date`
   * UTC-midnight instant). Formatted here, never by the caller.
   */
  tourDate: Date;
  /**
   * The tour's hero image. `null` skips BOTH the hero band and the booking
   * card's 96px thumbnail - a tour with no image gets no empty band.
   */
  tourImageUrl: string | null;
  /** Already-pluralised party lines ("2 adults", "1 child"); may be empty. */
  partyLines: readonly string[];
  /** The tokenized review page - inbox to committed rating in one tap. */
  reviewUrl: string;
  siteLogoUrl: string | null;
  /** BK-3R rides the same template with the reminder's own copy. */
  isReminder: boolean;
  /** `reviewWhatsappOptIn` - adds one line to the reminder only. */
  whatsappOptIn: boolean;
  /** Traveller's platform locale (§2.9). */
  locale: Locale;
}

export function buildReviewRequestEmailContext(
  input: ReviewRequestEmailInput,
): EmailTemplateContext {
  const copy = copyFor(REVIEW_REQUEST_COPY, input.locale);

  // Two operator tokens, on purpose. `operatorName` is the REAL name or
  // nothing: it labels the booking card, where a stand-in phrase would read as
  // a company that does not exist. `operatorTeam` always resolves to something
  // sayable, because it sits mid-sentence in the ask and in the hero subline,
  // where an empty slot would leave "Supplied by  ·".
  const operatorName = input.operatorName?.trim() ?? '';
  const operatorTeam = operatorName || copy.operatorFallback;

  const dateLong = formatDateLong(input.tourDate, input.locale);
  const vars = {
    firstName: input.firstName,
    tourName: input.tourName,
    operatorName: operatorTeam,
    operatorTeam,
    dateLong,
    // The hero band uses the SHORT date ("22 May 2026"), matching the
    // wireframe: the booking card immediately below already prints the
    // weekday, and rendering it twice ~100px apart reads as a stutter -
    // worst in the locales that spell it out ("tu tour, viernes, 22 de
    // mayo de 2026").
    dateShort: formatDateShort(input.tourDate, input.locale),
    bookingRef: input.bookingRef,
  };

  // BK-3R's copy is a founder-approved paragraph DRAFT (decision D1), kept
  // verbatim rather than re-cut into the nine-block strings. Paragraph 1 opens
  // with the traveller's name, so it takes the greeting cell and the 22px
  // greeting above it is suppressed; the rest become the ask cell's body.
  const reminderBody = input.isReminder
    ? [
        ...copy.reminderParagraphs,
        ...(input.whatsappOptIn ? [copy.reminderWhatsappLine] : []),
      ].map((p) => fillCopy(p, vars))
    : [];

  return {
    // Chrome + head
    locale: input.locale,
    siteLogoUrl: emailSafeLogoUrl(input.siteLogoUrl) ?? '',
    subjectLine: fillCopy(
      input.isReminder ? copy.reminderSubject : copy.subject,
      vars,
    ),
    // Never the subject line: the notice shell used the subject as its
    // preheader, so every inbox showed the same sentence twice.
    previewText: copy.preview,

    // 2 · Hero band (empty image hides the whole block)
    heroImageUrl: input.tourImageUrl ?? '',
    heroSubline: fillCopy(copy.heroSubline, vars),

    // 3 · Greeting
    greeting: input.isReminder ? '' : fillCopy(copy.greeting, vars),
    greetingLine: input.isReminder
      ? (reminderBody[0] ?? '')
      : copy.greetingLine,

    // 4 · Booking card
    tourName: input.tourName,
    operatorName,
    dateLong,
    partyBreakdown: input.partyLines.filter(Boolean).join(', '),
    refLabel: copy.refLabel,
    bookingRef: input.bookingRef,

    // 5 · The ask (BK-3) or the reminder's remaining paragraphs (BK-3R)
    askBefore: input.isReminder ? '' : copy.askBefore,
    askAfter: input.isReminder ? '' : copy.askAfter,
    operatorTeam,
    extraParagraphs: input.isReminder ? reminderBody.slice(1) : [],

    // 6 · Stars - every one of the five hrefs is this, unparameterised
    tapAStar: copy.tapAStar,
    reviewUrl: input.reviewUrl,

    // 7 · CTA + disclosure
    cta: copy.cta,
    disclosureVerified: copy.disclosureVerified,
    disclosurePublishAll: copy.disclosurePublishAll,

    // 8 · Sign-off
    signoffThanks: copy.signoffThanks,
    signoffTeam: copy.signoffTeam,

    // 9 · Footer (transactional - no unsubscribe token exists on purpose)
    footerLine: fillCopy(copy.footerLine, vars),
  };
}

/**
 * Plain-text part, built from the same context as the HTML (the family rule: a
 * missing or junk text part costs real spam score, and this email's whole job
 * is reaching an inbox days after the tour).
 *
 * The five stars collapse to the one link they all point at.
 */
export function buildReviewRequestEmailText(ctx: EmailTemplateContext): string {
  const get = (key: string): string => String(ctx[key] ?? '').trim();
  // The ask is read UNTRIMMED: `askBefore` ends with the space before the
  // operator name and `askAfter` starts with the one after it, so trimming
  // would email "…means a lot toMiss Ann Boat Tripsand the team".
  const raw = (key: string): string => String(ctx[key] ?? '');
  const extra = Array.isArray(ctx.extraParagraphs) ? ctx.extraParagraphs : [];

  const lines: Array<string | null> = [
    get('greeting'),
    get('greetingLine'),
    '',
    get('tourName'),
    get('operatorName') || null,
    [get('dateLong'), get('partyBreakdown')].filter(Boolean).join(' · '),
    `${get('refLabel')} ${get('bookingRef')}`,
    '',
    get('askBefore')
      ? `${raw('askBefore')}${raw('operatorTeam')}${raw('askAfter')}`
      : null,
    ...extra.flatMap((p) => [String(p), '']),
    '',
    `${get('cta')}: ${get('reviewUrl')}`,
    '',
    get('disclosureVerified'),
    get('disclosurePublishAll'),
    '',
    get('signoffThanks'),
    get('signoffTeam'),
    '',
    get('footerLine'),
  ];
  return lines
    .filter((line): line is string => line !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
