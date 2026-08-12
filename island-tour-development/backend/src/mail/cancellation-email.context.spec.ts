import * as fs from 'fs';
import * as path from 'path';
import {
  CancellationRefund,
  Currency,
  Locale,
  PaymentModel,
} from '@prisma/client';
import {
  buildCancellationEmailContext,
  buildCancellationEmailText,
  type CancellationEmailInput,
} from './cancellation-email.context';
import {
  findUnresolvedTokens,
  renderEmailTemplate,
} from './templates/email-template.renderer';

const TEMPLATE = fs.readFileSync(
  path.join(__dirname, 'templates', 'cancellation-email.template.html'),
  'utf8',
);

/** Local wall clock is stored `Z`-labelled - build fixtures the same way. */
const startAt = new Date(Date.UTC(2026, 4, 22, 8, 0));

function input(
  over: Partial<CancellationEmailInput> = {},
): CancellationEmailInput {
  return {
    booking: {
      displayRef: 'IT-2026-04821',
      customerLocale: Locale.en,
      currency: Currency.USD,
      paymentModel: PaymentModel.OPERATOR_LINK,
      cancellationRefund: CancellationRefund.FULL,
      // 20% deposit, the mock's number.
      depositAmount: '44.00',
      totalAmount: '220.00',
      tourStartDateTime: startAt,
      localDate: new Date(Date.UTC(2026, 4, 22)),
      ...over.booking,
    },
    tourName: 'Klein Curacao Day Trip',
    operatorName: 'Miss Ann Boat Trips',
    site: { logoUrl: 'https://cdn.test/logo.png', ...over.site },
    config: { emailIconBase: 'https://cdn.test/icons', ...over.config },
    ...(over.tourName !== undefined ? { tourName: over.tourName } : {}),
    ...(over.operatorName !== undefined
      ? { operatorName: over.operatorName }
      : {}),
  };
}

const refundLine = (over: Partial<CancellationEmailInput['booking']> = {}) =>
  String(
    buildCancellationEmailContext(
      input({ booking: { ...input().booking, ...over } }),
    ).refundLine,
  );

