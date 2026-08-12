import { CancellationRefund, PaymentModel } from '@prisma/client';
import type { Currency } from '@prisma/client';
import {
  depositPctOf,
  formatDateLong,
  formatMoney,
  toLocale,
} from '@/bookings/booking-email.context';
import { emailSafeLogoUrl } from './email-logo.util';
import { copyFor, fillCopy } from './templates/email-copy.util';
import { CANCELLATION_EMAIL_COPY } from './templates/cancellation-email.copy';
import type { EmailTemplateContext } from './templates/email-template.renderer';

/**
 * Builds the token context for the LOCKED CX-1 template
 * (`mail/templates/cancellation-email.template.html`).
 *
 * Deliberately a PURE function over already-loaded rows, exactly like
 * `buildNextAdventureEmailContext` and `buildConfirmationEmailContext`.
 * `BookingsService.sendCancellationConfirmedNotices` does the I/O.
 *
 * The refund MATRIX used to live inline at that call site, which meant the one
 * sentence a cancelled traveller actually reads had no unit test of its own.
 * It lives here now, where all four payment models × three verdicts are
 * assertable without a database.
 */

export interface CancellationEmailInput {
  booking: {
    displayRef: string;
    customerLocale: string | null;
    currency: Currency;
    paymentModel: PaymentModel;
    /** The POLICY verdict, not proof a refund has settled. */
    cancellationRefund: CancellationRefund;
    depositAmount: string;
    totalAmount: string;
    tourStartDateTime: Date | null;
    localDate: Date;
  };
  tourName: string;
  /** Null falls back to the locale's "the operator" stand-in. */
  operatorName: string | null;
  site: {
    logoUrl: string | null;
  };
  config: {
    emailIconBase: string;
  };
}

export function buildCancellationEmailContext(
  input: CancellationEmailInput,
): EmailTemplateContext {
  const { booking, tourName, operatorName, site, config } = input;
  const locale = toLocale(booking.customerLocale);
  const copy = copyFor(CANCELLATION_EMAIL_COPY, locale);

  return {
    // Chrome + head
    locale,
    emailIconBase: config.emailIconBase,
    siteLogoUrl: emailSafeLogoUrl(site.logoUrl) ?? '',
    subjectLine: fillCopy(copy.subject, { bookingRef: booking.displayRef }),
    // Its own line. The shared notice shell reused {noticeTitle} here, so the
    // inbox preview simply repeated the subject back at the reader.
    //
    // And it tracks the BRANCH: "Refund on its way" is false for a
    // late cancellation (no refund due) and for `operator_full`, where we
    // never took a payment to return. The preview pane is read before the
    // body that would correct it, so a wrong promise there is the one place
    // it does the most damage.
    previewText: refundIsComing(input)
      ? copy.preheader
      : copy.preheaderNoRefund,

    // Headline + the single sub-line
    noticeTitle: copy.title,
    tourName,
    dateLong: formatDateLong(
      booking.tourStartDateTime ?? booking.localDate,
      locale,
    ),
    refLabel: copy.refLabel,
    bookingRef: booking.displayRef,
    lead: copy.lead,

    // The refund panel
    refundTitle: copy.refundTitle,
    refundLine: refundLine(input),
  };
}

/**
 * Plain-text part, from the same context as the HTML (family rule: a missing
 * text part costs real spam score).
 *
 * Mirrors the HTML exactly - which means it also carries NO `processed` and NO
 * `closing` paragraph and NO CTA. Those copy keys are retained in the module
 * but rendered by neither part; see the note on `CancellationEmailCopy`.
 */
export function buildCancellationEmailText(ctx: EmailTemplateContext): string {
  const get = (key: string): string => String(ctx[key] ?? '').trim();
  return [
    get('noticeTitle'),
    `${get('tourName')} · ${get('dateLong')} · ${get('refLabel')} ${get('bookingRef')}`,
    '',
    get('lead'),
    '',
    `${get('refundTitle')}: ${get('refundLine')}`,
    '',
    'Island Tours. Built by Islanders.',
    'This is a transactional booking email.',
  ].join('\n');
}

// ── internals ────────────────────────────────────────────────────────────────

/**
 * What the traveller is told about their money: the master 6.4 payment-model
 * copy CROSSED with the `CancellationRefund` verdict (B-23/B-24). The verdict
 * overlay is composed with, never replaced by, the payment-model branch.
 *
 *  - operator_full: Island Tours never held money, so there is no
 *    refund-from-us line under ANY verdict; the operator refunds directly.
 *  - FULL: paid_in_full gets "your payment is on its way back from us";
 *    both deposit models (operator_link and on_arrival) get the wireframe's
 *    LOCKED deposit-back text (founder decision 2026-08-11, D1b) - its
 *    balance sentence is CONDITIONAL ("If you've already paid the
 *    balance…"), so it is never false for a pay-on-arrival traveller either.
 *  - PARTIAL / NONE: the verdict overlay, unchanged.
 */
/**
 * Does any money actually come back from Island Tours? Mirrors `refundLine`'s
 * branching exactly - PARTIAL counts, because something is returned.
 */
function refundIsComing(input: CancellationEmailInput): boolean {
  const { booking } = input;
  if (booking.paymentModel === PaymentModel.OPERATOR_FULL) return false;
  return (
    booking.cancellationRefund === CancellationRefund.PARTIAL ||
    booking.cancellationRefund === CancellationRefund.FULL
  );
}

function refundLine(input: CancellationEmailInput): string {
  const { booking, operatorName } = input;
  const locale = toLocale(booking.customerLocale);
  const copy = copyFor(CANCELLATION_EMAIL_COPY, locale);

  if (booking.paymentModel === PaymentModel.OPERATOR_FULL) {
    return fillCopy(copy.operatorFullLine, {
      operatorName: operatorName ?? copy.operatorFallback,
    });
  }
  if (booking.cancellationRefund === CancellationRefund.PARTIAL) {
    return copy.partial;
  }
  if (booking.cancellationRefund !== CancellationRefund.FULL) {
    return copy.noRefund;
  }
  if (booking.paymentModel === PaymentModel.PAID_IN_FULL) {
    return fillCopy(copy.refundPaidInFull, {
      totalAmount: formatMoney(booking.totalAmount, booking.currency, locale),
    });
  }
  return fillCopy(copy.refundDepositSplit, {
    depositPct: depositPctOf(booking.depositAmount, booking.totalAmount),
  });
}
