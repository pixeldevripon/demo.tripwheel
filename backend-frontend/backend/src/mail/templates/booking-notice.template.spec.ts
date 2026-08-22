import * as fs from 'fs';
import * as path from 'path';
import {
  findUnresolvedTokens,
  renderEmailTemplate,
  type EmailTemplateContext,
} from './email-template.renderer';

/**
 * The shared branded notice (cancellation ack, operator notices). Same rule as
 * the operator template: it reuses the traveller confirmation's shell and may
 * introduce no styling of its own.
 */
const TEMPLATE = fs.readFileSync(
  path.join(__dirname, 'booking-notice.template.html'),
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
    noticeTitle: 'We got your cancellation request.',
    bookingRef: 'IT-2026-04821',
    tourName: 'Klein Curacao Day Trip',
    dateLong: 'Friday, 22 May 2026',
    startTime: '08:00',
    noticeParagraphs: [
      'Your request is timestamped from the moment you submitted it.',
      "We're processing it now.",
    ],
    ctaUrl: 'https://island.tours/curacao/thank-you/pub-1',
    ctaLabel: 'View your booking',
    ...overrides,
  };
}

describe('booking-notice.template.html', () => {
  it('resolves every token and renders one div per paragraph', () => {
    expect(findUnresolvedTokens(TEMPLATE, ctx())).toEqual([]);
    const html = renderEmailTemplate(TEMPLATE, ctx());
    expect(html).not.toContain('[IF');
    expect(html).not.toMatch(/\{[a-zA-Z][a-zA-Z0-9_.]*\}/);
    expect(html).toContain('We got your cancellation request.');
    const paragraphs =
      html.match(
        /font-size:14px;color:#4B5563;line-height:1\.5;margin-bottom:12px/g,
      ) ?? [];
    expect(paragraphs).toHaveLength(2);
  });

  it('hides the CTA when there is no destination for it', () => {
    const html = renderEmailTemplate(
      TEMPLATE,
      ctx({ ctaUrl: '', ctaLabel: '' }),
    );
    expect(html).not.toContain('background:#E8611A;text-decoration:none');
  });

  it('introduces zero new style attributes vs the traveller shell', () => {
    const styles = [...TEMPLATE.matchAll(/style="([^"]*)"/g)].map((m) => m[1]);
    const foreign = [...new Set(styles)].filter(
      (s) => !TRAVELLER_TEMPLATE.includes(s),
    );
    expect(foreign).toEqual([]);
  });

  it('keeps the fluid shell, mobile spacing hooks, and no svg', () => {
    expect(TEMPLATE).toContain(
      'width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px',
    );
    expect(TEMPLATE).toContain('@media only screen and (max-width: 480px)');
    const classes = [...TEMPLATE.matchAll(/class="([^"]*)"/g)].map((m) => m[1]);
    expect([...new Set(classes)].sort()).toEqual(['it-cell', 'it-shell-pad']);
    expect(TEMPLATE).not.toContain('<svg');
  });
});
