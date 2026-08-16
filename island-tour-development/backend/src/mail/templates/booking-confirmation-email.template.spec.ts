import * as fs from 'fs';
import * as path from 'path';
import {
  renderEmailTemplate,
  findUnresolvedTokens,
  type EmailTemplateContext,
} from './email-template.renderer';

/**
 * Guards the LOCKED confirmation-email template against the wireframe
 * (technical-doc/emails/island-tours-booking-confirmation-email-wireframe.html).
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

/** The design source: the `<template id="email-tpl">` block inside the wireframe. */
const WIREFRAME_EMAIL = (() => {
  const wireframe = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'technical-doc',
      'emails',
      'island-tours-booking-confirmation-email-wireframe.html',
    ),
    'utf8',
  );
  const match = wireframe.match(
    /<template id="email-tpl">([\s\S]*?)<\/template>/,
  );
  if (!match) throw new Error('email-tpl template not found in the wireframe');
  return match[1];
})();

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
    // Operator-conditions recap (Pastel #80): empty on the ungated catalog -
    // the wireframe-pinned rendering must stay byte-identical without it.
    termsLine: '',
    termsUrl: '',
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
    whatToBring: ['Sunscreen', 'Towel'],
    knowBeforeYouGo: ['Bring ID'],
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
    accountUrlLabel: 'island.tours/bookings',
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
    recommendationOneName: 'Palm Suite Apartment',
    recommendationOneImageUrl: 'https://cdn.test/rec.jpg',
    recommendationOneMeta: '4.8 · from $160',
    recommendationOneCtaLabel: 'See availability on Airbnb',
    recommendationOneUrl: 'https://www.airbnb.com/rooms/123',
    recommendationTwoName: '',
    recommendationTwoImageUrl: '',
    recommendationTwoMeta: '',
    recommendationTwoCtaLabel: '',
    recommendationTwoUrl: '',
    recommendationThreeName: '',
    recommendationThreeImageUrl: '',
    recommendationThreeMeta: '',
    recommendationThreeCtaLabel: '',
    recommendationThreeUrl: '',
    ...overrides,
  };
}

