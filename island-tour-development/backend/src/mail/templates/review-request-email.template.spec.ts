import * as fs from 'fs';
import * as path from 'path';
import { Locale } from '@prisma/client';
import {
  renderEmailTemplate,
  findUnresolvedTokens,
  type EmailTemplateContext,
} from './email-template.renderer';
import { REVIEW_REQUEST_COPY } from './review-request-email.copy';

/**
 * Guards the LOCKED BK-3 template against the funnel wireframe
 * (technical-doc/emails/island-tours-email-funnel-wireframe.html, the embedded
 * `tpl-review` block) - same pattern as the confirmation, reminder and MK-1
 * specs.
 *
 * Beyond style parity and token coverage this pins the two rules that are
 * invisible until they are broken in production: the five stars all point at
 * the plain review URL (founder decision - no `?rating=` pre-fill), and the
 * email carries NO unsubscribe, because BK-3 is transactional.
 */
const TEMPLATE = fs.readFileSync(
  path.join(__dirname, 'review-request-email.template.html'),
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
    /<template id="tpl-review">([\s\S]*?)<\/template>/,
  );
  if (!match) throw new Error('tpl-review template not found in the wireframe');
  return match[1];
})();

/**
 * The wireframe's CTA is one inline `<a>` carrying its own padding. Outlook
 * drops padding on an inline anchor, so the template splits the same
 * declarations across a `<td>` (fill, radius, padding) and the anchor (type,
 * colour). Parity is therefore asserted DECLARATION by declaration for this
 * one style rather than byte-for-byte.
 */
const BUTTON_STYLE =
  'display:inline-block;font-size:15px;font-weight:700;color:#fff;background:#E8611A;text-decoration:none;border-radius:10px;padding:13px 26px';

/**
 * Rendered HTML with the design comments stripped. The comments ship (the whole
 * family's do - they are where the "why" lives), but they also name the very
 * constructs these tests forbid: "position:absolute", "?rating=", "no
 * unsubscribe", the star glyph and a decision date. Asserting on the reader's
 * markup keeps a rule from passing or failing on prose.
 */
function body(overrides: EmailTemplateContext = {}): string {
  return renderEmailTemplate(TEMPLATE, ctx(overrides)).replace(
    /<!--[\s\S]*?-->/g,
    '',
  );
}

function ctx(overrides: EmailTemplateContext = {}): EmailTemplateContext {
  const en = REVIEW_REQUEST_COPY[Locale.en];
  return {
    locale: 'en',
    subjectLine: 'How was Klein Curaçao Day Trip?',
    previewText: en.preview,
    siteLogoUrl: 'https://cdn.test/logo.png',
    heroImageUrl: 'https://cdn.test/klein-curacao.jpg',
    heroSubline:
      'Supplied by Miss Ann Boat Trips · your trip, Friday, 22 May 2026',
    greeting: 'Hi Denley,',
    greetingLine: en.greetingLine,
    tourName: 'Klein Curaçao Day Trip',
    operatorName: 'Miss Ann Boat Trips',
    dateLong: 'Friday, 22 May 2026',
    partyBreakdown: '2 adults, 1 child',
    refLabel: en.refLabel,
    bookingRef: 'IT-2026-04821',
    askBefore: en.askBefore,
    askAfter: en.askAfter,
    operatorTeam: 'Miss Ann Boat Trips',
    extraParagraphs: [],
    tapAStar: en.tapAStar,
    reviewUrl: 'https://island.tours/en/review/tok-1',
    cta: en.cta,
    disclosureVerified: en.disclosureVerified,
    disclosurePublishAll: en.disclosurePublishAll,
    signoffThanks: en.signoffThanks,
    signoffTeam: en.signoffTeam,
    footerLine: en.footerLine.replace('{bookingRef}', 'IT-2026-04821'),
    ...overrides,
  };
}

