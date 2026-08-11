import * as fs from 'fs';
import * as path from 'path';
import { Locale } from '@prisma/client';
import {
  renderEmailTemplate,
  findUnresolvedTokens,
  type EmailTemplateContext,
} from './email-template.renderer';
import { NEXT_ADVENTURE_COPY } from './next-adventure-email.copy';

/**
 * Guards the LOCKED MK-1 template against the funnel wireframe
 * (technical-doc/emails/island-tours-email-funnel-wireframe.html, the
 * embedded `tpl-next` block) — same pattern as the confirmation and
 * reminder specs (G-09).
 *
 * Beyond style parity and token coverage, this template carries the
 * wireframe's HARD negative rules (G-05): an AVAILABILITY email with no
 * discount, no countdown and no scarcity anywhere — asserted on the
 * RENDERED html and on every locale's copy strings, so a future copy edit
 * cannot smuggle "20% off" past the design lock.
 */
const TEMPLATE = fs.readFileSync(
  path.join(__dirname, 'next-adventure-email.template.html'),
  'utf8',
);

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
    /<template id="tpl-next">([\s\S]*?)<\/template>/,
  );
  if (!match) throw new Error('tpl-next template not found in the wireframe');
  return match[1];
})();

const ICON_BASE =
  'https://res.cloudinary.com/test/image/upload/f_png,w_34/islandtours/email/icons';

function card(prefix: string, over: Record<string, string> = {}) {
  return {
    [`${prefix}Url`]: `https://site.test/en/curacao/${prefix}-tour/`,
    [`${prefix}ImageUrl`]: `https://cdn.test/${prefix}.jpg`,
    [`${prefix}Name`]: `${prefix} tour`,
    [`${prefix}MetaPrefix`]: '★ 4.8 (212) · 4 hrs · from ',
    [`${prefix}Price`]: '$89',
    [`${prefix}OpenDays`]: 'Open: Thu, Fri, Sat',
    [`${prefix}Line`]:
      'You have been on the water. This is the land version of it.',
    ...over,
  };
}

function ctx(overrides: EmailTemplateContext = {}): EmailTemplateContext {
  return {
    locale: 'en',
    subjectLine: 'Where our guides send people after Klein Curacao Day Trip',
    previewText:
      'Three with spots open this week. Already home? Save them for next time.',
    emailIconBase: ICON_BASE,
    siteLogoUrl: 'https://cdn.test/logo.png',
    headline: 'Still have days left on the island?',
    introBeforeTourName:
      'These three have open departures this week, and they are the ones we would send our own friends to after ',
    bookedTourName: 'Klein Curacao Day Trip',
    introAfterTourName: '.',
    alreadyHome: 'Already home? Save them for the next trip.',
    ...card('cardOne'),
    ...card('cardTwo', {
      cardTwoOpenDays: 'Open: daily',
      cardTwoMetaPrefix: '★ 4.7 (138) · 3 hrs · from ',
      cardTwoPrice: '$65',
    }),
    ...card('cardThree', {
      cardThreeMetaPrefix: '★ 4.9 (486) · 2.5 hrs · from ',
      cardThreePrice: '$75',
    }),
    seeTimes: 'See times',
    fillNote: 'Most boats leave before 8am and fill up a day or two ahead.',
    allToursUrl: 'https://site.test/en/curacao/tours/',
    seeAllLabel: 'See all 25 tours on Curacao',
    rescheduleBold: 'Free reschedule up to 24 hours before departure.',
    rescheduleRest: 'Plans on a holiday change. That is fine.',
    footerBeforeTourName: 'You are getting this because you booked ',
    footerAfterTourName:
      ' with Island Tours. Your booking emails always arrive.',
    unsubscribeUrl: 'https://site.test/unsubscribe/tok-123',
    unsubscribeLabel: 'Unsubscribe',
    fewerEmailsLabel: 'Get fewer emails',
    ...overrides,
  };
}

/**
 * G-05 vocabulary bans, applied to the rendered HTML and to every locale's
 * copy module strings. The scan is English because the TEMPLATE and its
 * literal chrome are English-locked; per-locale strings are additionally
 * scanned for the universal markers (%, digits-off, countdown timers).
 */
const FORBIDDEN = [
  /discount/i,
  /promo\s*code/i,
  /coupon/i,
  /voucher/i,
  /\d+\s*%\s*(off|korting|rabatt)/i,
  /sale\b/i,
  /countdown/i,
  /hurry/i,
  /last\s+chance/i,
  /expires?\s+(in|at|soon)/i,
  /only\s+\d+\s+(spots?|seats?|places?|left)/i,
  /\d+\s+spots?\s+left/i,
  /selling\s+out/i,
  /almost\s+full/i,
];

