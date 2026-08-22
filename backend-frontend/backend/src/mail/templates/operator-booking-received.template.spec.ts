import * as fs from 'fs';
import * as path from 'path';
import {
  findUnresolvedTokens,
  renderEmailTemplate,
  type EmailTemplateContext,
} from './email-template.renderer';

/**
 * The operator "Booking Received" notification (C7). There is no dedicated
 * wireframe for it - the design rule is that operator emails REUSE the traveller
 * confirmation's shell - so this spec asserts (a) the token contract renders clean
 * for every payment model and (b) the shell styles are literally the traveller
 * template's styles, so the two emails can never drift apart visually.
 */
const TEMPLATE = fs.readFileSync(
  path.join(__dirname, 'operator-booking-received.template.html'),
  'utf8',
);

const TRAVELLER_TEMPLATE = fs.readFileSync(
  path.join(__dirname, 'booking-confirmation-email.template.html'),
  'utf8',
);

function ctx(overrides: EmailTemplateContext = {}): EmailTemplateContext {
  return {
    emailIconBase: 'https://cdn.test/icons',
    siteLogoUrl: 'https://cdn.test/logo.png',
    bookingRef: 'IT-2026-04821',
    tourName: 'Klein Curacao Day Trip',
    featuredImageUrl: 'https://cdn.test/hero.jpg',
    guestName: 'Denley Jansen',
    guestEmail: 'denley@example.test',
    guestPhone: '+599 9 555 1234',
    dateLong: 'Friday, 22 May 2026',
    dateShort: '22 May 2026',
    startTime: '08:00',
    partyBreakdown: '2 adults, 1 child',
    hasPickup: true,
    pickupLocation: 'Hotel Brion',
    pickupTime: '07:15',
    meetingPoint: 'Sint Annabaai Pier',
    specialRequests: 'Vegetarian lunch for one',
    paymentModel: 'operator_link',
    onArrivalPayment: '',
    depositPct: '20',
    depositAmount: '$40.00',
    balanceAmount: '$160.00',
    totalAmount: '$200.00',
    cancelDeadlineDateTime: 'Wed, 20 May 2026, 08:00',
    dashboardUrl: 'https://island.tours/dashboard/bookings',
    ...overrides,
  };
}

describe('operator-booking-received.template.html', () => {
  it('resolves every token for each payment model', () => {
    const models = [
      { paymentModel: 'operator_link' },
      { paymentModel: 'on_arrival', onArrivalPayment: 'card_or_cash' },
      { paymentModel: 'on_arrival', onArrivalPayment: 'cash_only' },
      { paymentModel: 'paid_in_full' },
    ];
    for (const m of models) {
      expect(findUnresolvedTokens(TEMPLATE, ctx(m))).toEqual([]);
      const html = renderEmailTemplate(TEMPLATE, ctx(m));
      expect(html).not.toContain('[IF');
      expect(html).not.toMatch(/\{[a-zA-Z][a-zA-Z0-9_.]*\}/);
    }
  });

  it('tells the operator what to do per payment model', () => {
    const link = renderEmailTemplate(TEMPLATE, ctx());
    expect(link).toContain('your secure payment link');
    expect(link).toContain('An unpaid balance cancels the booking');

    const cash = renderEmailTemplate(
      TEMPLATE,
      ctx({ paymentModel: 'on_arrival', onArrivalPayment: 'cash_only' }),
    );
    expect(cash).toContain('in cash when the traveller arrives');

    const paid = renderEmailTemplate(
      TEMPLATE,
      ctx({ paymentModel: 'paid_in_full' }),
    );
    expect(paid).toContain('fully paid to Island Tours');
    expect(paid).toContain('your own confirmation and arrival details');
  });

  it('carries the traveller contact and pickup facts', () => {
    const html = renderEmailTemplate(TEMPLATE, ctx());
    expect(html).toContain('Denley Jansen');
    expect(html).toContain('denley@example.test');
    expect(html).toContain('Pickup requested: Hotel Brion, 07:15.');
    // No-pickup branch names the meeting point instead.
    const meet = renderEmailTemplate(TEMPLATE, ctx({ hasPickup: false }));
    expect(meet).toContain('the traveller meets you at Sint Annabaai Pier');
  });

  it('hides the phone separator when there is no phone', () => {
    const html = renderEmailTemplate(TEMPLATE, ctx({ guestPhone: '' }));
    expect(html).toContain('Contact: denley@example.test</td>');
  });

  describe('reuses the traveller shell verbatim (operator emails share the shell)', () => {
    // Every style attribute in the operator email must already exist in the
    // traveller template: the operator email introduces no styling of its own.
    it('introduces zero new style attributes', () => {
      const styles = [...TEMPLATE.matchAll(/style="([^"]*)"/g)].map(
        (m) => m[1],
      );
      const foreign = [...new Set(styles)].filter(
        (s) => !TRAVELLER_TEMPLATE.includes(s),
      );
      expect(foreign).toEqual([]);
    });

    it('keeps the same fluid shell and per-cell font stacks', () => {
      expect(TEMPLATE).toContain(
        'width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px',
      );
      // The wireframe has no media queries; the ONE block here is the
      // founder-approved mobile spacing refinement (2026-07-16) and nothing else,
      // and the only classes are its two hooks.
      const media = TEMPLATE.match(/@media[^{]*\{/g) ?? [];
      expect(media).toHaveLength(1);
      expect(TEMPLATE).toContain('@media only screen and (max-width: 480px)');
      const classes = [...TEMPLATE.matchAll(/class="([^"]*)"/g)].map(
        (m) => m[1],
      );
      expect([...new Set(classes)].sort()).toEqual(['it-cell', 'it-shell-pad']);
      expect(TEMPLATE).not.toContain('<svg');
    });
  });
});
