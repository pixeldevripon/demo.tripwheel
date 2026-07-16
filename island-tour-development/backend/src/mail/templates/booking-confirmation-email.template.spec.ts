import * as fs from 'fs';
import * as path from 'path';
import {
  renderEmailTemplate,
  findUnresolvedTokens,
  type EmailTemplateContext,
} from './email-template.renderer';

/**
 * Guards the LOCKED confirmation-email template against the wireframe
 * (technical-doc/island-tours-booking-confirmation-email-wireframe.html).
 *
 * The renderer spec proves the mini-language works; this proves the real
 * template file uses it correctly. Two classes of bug are only visible here:
 *  - an optional row whose icon sits OUTSIDE its [IF], emailing an orphan icon
 *    next to blank space
 *  - a token nobody supplies, which the renderer leaves literal on purpose
 */
const TEMPLATE = fs.readFileSync(
  path.join(__dirname, 'booking-confirmation-email.template.html'),
  'utf8',
);

const ICON_BASE =
  'https://res.cloudinary.com/test/image/upload/f_png,w_34/islandtours/email/icons';

/** Every icon site the wireframe draws, keyed by the token that gates it. */
const OPTIONAL_ICONS: ReadonlyArray<[string, string]> = [
  ['endPoint', 'icon-route-end'],
  ['duration', 'icon-clock'],
  ['tourLanguage', 'icon-globe'],
  ['specialRequests', 'icon-message'],
  ['operatorNote', 'icon-info'],
];

/** Icons that render on every booking regardless of the optional fields. */
const ALWAYS_ICONS = [
  'icon-check-green',
  'icon-pin',
  'icon-hourglass',
  'icon-users',
  'icon-shield-check',
];

function ctx(overrides: EmailTemplateContext = {}): EmailTemplateContext {
  return {
    emailIconBase: ICON_BASE,
    siteLogoUrl: 'https://cdn.test/logo.png',
    firstName: 'Denley',
    bookingRef: 'IT-2026-04821',
    tourName: 'Klein Curacao Day Trip',
    operatorName: 'Miss Ann Boat Trips',
    featuredImageUrl: 'https://cdn.test/hero.jpg',
    dateLong: 'Friday, 22 May 2026',
    startTime: '08:00',
    hasPickup: true,
    pickupLocation: 'Hotel Brion',
    pickupTime: '07:15',
    meetingPoint: 'Sint Annabaai Pier',
    mapUrl: 'https://maps.test/x',
    arrivalBufferMin: 5,
    endPoint: 'Jan Thiel Beach',
    partyBreakdown: '2 adults, 1 child',
    duration: '9 hours',
    tourLanguage: 'English',
    specialRequests: 'Vegetarian lunch for one',
    operatorNote: 'Bring a towel.',
    paymentModel: 'operator_link',
    onArrivalPayment: '',
    depositPct: 30,
    depositAmount: '$60.00',
    balanceAmount: '$160.00',
    totalAmount: '$220.00',
    paidAmount: '$220.00',
    whatsappUrl: 'https://wa.me/8801913509868',
    tourUrl: 'https://island.tours/t/x',
    calendarUrl: 'https://island.tours/ics/x',
    cancelUrl: 'https://island.tours/cancel/x',
    whatToBring: 'Sunscreen, towel',
    knowBeforeYouGo: 'Bring ID',
    freeCancellationDeadline: 'Wednesday 20 May, 08:00',
    paymentMethodLine: 'Visa ending 4242',
    bookingsUrl: 'https://island.tours/bookings',
    browseUrl: 'https://island.tours/curacao/tours',
    locale: 'en',
    dateShort: '22 May 2026',
    cancelDeadlineDateTime: 'Wednesday 20 May 2026, 08:00',
    operatorPhone: '+5999 123 4567',
    operatorEmail: 'hello@missann.test',
    accountUrl: 'https://island.tours/bookings',
    islandName: 'Curacao',
    relatedTourOneImageUrl: 'https://cdn.test/r1.jpg',
    relatedTourOneName: 'Blue Room Snorkel',
    relatedTourOneRating: '4.8',
    relatedTourOnePrice: 'from $45',
    relatedTourTwoImageUrl: 'https://cdn.test/r2.jpg',
    relatedTourTwoName: 'Christoffel Sunrise Hike',
    relatedTourTwoRating: '4.7',
    relatedTourTwoPrice: 'from $35',
    allToursUrl: 'https://island.tours/curacao/tours',
    ...overrides,
  };
}