describe('next-adventure-email.template.html', () => {
  describe('style parity with the funnel wireframe (locked design)', () => {
    it('carries every wireframe style attribute byte-for-byte', () => {
      const styles = [...WIREFRAME_EMAIL.matchAll(/style="([^"]*)"/g)]
        .map((m) => m[1])
        // Demo-only placeholder art (gradient thumbnails + their badges).
        .filter(
          (s) =>
            !s.includes('linear-gradient') && !s.includes('position:absolute'),
        )
        // The demo canvas provides the vertical padding; the real email folds
        // it into the shell cell (26px 16px), as the whole family does.
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

  it('resolves every token for a full three-card send', () => {
    expect(findUnresolvedTokens(TEMPLATE, ctx())).toEqual([]);
  });

  it('resolves every token across the variant matrix', () => {
    const variants: EmailTemplateContext[] = [
      {}, // the wireframe's rendered sample
      { siteLogoUrl: '' }, // wordmark brand bar
      { cardOneLine: '', cardTwoLine: '', cardThreeLine: '' }, // no teasers
      { cardOneMetaPrefix: '', cardOnePrice: '' }, // cold-start unpriced card
      { cardTwoImageUrl: '' }, // no hero image on file
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

  describe('the locked MK-1 blocks (G-04)', () => {
    it('renders headline, three cards, see-all, free-reschedule, sign-off and footer', () => {
      const html = renderEmailTemplate(TEMPLATE, ctx());
      expect(html).toContain('Still have days left on the island?');
      expect((html.match(/See times &rsaquo;/g) ?? []).length).toBe(3);
      expect(html).toContain('cardOne tour');
      expect(html).toContain('cardTwo tour');
      expect(html).toContain('cardThree tour');
      expect(html).toContain('Open: daily');
      expect(html).toContain('See all 25 tours on Curacao &rsaquo;');
      expect(html).toContain(
        '<b style="color:#1F2937">Free reschedule up to 24 hours before departure.</b>',
      );
      // The wireframe-exact personal sign-off.
      expect(html).toContain(
        'Shanice<br><span style="color:#9aa3b2;font-size:13px">Island Tours · Willemstad, Curaçao</span>',
      );
      expect(html).toContain('Built by Islanders.');
    });

    it('bolds the booked tour name in the intro and in the footer provenance line', () => {
      const html = renderEmailTemplate(TEMPLATE, ctx());
      expect(html).toContain(
        'after <b style="color:#1F2937">Klein Curacao Day Trip</b>.',
      );
      expect(html).toContain(
        'You are getting this because you booked <b style="color:#6B7280">Klein Curacao Day Trip</b> with Island Tours. Your booking emails always arrive.',
      );
    });

    it('links both footer actions to the tokenized unsubscribe URL (G-14)', () => {
      const html = renderEmailTemplate(TEMPLATE, ctx());
      const links = [
        ...html.matchAll(/href="https:\/\/site\.test\/unsubscribe\/tok-123"/g),
      ];
      expect(links).toHaveLength(2); // Unsubscribe · Get fewer emails
      expect(html).toContain('>Unsubscribe</a>');
      expect(html).toContain('>Get fewer emails</a>');
    });

    it('every href is a tour card, see-all, or unsubscribe - no payment, no cancel', () => {
      const html = renderEmailTemplate(TEMPLATE, ctx());
      const hrefs = [...html.matchAll(/href="([^"]*)"/g)]
        .map((m) => m[1])
        .filter((h) => !h.startsWith('https://fonts.'));
      for (const href of hrefs) {
        expect(href).toMatch(/^https:\/\/site\.test\//);
        expect(href).not.toMatch(/pay|cancel|checkout/i);
      }
    });

    it('hides a card teaser line without leaving an empty grey row', () => {
      const html = renderEmailTemplate(TEMPLATE, ctx({ cardOneLine: '' }));
      // The teaser row style appears once per card WITH a teaser - two here.
      const teaserRows =
        html.match(
          /font-size:12\.5px;color:#6B7280;line-height:1\.5;margin-top:7px/g,
        ) ?? [];
      expect(teaserRows).toHaveLength(2);
      // The other two cards keep their text.
      expect((html.match(/You have been on the water/g) ?? []).length).toBe(2);
    });
  });

  describe('the hard negative rules (G-05): no discount, no countdown, no scarcity', () => {
    it('the raw template carries none of the banned vocabulary', () => {
      for (const pattern of FORBIDDEN) {
        expect(TEMPLATE).not.toMatch(pattern);
      }
    });

    it('a fully rendered English send carries none of the banned vocabulary', () => {
      const html = renderEmailTemplate(TEMPLATE, ctx());
      for (const pattern of FORBIDDEN) {
        expect(html).not.toMatch(pattern);
      }
    });

    it('no locale copy string smuggles a discount/countdown/scarcity marker in', () => {
      for (const locale of Object.values(Locale)) {
        const copy = NEXT_ADVENTURE_COPY[locale];
        const all = Object.values(copy).join('\n');
        for (const pattern of FORBIDDEN) {
          expect(all).not.toMatch(pattern);
        }
        // No percentage anywhere in marketing copy - the cheapest universal
        // discount marker across all seven languages.
        expect(all).not.toContain('%');
      }
    });

    it('keeps subject B in the copy module for the future A/B arm (G-08)', () => {
      for (const locale of Object.values(Locale)) {
        expect(NEXT_ADVENTURE_COPY[locale].subjectB.length).toBeGreaterThan(0);
        expect(NEXT_ADVENTURE_COPY[locale].subjectB).toContain('{island}');
      }
      // ...and it is genuinely unused: the template knows no subjectB token.
      expect(TEMPLATE).not.toContain('subjectB');
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

  describe('icons render as Cloudinary pngs (no inline svg)', () => {
    it('the reschedule chip is the one icon, with an empty alt', () => {
      const html = renderEmailTemplate(TEMPLATE, ctx());
      expect(html).toContain(`${ICON_BASE}/icon-reschedule-green.png`);
      const iconImgs = html.match(/<img[^>]*email\/icons[^>]*>/g) ?? [];
      expect(iconImgs).toHaveLength(1);
      for (const img of iconImgs) expect(img).toContain('alt=""');
    });
  });
});
