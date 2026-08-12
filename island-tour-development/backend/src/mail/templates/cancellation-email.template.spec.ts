import * as fs from 'fs';
import * as path from 'path';
import {
  renderEmailTemplate,
  findUnresolvedTokens,
  type EmailTemplateContext,
} from './email-template.renderer';

/**
 * Guards the LOCKED CX-1 template against the funnel wireframe's `tpl-cancel`
 * block - same pattern as the confirmation and reminder specs.
 *
 * `tpl-cancel` is explicitly a COPY MOCK ("no wireframe built for this email
 * yet"), and the founder's instruction on 2026-08-12 was to match it. So the
 * negatives matter as much as the positives here: no green check chip, no CTA,
 * one sub-line, and a real preheader instead of the subject repeated.
 */
const TEMPLATE = fs.readFileSync(
  path.join(__dirname, 'cancellation-email.template.html'),
  'utf8',
);

/**
 * The design source: `tpl-cancel`, CUT before its footer.
 *
 * The mock's footer carries a BUILD NOTE ("Copy locked in master 6.4 · payment
 * -model aware · no wireframe built for this email yet"), not shippable copy -
 * so CX-1 keeps BK-1's transactional sign-off in the mock's cell padding and
 * separator shape instead (spec block 8). Everything above the cut is locked.
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
    /<template id="tpl-cancel">([\s\S]*?)<\/template>/,
  );
  if (!match) throw new Error('tpl-cancel template not found in the wireframe');
  const cut = match[1].indexOf('Copy locked in master 6.4');
  if (cut === -1) throw new Error('footer build-note marker not found');
  const trStart = match[1].lastIndexOf('<tr>', cut);
  return match[1].slice(0, trStart);
})();

function ctx(overrides: EmailTemplateContext = {}): EmailTemplateContext {
  return {
    locale: 'en',
    subjectLine: 'Your booking is cancelled',
    previewText: 'Refund on its way. No forms, no questions asked.',
    emailIconBase:
      'https://res.cloudinary.com/test/image/upload/f_png,w_34/islandtours/email/icons',
    siteLogoUrl: 'https://cdn.test/logo.png',
    noticeTitle: 'Your booking is cancelled',
    tourName: 'Klein Curacao Day Trip',
    dateLong: 'Friday, 22 May 2026',
    refLabel: 'Booking reference:',
    bookingRef: 'IT-2026-04821',
    lead: 'Plans change. No problem.',
    refundTitle: 'Your refund',
    refundLine:
      "Your 20% deposit is on its way back from us, within 3 to 5 business days, to your original payment method. If you've already paid the balance, the tour operator refunds that part.",
    ...overrides,
  };
}

describe('cancellation-email.template.html', () => {
  describe('style parity with the funnel wireframe mock (locked design)', () => {
    it('carries every wireframe style attribute byte-for-byte', () => {
      const styles = [...WIREFRAME_EMAIL.matchAll(/style="([^"]*)"/g)]
        .map((m) => m[1])
        // The demo canvas provides the vertical padding; the real email folds
        // it into the shell cell (26px 16px), as the whole family does.
        .filter((s) => s !== 'padding:0 16px');

      expect(styles.length).toBeGreaterThan(10);
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

    it('keeps the mock footer cell padding and separator shape', () => {
      expect(TEMPLATE).toContain('padding:24px 28px 26px');
      expect(TEMPLATE).toContain(
        '<div style="height:1px;background:#E8EAED;margin-bottom:16px"></div>',
      );
    });
  });

  it('resolves every token and leaves no unrendered markup', () => {
    expect(findUnresolvedTokens(TEMPLATE, ctx())).toEqual([]);
    const html = renderEmailTemplate(TEMPLATE, ctx());
    expect(html).not.toContain('[IF');
    expect(html).not.toContain('[ELSE]');
    expect(html).not.toContain('[/IF]');
    expect(html).not.toMatch(/\{[a-zA-Z][a-zA-Z0-9_.]*\}/);
  });

  it('ships zero inline svg (LD20 - Gmail strips it, Outlook never had it)', () => {
    expect(TEMPLATE).not.toContain('<svg');
  });

  describe('the negatives the mock is explicit about', () => {
    it('has NO CTA - no button, no link back into the cancelled booking', () => {
      const html = renderEmailTemplate(TEMPLATE, ctx());
      // Every href in the body is a font link from the head; nothing else.
      const hrefs = [...html.matchAll(/href="([^"]*)"/g)]
        .map((m) => m[1])
        .filter((h) => !h.startsWith('https://fonts.'));
      expect(hrefs).toEqual([]);
      expect(html).not.toContain('View your booking');
      expect(html).not.toContain('/thank-you/');
      // The family's CTA styling must not be here at all.
      expect(TEMPLATE).not.toContain('background:#E8611A;text-decoration:none');
    });

    it('has NO green check chip - a cancellation is not a success', () => {
      const html = renderEmailTemplate(TEMPLATE, ctx());
      expect(html).not.toContain('icon-check-green');
      expect(html).not.toContain('#E7F6ED');
      // And no icon at all rides beside the headline.
      expect(html).not.toMatch(/<img[^>]*email\/icons[^>]*>/);
    });

    it('renders ONE 13.5px sub-line, not a ref line plus a tour block', () => {
      const html = renderEmailTemplate(TEMPLATE, ctx());
      expect(html).toContain(
        'Klein Curacao Day Trip · Friday, 22 May 2026 · Booking reference: <b style="color:#1F2937">IT-2026-04821</b>',
      );
      // The shared shell's 17px tour title and its divider are both gone.
      expect(html).not.toContain('font-size:17px');
      expect(html).not.toContain('height:1px;background:#E8EAED;margin:16px 0');
    });

    it('has a real preheader, not the subject repeated', () => {
      const html = renderEmailTemplate(TEMPLATE, ctx());
      const preheader = html.match(
        /<div style="display:none[^"]*">\s*([^<]*)</,
      )?.[1];
      expect(preheader?.trim()).toBe(
        'Refund on its way. No forms, no questions asked.',
      );
      expect(preheader?.trim()).not.toBe('Your booking is cancelled');
    });

    it('renders no processed and no closing paragraph', () => {
      const html = renderEmailTemplate(TEMPLATE, ctx());
      expect(html).not.toContain('We have processed your request');
      expect(html).not.toContain('Nothing further is needed from you');
      expect(TEMPLATE).not.toContain('[EACH noticeParagraphs]');
    });
  });

  describe('the titled refund panel', () => {
    it('renders the label and body in the mock shape', () => {
      const html = renderEmailTemplate(TEMPLATE, ctx());
      expect(html).toContain(
        'letter-spacing:.06em;color:#9aa3b2;margin-bottom:8px">Your refund</div>',
      );
      expect(html).toContain(
        'background:#F7F8FA;border:1px solid #E8EAED;border-radius:12px;padding:16px 18px',
      );
      expect(html).toContain('Your 20% deposit is on its way back from us');
    });

    it('renders whatever refund branch the builder composed, verbatim', () => {
      const html = renderEmailTemplate(
        TEMPLATE,
        ctx({
          refundLine:
            'Nothing was paid to Island Tours for this booking. Already paid the operator? Then Miss Ann Boat Trips refunds you directly.',
        }),
      );
      const panelBody = html.match(
        /font-size:14\.5px;color:#374151;line-height:1\.6">([^<]*)</,
      )?.[1];
      expect(panelBody).toContain('Nothing was paid to Island Tours');
      expect(panelBody).not.toContain('deposit');
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
