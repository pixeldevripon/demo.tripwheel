import * as fs from 'fs';
import * as path from 'path';
import {
  renderEmailTemplate,
  findUnresolvedTokens,
  type EmailTemplateContext,
} from './email-template.renderer';

/**
 * Guards the LOCKED pre-tour reminder template against the funnel wireframe
 * (technical-doc/emails/island-tours-email-funnel-wireframe.html, the
 * embedded `tpl-remind` block) - same pattern as the confirmation spec.
 *
 * Beyond token coverage and orphan icons, this template carries the
 * wireframe's HARD negative rules (checklist B-02): no payment link, no
 * cancellation CTA, no balance nudge beyond the single note, zero-amount
 * lines hidden. Those are asserted on the RENDERED html, per payment model.
 */
const TEMPLATE = fs.readFileSync(
  path.join(__dirname, 'pre-tour-reminder-email.template.html'),
  'utf8',
);

/**
 * The design source: `tpl-remind` inside the funnel wireframe, CUT before the
 * "Islanders also love" cross-sell rail. That rail is soft-opt-in MARKETING
 * inventory inside a transactional email - it needs the consent gate and the
 * unsubscribe surface that WP-G owns, so WP-B ships the reminder without it
 * (deviation declared in the PR). Everything above the cut is locked here.
 */
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
      'island-tours-email-funnel-wireframe.html',
    ),
    'utf8',
  );
  const match = wireframe.match(
    /<template id="tpl-remind">([\s\S]*?)<\/template>/,
  );
  if (!match) throw new Error('tpl-remind template not found in the wireframe');
  const cut = match[1].indexOf('Islanders also love');
  if (cut === -1) throw new Error('cross-sell rail marker not found');
  // Back up to the start of the rail's own <tr> so no rail styles leak in.
  const trStart = match[1].lastIndexOf('<tr>', cut);
  return match[1].slice(0, trStart);
})();

const ICON_BASE =
  'https://res.cloudinary.com/test/image/upload/f_png,w_34/islandtours/email/icons';

/** Icons that render on every reminder regardless of optional fields. */
const ALWAYS_ICONS = ['icon-clock-orange', 'icon-pin', 'icon-users'];

function ctx(overrides: EmailTemplateContext = {}): EmailTemplateContext {
  return {
    locale: 'en',
    subjectLine: 'Tomorrow: Klein Curacao Day Trip · 08:00',
    previewText:
      'Pickup at 07:15 from Hotel Brion. Your reference, what to bring, and who to call.',
    emailIconBase: ICON_BASE,
    siteLogoUrl: 'https://cdn.test/logo.png',
    headline: "You're set for tomorrow, Denley.",
    subLinePrefix: 'Klein Curacao Day Trip · tomorrow at',
    startTime: '08:00',
    localTimeSuffix: '(local time)',
    refLabel: 'Booking reference:',
    bookingRef: 'IT-2026-04821',
    tourName: 'Klein Curacao Day Trip',
    operatorName: 'Miss Ann Boat Trips',
    featuredImageUrl: 'https://cdn.test/hero.jpg',
    dateLong: 'Friday, 22 May 2026',
    hasPickup: true,
    pickupLabel: 'Pickup:',
    pickupLocation: 'Hotel Brion',
    beReadyAt: 'be ready at',
    pickupTime: '07:15',
    meetingPointLabel: 'Meeting point:',
    meetingPoint: 'Sint Annabaai Pier',
    arriveEarlyLine: 'Please arrive 15 minutes early.',
    mapUrl: 'https://maps.test/x',
    openInMaps: 'Open in Maps',
    partyBreakdown: '2 adults, 1 child',
    durationLine: 'Duration: 9 hours, back around 17:00',
    whatToBringTitle: 'What to bring',
    whatToBring: [
      'Towel and swimwear',
      'Reef-safe sunscreen (protects the coral and your skin)',
      'A light jacket for the crossing',
    ],
    balanceTitle: 'Remaining balance',
    balanceNote:
      "Your remaining balance of $160.00 runs through Miss Ann Boat Trips's payment link. Already paid? You're all set. Not yet? Find the link in their email, or contact them below.",
    weatherDependent: true,
    weatherNote:
      'Miss Ann Boat Trips watches the weather and contacts you directly if conditions force a change. If the operator cancels: a full refund or a free reschedule, always.',
    questionsTitle: 'Questions about tomorrow?',
    talkToLocals: 'Talk to the locals running it:',
    operatorPhone: '+599 9 123 4567',
    operatorEmail: 'reservation@missannboattrips.com',
    platformIssue: 'Booking or platform issue?',
    whatsappUrl: 'https://wa.me/59995601367',
    whatsappUs: 'WhatsApp us',
    supportHours: ', daily 08:00 to 20:00.',
    ...overrides,
  };
}