describe('buildCancellationEmailContext', () => {
  it('resolves every token the locked template references', () => {
    const ctx = buildCancellationEmailContext(input());
    expect(findUnresolvedTokens(TEMPLATE, ctx)).toEqual([]);
    expect(renderEmailTemplate(TEMPLATE, ctx)).not.toMatch(
      /\{[a-zA-Z][a-zA-Z0-9_.]*\}/,
    );
  });

  it('headline is the wireframe wording, with no trailing full stop', () => {
    expect(buildCancellationEmailContext(input()).noticeTitle).toBe(
      'Your booking is cancelled',
    );
  });

  it('subject is unchanged (founder decision D1b locked it to the wireframe)', () => {
    expect(buildCancellationEmailContext(input()).subjectLine).toBe(
      'Your booking is cancelled',
    );
  });

  it('preheader is its OWN line, not the subject repeated', () => {
    const ctx = buildCancellationEmailContext(input());
    expect(ctx.previewText).toBe(
      'Refund on its way. No forms, no questions asked.',
    );
    expect(ctx.previewText).not.toBe(ctx.subjectLine);
  });

  it('sub-line carries tour, long date and the reference through the shared formatter', () => {
    const ctx = buildCancellationEmailContext(input());
    expect(ctx.tourName).toBe('Klein Curacao Day Trip');
    expect(ctx.dateLong).toBe('Friday, 22 May 2026');
    expect(ctx.refLabel).toBe('Booking reference:');
    expect(ctx.bookingRef).toBe('IT-2026-04821');
  });

  it('lead line is the mock copy', () => {
    expect(buildCancellationEmailContext(input()).lead).toBe(
      'Plans change. No problem.',
    );
  });

  // The whole point of moving the matrix out of BookingsService: all four
  // payment models × the three verdicts, assertable without a database.
  describe('the refund matrix (payment model × verdict, B-23/B-24)', () => {
    it('operator_link × FULL: deposit back from us + the operator refunds the balance', () => {
      const line = refundLine({ paymentModel: PaymentModel.OPERATOR_LINK });
      expect(line).toContain('Your 20% deposit is on its way back from us');
      expect(line).toContain('the tour operator refunds that part');
    });

    it('on_arrival × FULL renders the same LOCKED deposit text (founder D1b)', () => {
      // Its balance sentence is CONDITIONAL ("If you've already paid the
      // balance…"), so it is never false pre-arrival either.
      const line = refundLine({ paymentModel: PaymentModel.ON_ARRIVAL });
      expect(line).toContain('deposit is on its way back from us');
      expect(line).toContain("If you've already paid the balance");
    });

    it('paid_in_full × FULL names the whole amount, through formatMoney', () => {
      const line = refundLine({ paymentModel: PaymentModel.PAID_IN_FULL });
      expect(line).toContain('Your payment of $220.00 is on its way back');
      expect(line).not.toContain('deposit');
    });

    it.each([
      CancellationRefund.FULL,
      CancellationRefund.PARTIAL,
      CancellationRefund.NONE,
    ])(
      'operator_full × %s: never a refund-from-us line - the operator refunds directly',
      (cancellationRefund) => {
        const line = refundLine({
          paymentModel: PaymentModel.OPERATOR_FULL,
          cancellationRefund,
        });
        expect(line).toContain('Nothing was paid to Island Tours');
        expect(line).toContain('Miss Ann Boat Trips refunds you directly');
        expect(line).not.toContain('on its way back');
      },
    );

    it('operator_full falls back to the locale stand-in when no operator is on file', () => {
      const line = String(
        buildCancellationEmailContext(
          input({
            operatorName: null,
            booking: {
              ...input().booking,
              paymentModel: PaymentModel.OPERATOR_FULL,
            },
          }),
        ).refundLine,
      );
      expect(line).toContain('the operator refunds you directly');
    });

    it.each([PaymentModel.OPERATOR_LINK, PaymentModel.PAID_IN_FULL])(
      'PARTIAL keeps the verdict overlay on %s',
      (paymentModel) => {
        expect(
          refundLine({
            paymentModel,
            cancellationRefund: CancellationRefund.PARTIAL,
          }),
        ).toContain('A partial refund applies');
      },
    );

    it.each([PaymentModel.OPERATOR_LINK, PaymentModel.PAID_IN_FULL])(
      'NONE keeps the outside-the-window line on %s',
      (paymentModel) => {
        expect(
          refundLine({
            paymentModel,
            cancellationRefund: CancellationRefund.NONE,
          }),
        ).toContain('no refund is due');
      },
    );
  });

  it('localises the whole email through the 7-locale module (de sample)', () => {
    const ctx = buildCancellationEmailContext(
      input({
        booking: { ...input().booking, customerLocale: Locale.de },
      }),
    );
    expect(ctx.noticeTitle).toBe('Deine Buchung ist storniert');
    expect(ctx.lead).toBe('Pläne ändern sich. Kein Problem.');
    expect(ctx.refundTitle).toBe('Deine Erstattung');
    expect(ctx.previewText).toBe(
      'Erstattung ist unterwegs. Keine Formulare, keine Rückfragen.',
    );
    expect(findUnresolvedTokens(TEMPLATE, ctx)).toEqual([]);
  });

  it('money formats for the reader, never hand-rolled (de puts the symbol last)', () => {
    const ctx = buildCancellationEmailContext(
      input({
        booking: {
          ...input().booking,
          customerLocale: Locale.de,
          currency: Currency.EUR,
          paymentModel: PaymentModel.PAID_IN_FULL,
        },
      }),
    );
    expect(String(ctx.refundLine)).toContain('220,00');
    expect(String(ctx.refundLine)).toMatch(/220,00\s*€/);
  });
});

describe('buildCancellationEmailText', () => {
  it('mirrors the html: no CTA, no processed line, no closing line, no markup', () => {
    const text = buildCancellationEmailText(
      buildCancellationEmailContext(input()),
    );
    expect(text).toContain('Your booking is cancelled');
    expect(text).toContain('Plans change. No problem.');
    expect(text).toContain('Your refund:');
    expect(text).toContain('Your 20% deposit is on its way back');
    expect(text).not.toContain('View your booking');
    expect(text).not.toContain('We have processed your request');
    expect(text).not.toContain('Nothing further is needed from you');
    expect(text).not.toMatch(/<[a-z]/i);
  });
});