describe('booking-confirmation-email.template.html', () => {
  it('resolves every token for a full operator_link booking', () => {
    expect(findUnresolvedTokens(TEMPLATE, ctx())).toEqual([]);
  });

  it('resolves every token for each payment model', () => {
    const models = [
      { paymentModel: 'operator_link' },
      { paymentModel: 'on_arrival', onArrivalPayment: 'card_or_cash' },
      { paymentModel: 'on_arrival', onArrivalPayment: 'cash_only' },
      { paymentModel: 'paid_in_full' },
      { paymentModel: 'operator_full' },
    ];
    for (const m of models) {
      expect(findUnresolvedTokens(TEMPLATE, ctx(m))).toEqual([]);
    }
  });

  it('leaves no unrendered conditional or token markup', () => {
    const html = renderEmailTemplate(TEMPLATE, ctx());
    expect(html).not.toContain('[IF');
    expect(html).not.toContain('[ELSE]');
    expect(html).not.toContain('[/IF]');
    expect(html).not.toMatch(/\{[a-zA-Z][a-zA-Z0-9_.]*\}/);
  });

  it('ships zero inline svg and zero unicode glyph icons (LD20)', () => {
    // Gmail strips <svg>; Outlook's Word engine never supported it.
    expect(TEMPLATE).not.toContain('<svg');
    expect(TEMPLATE).not.toMatch(/[✓⌖⌛↦☷◷◎▱ⓘ◇]/);
  });

  it('renders every icon as a Cloudinary png img with an empty alt', () => {
    const html = renderEmailTemplate(TEMPLATE, ctx());
    for (const icon of [...ALWAYS_ICONS, ...OPTIONAL_ICONS.map(([, i]) => i)]) {
      expect(html).toContain(`${ICON_BASE}/${icon}.png`);
    }
    // decorative: the adjacent text carries the meaning
    const iconImgs = html.match(/<img[^>]*email\/icons[^>]*>/g) ?? [];
    expect(iconImgs).toHaveLength(10);
    for (const img of iconImgs) expect(img).toContain('alt=""');
  });

  describe('optional rows hide together with their icon', () => {
    it.each(OPTIONAL_ICONS)('%s absent -> %s not rendered', (token, icon) => {
      const html = renderEmailTemplate(TEMPLATE, ctx({ [token]: '' }));
      expect(html).not.toContain(`${icon}.png`);
    });

    it('a minimal booking keeps only the always-on icons', () => {
      const html = renderEmailTemplate(
        TEMPLATE,
        ctx(Object.fromEntries(OPTIONAL_ICONS.map(([t]) => [t, '']))),
      );
      for (const [, icon] of OPTIONAL_ICONS) {
        expect(html).not.toContain(`${icon}.png`);
      }
      for (const icon of ALWAYS_ICONS) expect(html).toContain(`${icon}.png`);
    });
  });

  describe('brand bar', () => {
    it('renders the settings logo when SiteInfo.logo is set', () => {
      const html = renderEmailTemplate(TEMPLATE, ctx());
      expect(html).toContain('<img src="https://cdn.test/logo.png"');
      expect(html).toContain('alt="Island Tours"');
      expect(html).not.toContain('>ISLAND <');
    });

    it('falls back to the wireframe wordmark when the logo is unset', () => {
      const html = renderEmailTemplate(TEMPLATE, ctx({ siteLogoUrl: '' }));
      expect(html).toContain('>ISLAND <');
      expect(html).toContain('#E8611A');
      expect(html).not.toContain('cdn.test/logo.png');
    });
  });
});