/** The non-operator_link models: the balance note must vanish (builder rule). */
const NO_BALANCE = { balanceNote: '' };

describe('pre-tour-reminder-email.template.html', () => {
  describe('style parity with the funnel wireframe (locked design)', () => {
    it('carries every wireframe style attribute byte-for-byte', () => {
      const styles = [...WIREFRAME_EMAIL.matchAll(/style="([^"]*)"/g)]
        .map((m) => m[1])
        // Demo-only placeholder art (gradient thumbnails + their badges).
        .filter(
          (s) =>
            !s.includes('linear-gradient') && !s.includes('position:absolute'),
        )
        // The inline svg alignment; our PNG carries the same value plus
        // img-specific resets (same filter as the confirmation spec).
        .filter((s) => s !== 'vertical-align:middle')
        // The demo canvas provides the vertical padding; the real email folds
        // it into the shell cell (26px 16px), as the confirmation does.
        .filter((s) => s !== 'padding:0 16px');

      expect(styles.length).toBeGreaterThan(30);
      const missing = [...new Set(styles)].filter((s) => !TEMPLATE.includes(s));
      expect(missing).toEqual([]);
    });

    it('keeps the shell fluid the way the family is: width attr + max-width, one media query', () => {
      expect(TEMPLATE).toContain(
        'width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px',
      );
      const media = TEMPLATE.match(/@media[^{]*\{/g) ?? [];
      expect(media).toHaveLength(1);
      const classes = [...TEMPLATE.matchAll(/class="([^"]*)"/g)].map(
        (m) => m[1],
      );
      expect([...new Set(classes)].sort()).toEqual(['it-cell', 'it-shell-pad']);
    });
  });

  it('resolves every token for a full operator_link pickup booking', () => {
    expect(findUnresolvedTokens(TEMPLATE, ctx())).toEqual([]);
  });

  it('resolves every token across the variant matrix', () => {
    const variants: EmailTemplateContext[] = [
      {}, // operator_link with pickup (the wireframe's rendered sample)
      NO_BALANCE, // on_arrival / paid_in_full / operator_full (note hidden)
      { hasPickup: false }, // meeting-point booking
      { weatherDependent: false }, // not weather dependent
      { startTime: '', durationLine: '' }, // time-less legacy snapshot
      { whatToBring: [] }, // nothing to bring
      { operatorPhone: '', operatorEmail: '' }, // no operator contact on file
      { whatsappUrl: '' }, // WhatsApp support off
    ];
    for (const v of variants) {
      expect(findUnresolvedTokens(TEMPLATE, ctx(v))).toEqual([]);
    }
  });

  it('leaves no unrendered conditional or token markup', () => {
    const html = renderEmailTemplate(TEMPLATE, ctx());
    expect(html).not.toContain('[IF');
    expect(html).not.toContain('[ELSE]');
    expect(html).not.toContain('[/IF]');
    expect(html).not.toMatch(/\{[a-zA-Z][a-zA-Z0-9_.]*\}/);
  });

  it('ships zero inline svg (LD20 - Gmail strips it, Outlook never had it)', () => {
    expect(TEMPLATE).not.toContain('<svg');
  });

  describe('the hard negative rules (B-02)', () => {
    it('carries NO payment link and NO cancellation CTA in any variant', () => {
      for (const v of [{}, NO_BALANCE, { hasPickup: false }]) {
        const html = renderEmailTemplate(TEMPLATE, ctx(v));
        // Every href is logistics or contact - nothing else.
        // (head font links aside) every href is logistics or contact.
        const hrefs = [...html.matchAll(/href="([^"]*)"/g)]
          .map((m) => m[1])
          .filter((h) => !h.startsWith('https://fonts.'));
        for (const href of hrefs) {
          expect(href).toMatch(
            /^(https:\/\/maps\.test|https:\/\/wa\.me|tel:|mailto:)/,
          );
        }
        // No cancellation CTA. (The word "cancels" legitimately appears in
        // the weather note - the rule bans the ACTION, not the vocabulary.)
        expect(html).not.toMatch(/cancel booking|cancel your booking/i);
        for (const href of hrefs) expect(href).not.toMatch(/cancel/i);
        expect(html).not.toMatch(/pay now|pay the balance here/i);
      }
    });

    it('hides the balance block entirely when the note is empty (zero amount / other models)', () => {
      const html = renderEmailTemplate(TEMPLATE, ctx(NO_BALANCE));
      expect(html).not.toContain('Remaining balance');
      expect(html).not.toContain('payment link');
    });

    it('the operator_link note never claims "all paid" unconditionally', () => {
      const html = renderEmailTemplate(TEMPLATE, ctx());
      // The wireframe's exact framing: "Already paid? You're all set." is a
      // conditional, not a status claim.
      expect(html).toContain('Already paid?');
    });

    it('renders the weather block only on weather-dependent tours', () => {
      const on = renderEmailTemplate(TEMPLATE, ctx());
      const off = renderEmailTemplate(
        TEMPLATE,
        ctx({ weatherDependent: false }),
      );
      expect(on).toContain('watches the weather');
      expect(on).toContain('icon-cloud.png');
      expect(off).not.toContain('watches the weather');
      expect(off).not.toContain('icon-cloud.png');
    });
  });

  describe('icons render as Cloudinary pngs and hide with their rows', () => {
    it('a full reminder renders the full icon set with empty alts', () => {
      const html = renderEmailTemplate(TEMPLATE, ctx());
      for (const icon of [...ALWAYS_ICONS, 'icon-clock', 'icon-cloud']) {
        expect(html).toContain(`${ICON_BASE}/${icon}.png`);
      }
      const iconImgs = html.match(/<img[^>]*email\/icons[^>]*>/g) ?? [];
      expect(iconImgs).toHaveLength(5);
      for (const img of iconImgs) expect(img).toContain('alt=""');
    });

    it('duration row hides with its clock icon', () => {
      const html = renderEmailTemplate(TEMPLATE, ctx({ durationLine: '' }));
      expect(html).not.toContain('/icon-clock.png');
      // The headline chip is a DIFFERENT asset and must survive.
      expect(html).toContain('/icon-clock-orange.png');
    });

    it('a minimal reminder keeps only the always-on icons', () => {
      const html = renderEmailTemplate(
        TEMPLATE,
        ctx({ durationLine: '', weatherDependent: false, whatToBring: [] }),
      );
      for (const icon of ALWAYS_ICONS) {
        expect(html).toContain(`${ICON_BASE}/${icon}.png`);
      }
      expect(html).not.toContain('/icon-clock.png');
      expect(html).not.toContain('/icon-cloud.png');
    });
  });

  describe('pickup vs meeting point', () => {
    it('pickup bookings bold the be-ready time inside the pickup row', () => {
      const html = renderEmailTemplate(TEMPLATE, ctx());
      expect(html).toContain('Pickup: Hotel Brion');
      expect(html).toContain('<b style="color:#1F2937">be ready at 07:15</b>');
      expect(html).not.toContain('Meeting point:');
    });

    it('meeting-point bookings swap in the arrive-early line', () => {
      const html = renderEmailTemplate(TEMPLATE, ctx({ hasPickup: false }));
      expect(html).toContain('Meeting point: Sint Annabaai Pier');
      expect(html).toContain('Please arrive 15 minutes early.');
      expect(html).not.toContain('be ready at');
    });
  });

  describe('brand bar', () => {
    it('renders the settings logo when set, the wordmark otherwise', () => {
      const withLogo = renderEmailTemplate(TEMPLATE, ctx());
      expect(withLogo).toContain('<img src="https://cdn.test/logo.png"');
      expect(withLogo).not.toContain('>ISLAND <');

      const noLogo = renderEmailTemplate(TEMPLATE, ctx({ siteLogoUrl: '' }));
      expect(noLogo).toContain('>ISLAND <');
      expect(noLogo).toContain('#E8611A');
    });
  });
});