describe('review-request-email.template.html', () => {
  describe('style parity with the funnel wireframe (locked design)', () => {
    it('carries every wireframe style attribute byte-for-byte', () => {
      const styles = [...WIREFRAME_EMAIL.matchAll(/style="([^"]*)"/g)]
        .map((m) => m[1])
        // Demo-only placeholder art (gradient hero + gradient thumbnail and
        // their badges) and the absolutely-positioned overlay, which Outlook
        // and Gmail do not honour - the head comment records the substitution.
        .filter(
          (s) =>
            !s.includes('linear-gradient') && !s.includes('position:absolute'),
        )
        // The overlay's text-shadow exists only to lift white type off a photo.
        // The title sits in a solid band here, so the shadow has no job.
        .map((s) => s.replace(';text-shadow:0 1px 8px rgba(0,0,0,.45)', ''))
        // The demo canvas provides the vertical padding; the real email folds
        // it into the shell cell (26px 16px), as the whole family does.
        .filter((s) => s !== 'padding:0 16px')
        // Asserted per-declaration below.
        .filter((s) => s !== BUTTON_STYLE);

      expect(styles.length).toBeGreaterThan(20);
      const missing = [...new Set(styles)].filter((s) => !TEMPLATE.includes(s));
      expect(missing).toEqual([]);
    });

    it('keeps every CTA declaration, just split across the td and the anchor', () => {
      for (const declaration of BUTTON_STYLE.split(';')) {
        expect(TEMPLATE).toContain(declaration);
      }
      // The fill is duplicated as an attribute for clients that drop the
      // style attribute on a table cell.
      expect(TEMPLATE).toContain('bgcolor="#E8611A"');
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

    it('ships no absolute positioning and no inline svg', () => {
      const markup = TEMPLATE.replace(/<!--[\s\S]*?-->/g, '');
      expect(markup).not.toContain('position:absolute');
      expect(markup).not.toContain('<svg');
    });
  });

  it('resolves every token for a full send', () => {
    expect(findUnresolvedTokens(TEMPLATE, ctx())).toEqual([]);
  });

  it('resolves every token across the variant matrix', () => {
    const variants: EmailTemplateContext[] = [
      {}, // the wireframe's rendered sample
      { siteLogoUrl: '' }, // wordmark brand bar
      { heroImageUrl: '' }, // tour with no image on file
      { operatorName: '' }, // no operator company name
      { partyBreakdown: '' }, // unit-priced booking, no age bands
      // BK-3R: no greeting heading, no single-paragraph ask
      {
        greeting: '',
        askBefore: '',
        askAfter: '',
        greetingLine: 'Hi Denley, one small nudge from us.',
        extraParagraphs: ['Second paragraph.', 'Third paragraph.'],
      },
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
    expect(html).not.toContain('[EACH');
    expect(html).not.toMatch(/\{[a-zA-Z][a-zA-Z0-9_.]*\}/);
  });

  describe('the nine locked blocks, in the wireframe order', () => {
    it('renders all nine and nothing between them out of order', () => {
      const html = body();
      const markers = [
        'alt="Island Tours"', // 1 brand bar
        'height:190px', // 2 hero band
        'Hi Denley,', // 3 greeting
        'background:#F7F8FA;border:1px solid #E8EAED;border-radius:12px', // 4 booking card
        'and the team. About thirty seconds is all it takes.', // 5 the ask
        'Tap a star to start', // 6 stars
        'Rate your tour', // 7 CTA
        'Masha danki, thank you from all of us.', // 8 sign-off
        'ITG B.V. (Island Tours Group)', // 9 footer
      ];
      const positions = markers.map((m) => html.indexOf(m));
      expect(positions.every((p) => p >= 0)).toBe(true);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    });

    it('the five stars all link PLAINLY at the review url (no ?rating=)', () => {
      const html = body();
      const stars = [
        ...html.matchAll(
          /<a href="([^"]*)" style="font-size:36px;color:#f5b301;text-decoration:none">&#9733;<\/a>/g,
        ),
      ];
      expect(stars).toHaveLength(5);
      for (const star of stars) {
        expect(star[1]).toBe('https://island.tours/en/review/tok-1');
      }
      expect(html).not.toContain('rating=');
    });

    it('the CTA points at the same review url as the stars', () => {
      const html = body();
      const hrefs = [...html.matchAll(/href="([^"]*review[^"]*)"/g)].map(
        (m) => m[1],
      );
      expect(hrefs).toHaveLength(6); // five stars + the worded button
      expect(new Set(hrefs).size).toBe(1);
    });

    it('carries NO unsubscribe anywhere - BK-3 is transactional', () => {
      const html = body();
      expect(html.toLowerCase()).not.toContain('unsubscribe');
      expect(html.toLowerCase()).not.toContain('opt out');
      expect(html.toLowerCase()).not.toContain('fewer emails');
      expect(html).toContain(
        'You are receiving this because you took a tour booked through Island Tours.',
      );
    });

    it('renders the date long-form, never the ISO slice that shipped', () => {
      const html = body();
      expect(html).toContain('Friday, 22 May 2026 &middot; 2 adults, 1 child');
      expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('drops the whole hero block AND the card thumbnail when the tour has no image', () => {
      const html = body({ heroImageUrl: '' });
      expect(html).not.toContain('height:190px');
      expect(html).not.toContain('<img src="" ');
      expect(html).not.toContain('width:96px;height:96px');
      // Everything else survives.
      expect(html).toContain('Hi Denley,');
      expect(html).toContain('Klein Curaçao Day Trip');
      expect(html).toContain('Tap a star to start');
    });

    it('drops the party half of the card line rather than a dangling separator', () => {
      const html = body({ partyBreakdown: '' });
      expect(html).toContain('>Friday, 22 May 2026</div>');
      expect(html).not.toContain('Friday, 22 May 2026 &middot; <');
    });

    it('removes the notice shell chrome the wireframe does not have', () => {
      // The four-block shell's headline icon, subject-as-headline, standalone
      // reference line and www/transactional footer trio are all gone.
      const markup = TEMPLATE.replace(/<!--[\s\S]*?-->/g, '');
      expect(markup).not.toContain('icon-check-green');
      expect(markup).not.toContain('noticeTitle');
      expect(markup).not.toContain('www.island.tours');
      expect(markup).not.toContain('This is a transactional booking email.');
      expect(markup).not.toContain('emailIconBase');
    });
  });
});