describe('booking-confirmation-email.template.html', () => {
  describe('100% style parity with the wireframe (founder requirement)', () => {
    // Every style="" attribute the wireframe's email template carries must appear
    // VERBATIM in the shipped template - font sizes, weights, families, colors,
    // spacing, everything. This is what "nothing skipped" means mechanically.
    it('carries every wireframe style attribute byte-for-byte', () => {
      const styles = [...WIREFRAME_EMAIL.matchAll(/style="([^"]*)"/g)]
        .map((m) => m[1])
        // Demo-only placeholder art: the gradient "featured img" boxes and their
        // badges are stand-ins that production replaces with real <img> tags of
        // identical dimensions/radius.
        .filter(
          (s) =>
            !s.includes('linear-gradient') && !s.includes('position:absolute'),
        )
        // The inline check-svg's own alignment; our PNG carries the same value
        // (asserted below) plus img-specific resets.
        .filter((s) => s !== 'vertical-align:middle')
        // The demo mounts the email in a canvas that provides the 26px vertical
        // padding; a real email folds it into this cell (26px 16px).
        .filter((s) => s !== 'padding:0 16px');

      expect(styles.length).toBeGreaterThan(80);
      const missing = [...new Set(styles)].filter((s) => !TEMPLATE.includes(s));
      expect(missing).toEqual([]);
    });

    it('keeps the canvas padding and check-icon alignment through the substitutions', () => {
      expect(TEMPLATE).toContain('padding:26px 16px');
      expect(TEMPLATE).toMatch(/icon-check-green[^>]*vertical-align:middle/);
    });

    it('declares the wireframe font stack on every block cell, not just the body', () => {
      // Email clients do not inherit font-family from <body> into tables - this
      // is exactly why the first shipped version rendered in Arial.
      const wireframeCells = (
        WIREFRAME_EMAIL.match(
          /font-family:'Plus Jakarta Sans',Arial,sans-serif/g,
        ) ?? []
      ).length;
      const templateCells = (
        TEMPLATE.match(/font-family:'Plus Jakarta Sans',Arial,sans-serif/g) ??
        []
      ).length;
      expect(templateCells).toBeGreaterThanOrEqual(wireframeCells);
    });

    it('is fluid exactly the way the wireframe is: width attr + max-width style, no media queries', () => {
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
    });

    it('keeps the payment divider row the first version dropped', () => {
      expect(TEMPLATE).toContain(
        '<tr><td colspan="2" style="border-top:1px solid #E8EAED;padding-top:8px;margin-top:4px"></td></tr>',
      );
    });
  });

  it('renders the operator-conditions recap ONLY for a flagged booking (Pastel #80)', () => {
    // Ungated (the whole catalog): the block must not exist at all.
    expect(renderEmailTemplate(TEMPLATE, ctx())).not.toContain(
      'Read the conditions',
    );

    const flagged = renderEmailTemplate(
      TEMPLATE,
      ctx({
        termsLine:
          "You accepted Miss Ann Boat Trips's operator conditions (version 1.0).",
        termsUrl:
          'https://island.tours/en/operators/miss-ann-boat-trips/conditions',
      }),
    );
    expect(flagged).toContain('operator conditions (version 1.0)');
    expect(flagged).toContain('/operators/miss-ann-boat-trips/conditions');
    expect(flagged).toContain('Read the conditions');

    // ACKNOWLEDGMENT flavor: a line with no document has no link either.
    const ack = renderEmailTemplate(
      TEMPLATE,
      ctx({
        termsLine:
          "At checkout you confirmed Miss Ann Boat Trips's participation requirements for everyone in your group.",
      }),
    );
    expect(ack).toContain('participation requirements');
    expect(ack).not.toContain('Read the conditions');
  });

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

  // ── C2 anti-phishing mitigation (WP-B: B-16/B-21) ─────────────────────────
  // The anti-fraud line must render for EVERY payment model and sit directly
  // under the "how to pay" foreshadow - above the fold of the payment area,
  // before the prepare/contact blocks (funnel wireframe, block 6).

  describe('anti-fraud line placement (C2)', () => {
    const CASES: ReadonlyArray<[string, EmailTemplateContext, string]> = [
      [
        'operator_link',
        { paymentModel: 'operator_link' },
        "We'll never ask you to send card details",
      ],
      [
        'on_arrival card_or_cash',
        { paymentModel: 'on_arrival', onArrivalPayment: 'card_or_cash' },
        "We'll never send a link to pay the balance",
      ],
      [
        'on_arrival cash_only',
        { paymentModel: 'on_arrival', onArrivalPayment: 'cash_only' },
        "We'll never send a link to pay the balance",
      ],
      [
        'paid_in_full',
        { paymentModel: 'paid_in_full' },
        'No one should ask you for further payment',
      ],
      [
        'operator_full',
        { paymentModel: 'operator_full' },
        "We'll never ask you to send card details",
      ],
    ];

    it.each(CASES)('%s renders its anti-fraud line', (_name, over, line) => {
      const html = renderEmailTemplate(TEMPLATE, ctx(over));
      expect(html).toContain(line);
    });

    it.each(CASES)(
      '%s keeps the line above the payment fold (after the pay box, before prepare)',
      (_name, over, line) => {
        const html = renderEmailTemplate(TEMPLATE, ctx(over));
        const shieldAt = html.indexOf('icon-shield-check.png');
        const lineAt = html.indexOf(line);
        const paymentAt = html.indexOf('>Payment<');
        const prepareAt = html.indexOf('What to bring');
        expect(paymentAt).toBeGreaterThan(-1);
        expect(lineAt).toBeGreaterThan(paymentAt);
        expect(shieldAt).toBeGreaterThan(paymentAt);
        expect(prepareAt).toBeGreaterThan(lineAt);
      },
    );
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
