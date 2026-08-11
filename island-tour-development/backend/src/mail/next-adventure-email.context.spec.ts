import { Currency, Locale } from '@prisma/client';
import {
  buildNextAdventureEmailContext,
  buildNextAdventureEmailText,
  type NextAdventureCardInput,
  type NextAdventureEmailInput,
} from './next-adventure-email.context';
import { NEXT_ADVENTURE_COPY } from './templates/next-adventure-email.copy';

/**
 * MK-1 CONTEXT BUILDER (review of #188, Major 3): 265 lines of real logic -
 * the open-days collapse, duration rounding, cold-start meta branches and
 * the plain-text part - previously had no direct spec; the template spec
 * hand-built contexts and bypassed all of it. These pin the builder itself,
 * on the WP-B booking-email.context.spec model.
 */

const d = (iso: string) => new Date(iso);

function card(
  over: Partial<NextAdventureCardInput> = {},
): NextAdventureCardInput {
  return {
    name: 'West Coast Buggy Adventure',
    slug: 'west-coast-buggy',
    imageUrl: 'https://img.example/buggy.jpg',
    aggregateRating: 4.8,
    aggregateReviewCount: 212,
    durationMinutesFrom: 240,
    priceFrom: '89.00',
    currency: Currency.USD,
    oneLiner: 'The land version of your boat day.',
    openDates: [d('2026-08-13'), d('2026-08-14'), d('2026-08-15')],
    ...over,
  };
}

function input(
  over: Partial<NextAdventureEmailInput> = {},
): NextAdventureEmailInput {
  return {
    booking: { customerLocale: 'en', contactEmail: 'traveller@example.com' },
    bookedTourName: 'Klein Curaçao Day Trip',
    destination: { name: 'Curaçao', slug: 'curacao' },
    destinationTourCount: 25,
    cards: [
      card(),
      card({ slug: 'blue-room', name: 'Blue Room Snorkel' }),
      card({ slug: 'sunset-sail' }),
    ],
    site: { logoUrl: null },
    unsubscribeUrl: 'http://localhost:3000/unsubscribe/tok-mk1',
    config: {
      frontendUrl: 'http://localhost:3000/',
      emailIconBase: 'https://res.cloudinary.com/x/icons',
    },
    ...over,
  };
}

describe('buildNextAdventureEmailContext', () => {
  it('open-days line: chronological, weekday-deduped', () => {
    const ctx = buildNextAdventureEmailContext(
      input({
        cards: [
          // Two Thursdays (13th and 20th) must render ONE Thu; order by date.
          card({
            openDates: [d('2026-08-20'), d('2026-08-13'), d('2026-08-14')],
          }),
          card(),
          card(),
        ],
      }),
    );
    expect(ctx.cardOneOpenDays).toBe('Open: Thu, Fri');
  });

  it('all seven weekdays collapse to "Open: daily" (the wireframe card)', () => {
    const week = [11, 12, 13, 14, 15, 16, 17].map((day) => d(`2026-08-${day}`));
    const ctx = buildNextAdventureEmailContext(
      input({ cards: [card({ openDates: week }), card(), card()] }),
    );
    expect(ctx.cardOneOpenDays).toBe('Open: daily');
  });

  it('meta prefix: full form "★ 4.8 (212) · 4 hrs · from " before the bold price', () => {
    const ctx = buildNextAdventureEmailContext(input());
    expect(ctx.cardOneMetaPrefix).toBe('★ 4.8 (212) · 4 hrs · from ');
    expect(ctx.cardOnePrice).toBe('$89');
  });

  it('cold start (LD11): no rating renders NO fabricated number', () => {
    const ctx = buildNextAdventureEmailContext(
      input({
        cards: [
          card({ aggregateRating: null, aggregateReviewCount: 0 }),
          card(),
          card(),
        ],
      }),
    );
    expect(ctx.cardOneMetaPrefix).toBe('4 hrs · from ');
    expect(String(ctx.cardOneMetaPrefix)).not.toContain('★');
  });

  it('no price hides the from-label and the price token entirely', () => {
    const ctx = buildNextAdventureEmailContext(
      input({ cards: [card({ priceFrom: null }), card(), card()] }),
    );
    expect(ctx.cardOneMetaPrefix).toBe('★ 4.8 (212) · 4 hrs');
    expect(ctx.cardOnePrice).toBe('');
  });

  it('duration rounding: 45 min bare, 150 min → "2.5 hrs", zero-cents price stripped', () => {
    const ctx = buildNextAdventureEmailContext(
      input({
        cards: [
          card({ durationMinutesFrom: 45 }),
          card({ durationMinutesFrom: 150 }),
          card({ priceFrom: '75.50' }),
        ],
      }),
    );
    expect(String(ctx.cardOneMetaPrefix)).toContain('45 min');
    expect(String(ctx.cardTwoMetaPrefix)).toContain('2.5 hrs');
    // Non-zero cents survive; only ",00"/".00" is stripped.
    expect(ctx.cardThreePrice).toBe('$75.50');
  });

  it('card URLs and the see-all URL are locale-prefixed under the destination', () => {
    const ctx = buildNextAdventureEmailContext(input());
    expect(ctx.cardOneUrl).toBe(
      'http://localhost:3000/en/curacao/west-coast-buggy/',
    );
    expect(ctx.allToursUrl).toBe('http://localhost:3000/en/curacao/tours/');
    expect(ctx.seeAllLabel).toBe('See all 25 tours on Curaçao');
  });

  it('locale drives copy: de subject differs from en and carries the tour name', () => {
    const en = buildNextAdventureEmailContext(input());
    const de = buildNextAdventureEmailContext(
      input({ booking: { customerLocale: 'de', contactEmail: 'x@y.z' } }),
    );
    expect(en.subjectLine).toBe(
      NEXT_ADVENTURE_COPY[Locale.en].subjectA.replace(
        '{tourName}',
        'Klein Curaçao Day Trip',
      ),
    );
    expect(de.subjectLine).not.toBe(en.subjectLine);
    expect(String(de.subjectLine)).toContain('Klein Curaçao Day Trip');
  });
});

describe('buildNextAdventureEmailText', () => {
  it('carries the unsubscribe URL, all three cards, and no scarcity vocabulary', () => {
    const ctx = buildNextAdventureEmailContext(input());
    const text = buildNextAdventureEmailText(ctx);
    expect(text).toContain('http://localhost:3000/unsubscribe/tok-mk1');
    expect(text).toContain('West Coast Buggy Adventure');
    expect(text).toContain('Blue Room Snorkel');
    expect(text).toContain('Shanice');
    for (const forbidden of [/%\s*off/i, /only \d+ (spots|seats)/i, /hurry/i]) {
      expect(text).not.toMatch(forbidden);
    }
  });
});
