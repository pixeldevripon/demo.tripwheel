import { Locale } from '@prisma/client';
import { MailService } from './mail.service';
import { REVIEW_REQUEST_COPY } from './templates/review-request-email.copy';
import type { ReviewRequestEmailInput } from './review-request-email.context';

/**
 * BK-3 / BK-3R RENDERING (review of #186, Major 1): the review-requests
 * service spec asserts only what it PASSES to this facade - these tests pin
 * what the facade actually renders and sends from it. A regression that swaps
 * the reminder copy for the first touch, drops the WhatsApp line, or loses the
 * locale would otherwise pass the entire suite.
 *
 * The facade renders the LOCKED template now (it used to funnel through the
 * shared notice shell), so these assertions run against real HTML.
 */
describe('MailService.sendReviewRequestEmail rendering', () => {
  let svc: MailService;
  let captured: Array<{
    to: string;
    subject: string;
    html: string;
    text: string;
  }>;

  const baseInput: ReviewRequestEmailInput = {
    firstName: 'Denley',
    tourName: 'Klein Curaçao Day Trip',
    operatorName: 'Miss Ann Boat Trips',
    bookingRef: 'IT-2026-04821',
    tourDate: new Date('2026-05-22T00:00:00.000Z'),
    tourImageUrl: 'https://cdn.test/klein-curacao.jpg',
    partyLines: ['2 adults', '1 child'],
    reviewUrl: 'https://island.tours/en/review/tok-1',
    siteLogoUrl: null,
    isReminder: false,
    whatsappOptIn: false,
    locale: Locale.en,
  };

  beforeEach(() => {
    svc = new MailService();
    captured = [];
    jest.spyOn(svc, 'sendMail').mockImplementation(async (options) => {
      captured.push({
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text ?? '',
      });
      return { providerMessageId: null };
    });
  });

  const en = REVIEW_REQUEST_COPY[Locale.en];
  const send = (over: Partial<ReviewRequestEmailInput> = {}) =>
    svc.sendReviewRequestEmail('t@example.com', { ...baseInput, ...over });

  it('first touch renders the BK-3 block copy and the wireframe subject', async () => {
    await send();
    const { html, subject } = captured[0];

    expect(subject).toBe(en.subject.replace('{tourName}', baseInput.tourName));
    expect(html).toContain('Hi Denley,');
    expect(html).toContain(en.greetingLine);
    expect(html).toContain(en.askBefore.trim());
    expect(html).toContain('<b style="color:#1F2937">Miss Ann Boat Trips</b>');
    expect(html).toContain(en.tapAStar);
    expect(html).toContain(en.signoffThanks);
    // Interpolation happened: no raw {token} survives anywhere.
    expect(html).not.toMatch(/\{[a-zA-Z][a-zA-Z0-9_.]*\}/);
    expect(html).not.toContain('[IF');
  });

  it('the preheader is the preview line, not a second copy of the subject', async () => {
    await send();
    expect(captured[0].html).toContain(en.preview);
    // The old notice shell used {noticeTitle} (the subject) as the preheader.
    const preheader = /opacity:0;color:transparent;">\s*([^<]*)/.exec(
      captured[0].html,
    );
    expect(preheader?.[1].trim()).toBe(en.preview);
  });

  it('reminder renders the DISTINCT BK-3R draft - not the BK-3 ask', async () => {
    await send({ isReminder: true });
    const { html, subject } = captured[0];

    expect(subject).toBe(
      en.reminderSubject.replace('{tourName}', baseInput.tourName),
    );
    expect(html).toContain('one small nudge from us');
    expect(html).toContain('this is the last time we ask');
    // The first-touch ask must not leak in.
    expect(html).not.toContain(en.askBefore.trim());
    // The reminder names the beneficiary (wireframe cue).
    expect(html).toContain('Miss Ann Boat Trips');
    // Paragraph 1 opens with the name, so there is no 22px greeting above it.
    expect(html).not.toContain(
      '<div style="font-size:22px;font-weight:800;letter-spacing:-.02em;color:#1F2937">Hi Denley,</div>',
    );
  });

  it('keeps the nine-block layout on the reminder too (stars and all)', async () => {
    await send({ isReminder: true });
    // Comments stripped: the design comments name the star glyph themselves.
    const html = captured[0].html.replace(/<!--[\s\S]*?-->/g, '');
    expect((html.match(/&#9733;/g) ?? []).length).toBe(5);
    expect(html).toContain(en.tapAStar);
    expect(html).toContain(en.signoffTeam);
    expect(html).toContain(en.disclosureVerified);
  });

  it('the WhatsApp line appears ONLY for reminder + opt-in', async () => {
    await send({ isReminder: true, whatsappOptIn: true });
    await send({ isReminder: true, whatsappOptIn: false });
    await send({ whatsappOptIn: true });

    const marker = en.reminderWhatsappLine.slice(0, 20);
    expect(captured[0].html).toContain(marker);
    expect(captured[1].html).not.toContain(marker);
    expect(captured[2].html).not.toContain(marker);
  });

  it('an absent operator name falls back to the neutral team wording', async () => {
    await send({ operatorName: '  ' });
    const { html } = captured[0];
    expect(html).toContain(en.operatorFallback);
    // ...but the booking card's operator LINE disappears rather than showing
    // a company that does not exist.
    expect(html).not.toContain(
      `<div style="font-size:13.5px;color:#6B7280;margin-top:5px">${en.operatorFallback}</div>`,
    );
  });

  it('locale drives the copy: de renders the German reminder subject', async () => {
    await send({ isReminder: true, locale: Locale.de });
    const de = REVIEW_REQUEST_COPY[Locale.de];
    expect(captured[0].subject).toBe(
      de.reminderSubject.replace('{tourName}', baseInput.tourName),
    );
    expect(captured[0].subject).not.toBe(
      en.reminderSubject.replace('{tourName}', baseInput.tourName),
    );
  });

  it('ships a plain-text part carrying the review link and no markup', async () => {
    await send();
    const { text } = captured[0];
    expect(text).toContain('https://island.tours/en/review/tok-1');
    expect(text).toContain('Friday, 22 May 2026 · 2 adults, 1 child');
    expect(text).not.toContain('<');
  });
});
