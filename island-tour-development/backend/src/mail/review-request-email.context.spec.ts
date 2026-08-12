import { Locale } from '@prisma/client';
import {
  buildReviewRequestEmailContext,
  buildReviewRequestEmailText,
  type ReviewRequestEmailInput,
} from './review-request-email.context';
import { REVIEW_REQUEST_COPY } from './templates/review-request-email.copy';

/**
 * The pure BK-3 / BK-3R context builder. Everything the wireframe decides that
 * is NOT markup lives here - the long-form date (the bug this replaced), the
 * two operator tokens, the greeting/ask split, and BK-3R's mapping of its
 * paragraph draft onto the same nine blocks.
 */
const base: ReviewRequestEmailInput = {
  firstName: 'Denley',
  tourName: 'Klein Curaçao Day Trip',
  operatorName: 'Miss Ann Boat Trips',
  bookingRef: 'IT-2026-04821',
  tourDate: new Date('2026-05-22T00:00:00.000Z'),
  tourImageUrl: 'https://cdn.test/klein.jpg',
  partyLines: ['2 adults', '1 child'],
  reviewUrl: 'https://island.tours/en/review/tok-1',
  siteLogoUrl: null,
  isReminder: false,
  whatsappOptIn: false,
  locale: Locale.en,
};

const build = (over: Partial<ReviewRequestEmailInput> = {}) =>
  buildReviewRequestEmailContext({ ...base, ...over });

