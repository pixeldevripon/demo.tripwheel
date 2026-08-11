import { Locale } from '@prisma/client';
import { MailService } from './mail.service';
import { REVIEW_REQUEST_COPY } from './templates/review-request-email.copy';

/**
 * BK-3 / BK-3R RENDERING (review of #186, Major 1): the review-requests
 * service spec asserts only what it PASSES to this facade - these tests pin
 * what the facade actually renders from it. A regression that swaps the
 * paragraph arrays, drops the WhatsApp line, or loses the locale would
 * otherwise pass the entire suite.
 */
describe('MailService.sendReviewRequestEmail rendering', () => {
  let svc: MailService;
  let captured: Array<{
    to: string;
    subject: string;
    context: Record<string, unknown>;
    text: string;
  }>;

  const baseContext = {
    firstName: 'Denley',
    tourName: 'Klein Curaçao Day Trip',
    bookingRef: 'IT-2026-04821',
    dateLong: 'Fri, 22 May 2026',
    startTime: '08:00',
    reviewUrl: 'https://island.tours/en/review/tok-1',
    emailIconBase: 'https://res.cloudinary.com/x/icons',
    operatorName: 'Miss Ann Boat Trips',
  };

  beforeEach(() => {
    svc = new MailService();
    captured = [];
    jest
      .spyOn(svc, 'sendBookingNoticeEmail')
      .mockImplementation(async (to, subject, context, text) => {
        captured.push({
          to,
          subject,
          context: context,
          text: text ?? '',
        });
        return { providerMessageId: null };
      });
  });

  const en = REVIEW_REQUEST_COPY[Locale.en];
  const paragraphsOf = (i = 0) =>
    captured[i].context.noticeParagraphs as string[];

  it('first touch renders the BK-3 paragraph set (with the sign-off as body copy)', async () => {
    await svc.sendReviewRequestEmail('t@example.com', baseContext);
    const rendered = paragraphsOf();
    expect(rendered).toHaveLength(en.paragraphs.length + 1);
    expect(rendered[rendered.length - 1]).toBe(en.textSignoff);
    // Interpolation happened: no raw {token} survives. (BK-3's decided copy
    // deliberately does NOT name the operator - only BK-3R does.)
    expect(rendered.join(' ')).not.toMatch(/\{\w+\}/);
    expect(captured[0].subject).toBe(
      en.subject.replace('{tourName}', baseContext.tourName),
    );
  });

  it('reminder renders the DISTINCT BK-3R set - not the BK-3 paragraphs', async () => {
    await svc.sendReviewRequestEmail('t@example.com', {
      ...baseContext,
      isReminder: true,
    });
    const rendered = paragraphsOf();
    // Distinct copy (B-10): reminder paragraphs + reminder sign-off, and none
    // of the first-touch paragraphs leak in.
    expect(rendered).toHaveLength(en.reminderParagraphs.length + 1);
    expect(rendered[rendered.length - 1]).toBe(en.reminderTextSignoff);
    // The reminder names the beneficiary (wireframe cue).
    expect(rendered.join(' ')).toContain('Miss Ann Boat Trips');
    expect(captured[0].subject).toBe(
      en.reminderSubject.replace('{tourName}', baseContext.tourName),
    );
  });

  it('the WhatsApp line appears ONLY for reminder + opt-in', async () => {
    await svc.sendReviewRequestEmail('t@example.com', {
      ...baseContext,
      isReminder: true,
      whatsappOptIn: true,
    });
    await svc.sendReviewRequestEmail('t@example.com', {
      ...baseContext,
      isReminder: true,
      whatsappOptIn: false,
    });
    const withOptIn = paragraphsOf(0).join(' ');
    const withoutOptIn = paragraphsOf(1).join(' ');
    const marker = en.reminderWhatsappLine.slice(0, 20);
    expect(withOptIn).toContain(marker);
    expect(withoutOptIn).not.toContain(marker);
  });

  it('an absent operator name falls back to the neutral team wording (reminder)', async () => {
    await svc.sendReviewRequestEmail('t@example.com', {
      ...baseContext,
      isReminder: true,
      operatorName: '  ',
    });
    expect(paragraphsOf().join(' ')).toContain(en.operatorFallback);
  });

  it('locale drives the copy: de renders the German reminder subject', async () => {
    await svc.sendReviewRequestEmail('t@example.com', {
      ...baseContext,
      isReminder: true,
      locale: Locale.de,
    });
    const de = REVIEW_REQUEST_COPY[Locale.de];
    expect(captured[0].subject).toBe(
      de.reminderSubject.replace('{tourName}', baseContext.tourName),
    );
    expect(captured[0].subject).not.toBe(
      en.reminderSubject.replace('{tourName}', baseContext.tourName),
    );
  });
});