describe('buildReviewRequestEmailContext', () => {
  describe('the date, which shipped wrong', () => {
    it('formats long-form, not the ISO slice production emailed', () => {
      expect(build().dateLong).toBe('Friday, 22 May 2026');
      expect(build().dateLong).not.toBe('2026-05-22');
    });

    it("formats in the READER's locale, in UTC (wall-clock instants)", () => {
      expect(build({ locale: Locale.de }).dateLong).toBe(
        'Freitag, 22. Mai 2026',
      );
      expect(build({ locale: Locale.fr }).dateLong).toBe(
        'vendredi 22 mai 2026',
      );
      // A UTC-midnight @db.Date must not slip a day in a western zone.
      expect(build().dateLong).toContain('22 May');
    });

    it('drops the weekday in the hero, which the card below already prints', () => {
      // The wireframe's hero reads "your trip, 22 May 2026" while the booking
      // card ~100px below reads "Friday, 22 May 2026". Rendering the weekday
      // twice that close together stutters, worst in the locales that spell
      // it out ("tu tour, viernes, 22 de mayo de 2026").
      expect(build().heroSubline).toBe(
        'Supplied by Miss Ann Boat Trips · your trip, 22 May 2026',
      );
    });
  });

  describe('the two operator tokens', () => {
    it('names the operator in the card and in the bolded ask', () => {
      const ctx = build();
      expect(ctx.operatorName).toBe('Miss Ann Boat Trips');
      expect(ctx.operatorTeam).toBe('Miss Ann Boat Trips');
    });

    it('blanks the card line but keeps the sentence sayable when none is on file', () => {
      const en = REVIEW_REQUEST_COPY[Locale.en];
      for (const value of [null, '', '   ']) {
        const ctx = build({ operatorName: value });
        expect(ctx.operatorName).toBe('');
        expect(ctx.operatorTeam).toBe(en.operatorFallback);
        expect(ctx.heroSubline).toContain(en.operatorFallback);
      }
    });
  });

  it('joins the party lines and tolerates none', () => {
    expect(build().partyBreakdown).toBe('2 adults, 1 child');
    expect(build({ partyLines: [] }).partyBreakdown).toBe('');
  });

  it('hides the hero with an absent image rather than emitting an empty src', () => {
    expect(build({ tourImageUrl: null }).heroImageUrl).toBe('');
  });

  describe('BK-3 (first touch)', () => {
    const en = REVIEW_REQUEST_COPY[Locale.en];

    it('fills the greeting and the one-paragraph ask', () => {
      const ctx = build();
      expect(ctx.greeting).toBe('Hi Denley,');
      expect(ctx.greetingLine).toBe(en.greetingLine);
      expect(ctx.askBefore).toBe(en.askBefore);
      expect(ctx.askAfter).toBe(en.askAfter);
      expect(ctx.extraParagraphs).toEqual([]);
      expect(ctx.subjectLine).toBe('How was Klein Curaçao Day Trip?');
    });

    it('previews with its own line, never the subject', () => {
      const ctx = build();
      expect(ctx.previewText).toBe(en.preview);
      expect(ctx.previewText).not.toBe(ctx.subjectLine);
    });

    it('never carries an unsubscribe token - BK-3 is transactional', () => {
      const ctx = build();
      const keys = Object.keys(ctx).join(' ').toLowerCase();
      expect(keys).not.toContain('unsubscribe');
      expect(ctx.footerLine).toContain('IT-2026-04821');
    });
  });

  describe('BK-3R (the single reminder)', () => {
    const en = REVIEW_REQUEST_COPY[Locale.en];

    it('suppresses the 22px greeting: its first paragraph already names them', () => {
      const ctx = build({ isReminder: true });
      expect(ctx.greeting).toBe('');
      expect(ctx.greetingLine).toBe(
        'Hi Denley, one small nudge from us - the only one, promise.',
      );
    });

    it('moves the remaining draft paragraphs into the ask cell verbatim', () => {
      const ctx = build({ isReminder: true });
      expect(ctx.askBefore).toBe('');
      expect(ctx.extraParagraphs).toHaveLength(2);
      expect(String((ctx.extraParagraphs as string[])[0])).toContain(
        'Miss Ann Boat Trips',
      );
      expect(String((ctx.extraParagraphs as string[])[1])).toBe(
        en.reminderParagraphs[2],
      );
    });

    it('appends the WhatsApp line only on opt-in', () => {
      const on = build({ isReminder: true, whatsappOptIn: true });
      const off = build({ isReminder: true, whatsappOptIn: false });
      expect(on.extraParagraphs).toHaveLength(3);
      expect(off.extraParagraphs).toHaveLength(2);
      // Never on the first touch, opt-in or not.
      expect(build({ whatsappOptIn: true }).extraParagraphs).toEqual([]);
    });

    it('uses the reminder subject and keeps every shared block', () => {
      const ctx = build({ isReminder: true });
      expect(ctx.subjectLine).toBe('Did you enjoy Klein Curaçao Day Trip?');
      expect(ctx.tapAStar).toBe(en.tapAStar);
      expect(ctx.signoffThanks).toBe(en.signoffThanks);
      expect(ctx.reviewUrl).toBe(base.reviewUrl);
    });
  });

  describe('all seven locales', () => {
    it('resolves every copy slot with no leftover placeholder', () => {
      for (const locale of Object.values(Locale)) {
        for (const isReminder of [false, true]) {
          const ctx = build({ locale, isReminder, whatsappOptIn: true });
          const rendered = [
            ctx.subjectLine,
            ctx.previewText,
            ctx.greeting,
            ctx.greetingLine,
            ctx.heroSubline,
            ctx.askBefore,
            ctx.askAfter,
            ctx.footerLine,
            ...(ctx.extraParagraphs as string[]),
          ]
            .map(String)
            .join(' ');
          expect(rendered).not.toMatch(/\{\w+\}/);
        }
      }
    });
  });
});

describe('buildReviewRequestEmailText', () => {
  it('carries the whole email, the link once, and no markup', () => {
    const text = buildReviewRequestEmailText(build());
    expect(text).toContain('Hi Denley,');
    expect(text).toContain('Klein Curaçao Day Trip');
    expect(text).toContain('Miss Ann Boat Trips');
    expect(text).toContain('Friday, 22 May 2026 · 2 adults, 1 child');
    expect(text).toContain('Booking reference: IT-2026-04821');
    expect(text).toContain(
      'Rate your tour: https://island.tours/en/review/tok-1',
    );
    expect(text).toContain('Only guests who booked through Island Tours');
    // The bolded name keeps its surrounding spaces in the text part.
    expect(text).toContain(
      'it means a lot to Miss Ann Boat Trips and the team.',
    );
    expect(text).not.toContain('<');
    expect(text).not.toMatch(/\{\w+\}/);
  });

  it('renders the reminder body instead of the first-touch ask', () => {
    const text = buildReviewRequestEmailText(build({ isReminder: true }));
    expect(text).toContain('one small nudge from us');
    expect(text).not.toContain('About thirty seconds is all it takes.');
  });

  it('drops the operator line entirely when there is no name', () => {
    const text = buildReviewRequestEmailText(build({ operatorName: null }));
    expect(text).not.toMatch(/\n\n\n/);
  });
});
