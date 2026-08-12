import * as fs from 'fs';
import * as path from 'path';
import {
  Currency,
  Locale,
  OnArrivalPayment,
  PaymentModel,
} from '@prisma/client';
import {
  buildConfirmationEmailContext,
  buildConfirmationEmailSubject,
  buildConfirmationEmailText,
  buildPartyLines,
  buildReminderEmailContext,
  buildReminderEmailText,
  depositPctOf,
  durationLabel,
  preferLocale,
  toLocale,
  type ConfirmationEmailInput,
  type ReminderEmailInput,
} from './booking-email.context';
import {
  findUnresolvedTokens,
  renderEmailTemplate,
} from '@/mail/templates/email-template.renderer';

const TEMPLATE = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'mail',
    'templates',
    'booking-confirmation-email.template.html',
  ),
  'utf8',
);

/** Local wall clock is stored `Z`-labelled - build fixtures the same way. */
const startAt = new Date(Date.UTC(2026, 4, 22, 8, 0));

function input(
  over: Partial<ConfirmationEmailInput> = {},
): ConfirmationEmailInput {
  return {
    booking: {
      displayRef: 'IT-2026-04821',
      publicRef: 'pub-ref-1',
      island: 'curacao',
      currency: Currency.USD,
      customerLocale: Locale.en,
      contactFirstName: 'Denley',
      paymentModel: PaymentModel.OPERATOR_LINK,
      onArrivalPayment: null,
      depositPct: '30',
      depositAmount: '60.00',
      balanceAmount: '160.00',
      totalAmount: '220.00',
      tourStartDateTime: startAt,
      localDate: new Date(Date.UTC(2026, 4, 22)),
      startTime: '08:00',
      pickupRequested: false,
      pickupAddress: null,
      pickupMinutesPrior: null,
      pickupWindowStart: null,
      pickupWindowEnd: null,
      notes: null,
      cancelDeadline: new Date(Date.UTC(2026, 4, 20, 8, 0)),
      partyLines: ['2 adults', '1 child'],
      ...over.booking,
    },
    tour: {
      name: 'Klein Curacao Day Trip',
      slug: 'klein-curacao-day-trip',
      heroImageUrl: 'https://cdn.test/hero.jpg',
      durationLabel: '9 hours',
      languageCodes: ['en'],
      checkInMinutesBefore: 30,
      meetingPoint: 'Sint Annabaai Pier',
      meetingPointLat: 12.1,
      meetingPointLng: -68.9,
      endPoint: 'Jan Thiel Beach',
      whatToBring: ['Sunscreen', 'Towel'],
      knowBeforeYouGo: ['Bring ID'],
      operatorNote: null,
      ...over.tour,
    },
    operator: {
      name: 'Miss Ann Boat Trips',
      email: 'hello@missann.test',
      phone: '+5999 123 4567',
      ...over.operator,
    },
    site: {
      logoUrl: 'https://cdn.test/logo.png',
      whatsappNumber: '+599 9 123 4567',
      whatsappEnabled: true,
      ...over.site,
    },
    destination: { name: 'Curacao', slug: 'curacao', ...over.destination },
    relatedTours: over.relatedTours ?? [
      {
        name: 'Blue Room Snorkel',
        slug: 'blue-room-snorkel',
        imageUrl: 'https://cdn.test/r1.jpg',
        aggregateRating: 4.8,
        priceFrom: '45.00',
        currency: Currency.USD,
      },
    ],
    recommendations: over.recommendations ?? [],
    config: {
      frontendUrl: 'https://island.tours',
      apiUrl: 'https://api.island.tours',
      emailIconBase: 'https://cdn.test/icons',
      ...over.config,
    },
  };
}

describe('buildConfirmationEmailContext', () => {
  // The point of the whole builder: the LOCKED template must render with nothing
  // left literal. This is what catches a token the wiring forgot, before a
  // traveler reads a raw "{whatToBring}".
  describe('satisfies the template contract', () => {
    it('resolves every token the shipped template references', () => {
      expect(
        findUnresolvedTokens(TEMPLATE, buildConfirmationEmailContext(input())),
      ).toEqual([]);
    });

    it.each([
      ['operator_link', PaymentModel.OPERATOR_LINK, null],
      [
        'on_arrival card',
        PaymentModel.ON_ARRIVAL,
        OnArrivalPayment.CARD_OR_CASH,
      ],
      ['on_arrival cash', PaymentModel.ON_ARRIVAL, OnArrivalPayment.CASH_ONLY],
      ['paid_in_full', PaymentModel.PAID_IN_FULL, null],
      ['operator_full', PaymentModel.OPERATOR_FULL, null],
    ])(
      'renders %s with no leftover markup',
      (_label, paymentModel, onArrival) => {
        const ctx = buildConfirmationEmailContext(
          input({
            booking: {
              ...input().booking,
              paymentModel,
              onArrivalPayment: onArrival,
            },
          }),
        );
        const html = renderEmailTemplate(TEMPLATE, ctx);
        expect(findUnresolvedTokens(TEMPLATE, ctx)).toEqual([]);
        expect(html).not.toContain('[IF');
        expect(html).not.toMatch(/\{[a-zA-Z][a-zA-Z0-9_.]*\}/);
      },
    );

    it('renders a minimal booking (no pickup, no extras) without orphan copy', () => {
      const ctx = buildConfirmationEmailContext(
        input({
          tour: {
            ...input().tour,
            durationLabel: null,
            languageCodes: [],
            endPoint: null,
            operatorNote: null,
            whatToBring: [],
            knowBeforeYouGo: [],
          },
          relatedTours: [],
        }),
      );
      expect(findUnresolvedTokens(TEMPLATE, ctx)).toEqual([]);
      const html = renderEmailTemplate(TEMPLATE, ctx);
      expect(html).not.toContain('Ends at:');
      expect(html).not.toContain('Duration:');
    });
  });

  // The wireframe's build note is explicit: 24-hour ACROSS ALL LOCALES. en-GB and
  // zh-CN both default to 12-hour, so this is a real trap, not a formality.
  describe('times are 24-hour in every locale', () => {
    it.each([
      Locale.en,
      Locale.nl,
      Locale.de,
      Locale.fr,
      Locale.es,
      Locale.pt,
      Locale.zh,
    ])('%s renders the deadline without am/pm', (locale) => {
      const ctx = buildConfirmationEmailContext(
        input({ booking: { ...input().booking, customerLocale: locale } }),
      );
      const deadline = String(ctx.cancelDeadlineDateTime);
      expect(deadline).toContain('08:00');
      expect(deadline.toLowerCase()).not.toMatch(/am|pm|上午|下午/);
    });

    it('passes the departure start through untouched', () => {
      expect(buildConfirmationEmailContext(input()).startTime).toBe('08:00');
    });
  });

  // Design review 2026-07-16: these all shipped wrong and the founder caught them.
  describe('design fidelity', () => {
    it('renders what-to-bring as one wireframe bullet row per item', () => {
      const html = renderEmailTemplate(
        TEMPLATE,
        buildConfirmationEmailContext(input()),
      );
      // Was joined into a single "Sunscreen · Towel" line; the design has rows.
      expect(html).not.toContain('Sunscreen · Towel');
      const rows = html.match(/&bull;<\/td><td style="padding:2px 0">/g) ?? [];
      expect(rows).toHaveLength(3); // 2 what-to-bring + 1 good-to-know
      expect(html).toContain('>Sunscreen</td>');
      expect(html).toContain('>Bring ID</td>');
      expect(html).toContain('color:#E8611A'); // orange bullet marker
    });

    it('hides a bullet heading when its list is empty', () => {
      const html = renderEmailTemplate(
        TEMPLATE,
        buildConfirmationEmailContext(
          input({ tour: { ...input().tour, knowBeforeYouGo: [] } }),
        ),
      );
      expect(html).toContain('What to bring');
      expect(html).not.toContain('Good to know');
    });

    it('renders the operator note card when the operator wrote one', () => {
      const html = renderEmailTemplate(
        TEMPLATE,
        buildConfirmationEmailContext(
          input({
            tour: { ...input().tour, operatorNote: 'Seas can be rough.' },
          }),
        ),
      );
      expect(html).toContain('A note from Miss Ann Boat Trips');
      expect(html).toContain('Seas can be rough.');
    });

    it('formats the deadline as the design locks it (short weekday, comma, 24h)', () => {
      // Was "Wednesday, 20 May 2026 at 08:00".
      expect(
        String(buildConfirmationEmailContext(input()).cancelDeadlineDateTime),
      ).toBe('Wed, 20 May 2026, 08:00');
    });

    it('renders language NAMES, not raw ISO codes', () => {
      // Shipped as "Language: en, es, nl".
      const ctx = buildConfirmationEmailContext(
        input({ tour: { ...input().tour, languageCodes: ['en', 'es', 'nl'] } }),
      );
      expect(ctx.tourLanguage).toBe('English, Spanish, Dutch');
    });

    // Founder 2026-08-01: "showing language, does this have any meaning?" - the
    // wireframe's bare "Language:" read as the language of the EMAIL once a
    // tour listed more than one. The label has to say whose language it is.
    it("labels the languages as the tour's, not the reader's", () => {
      const ctx = buildConfirmationEmailContext(
        input({ tour: { ...input().tour, languageCodes: ['en', 'es', 'nl'] } }),
      );
      const text = buildConfirmationEmailText(ctx);
      expect(text).toContain('Guided in: English, Spanish, Dutch');
      expect(text).not.toContain('Language:');
    });

    it('localizes language names for the reader', () => {
      const ctx = buildConfirmationEmailContext(
        input({
          tour: { ...input().tour, languageCodes: ['en'] },
          booking: { ...input().booking, customerLocale: Locale.nl },
        }),
      );
      expect(ctx.tourLanguage).toBe('Engels');
    });

    it('shows the account link as a label, not a raw url', () => {
      // Shipped as "http://localhost:3000/bookings".
      const ctx = buildConfirmationEmailContext(input());
      expect(ctx.accountUrlLabel).toBe('island.tours/bookings');
      expect(ctx.accountUrl).toBe('https://island.tours/bookings');
    });
  });

  describe('email-client survival', () => {
    it('is fluid exactly the way the wireframe is', () => {
      // Gmail Android ignores <style> media queries, so a fixed-width shell renders
      // zoomed out and unreadable. The wireframe's own shell is the classic fluid
      // hybrid - width="600" ATTRIBUTE (what Outlook reads) + width:100%;max-width
      // STYLE (what everything else reads) - and it has no media queries at all:
      // mobile is simply the same email rendered narrower.
      expect(TEMPLATE).not.toContain('style="width:600px');
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

    it('actually loads the wireframe font instead of only naming it', () => {
      expect(TEMPLATE).toContain(
        'fonts.googleapis.com/css2?family=Plus+Jakarta+Sans',
      );
      expect(TEMPLATE).toContain("font-family:'Plus Jakarta Sans'");
    });
  });

  describe('money', () => {
    it('formats in the CHARGED currency, not the locale default', () => {
      // A EUR booking read in English must not be relabelled as dollars.
      const ctx = buildConfirmationEmailContext(
        input({
          booking: {
            ...input().booking,
            currency: Currency.EUR,
            customerLocale: Locale.en,
          },
        }),
      );
      expect(String(ctx.totalAmount)).toContain('220');
      expect(String(ctx.totalAmount)).not.toContain('$');
    });

    it('formats for the reader locale', () => {
      const de = buildConfirmationEmailContext(
        input({ booking: { ...input().booking, customerLocale: Locale.de } }),
      );
      // de-DE uses a comma decimal separator.
      expect(String(de.totalAmount)).toContain('220,00');
    });

    // en-GB defaults USD to "US$220.00"; the wireframe locks the bare "$".
    it.each([Locale.en, Locale.zh])(
      'renders USD with a bare $ for %s',
      (locale) => {
        const ctx = buildConfirmationEmailContext(
          input({ booking: { ...input().booking, customerLocale: locale } }),
        );
        expect(String(ctx.totalAmount)).toBe('$220.00');
        expect(String(ctx.totalAmount)).not.toContain('US$');
        // The wireframe's upsell meta line is "4.9 · $89": no "from", no zero cents.
        expect(String(ctx.relatedTourOnePrice)).toBe('$45');
      },
    );
  });

  describe('pickup vs meeting point', () => {
    it('uses the meeting point when there is no pickup', () => {
      const ctx = buildConfirmationEmailContext(input());
      expect(ctx.hasPickup).toBe(false);
      expect(ctx.meetingPoint).toBe('Sint Annabaai Pier');
      // No pickup -> the buffer is the tour's check-in lead time.
      expect(ctx.arrivalBufferMin).toBe(30);
    });

    it('renders the operator pickup WINDOW when one was snapshotted', () => {
      const ctx = buildConfirmationEmailContext(
        input({
          booking: {
            ...input().booking,
            pickupRequested: true,
            pickupAddress: 'Hotel Brion',
            pickupMinutesPrior: 45,
            pickupWindowStart: '07:45',
            pickupWindowEnd: '08:15',
          },
        }),
      );
      expect(ctx.hasPickup).toBe(true);
      expect(ctx.pickupTime).toBe('07:45-08:15');
      expect(ctx.arrivalBufferMin).toBe(45);
    });

    it('derives the pickup time from the lead when there is no window', () => {
      const ctx = buildConfirmationEmailContext(
        input({
          booking: {
            ...input().booking,
            pickupRequested: true,
            pickupAddress: 'Hotel Brion',
            pickupMinutesPrior: 45,
          },
        }),
      );
      expect(ctx.pickupTime).toBe('07:15');
    });

    it('falls back to the meeting point when pickup was requested but never snapshotted', () => {
      // Otherwise the email reads "Pickup: , 08:00".
      const ctx = buildConfirmationEmailContext(
        input({
          booking: {
            ...input().booking,
            pickupRequested: true,
            pickupAddress: null,
          },
        }),
      );
      expect(ctx.hasPickup).toBe(false);
    });
  });

  describe('links', () => {
    it('points cancel at the tokenized page (master 6.4/C1), never a raw cancel', () => {
      const ctx = buildConfirmationEmailContext(input());
      expect(ctx.cancelUrl).toBe('https://island.tours/cancel/pub-ref-1');
    });

    it('serves the calendar off the API origin, not the site', () => {
      // Built off frontendUrl this would 404 in every inbox.
      expect(buildConfirmationEmailContext(input()).calendarUrl).toBe(
        'https://api.island.tours/api/v1/bookings/typ/pub-ref-1/calendar.ics',
      );
    });

    it('builds the localized canonical tour url', () => {
      const ctx = buildConfirmationEmailContext(
        input({ booking: { ...input().booking, customerLocale: Locale.nl } }),
      );
      expect(ctx.tourUrl).toBe(
        'https://island.tours/nl/curacao/klein-curacao-day-trip/',
      );
    });

    it('hides WhatsApp when the founder switched it off', () => {
      const ctx = buildConfirmationEmailContext(
        input({ site: { ...input().site, whatsappEnabled: false } }),
      );
      expect(ctx.whatsappUrl).toBe('');
    });
  });

  describe('related tours', () => {
    it('leaves the second card empty rather than inventing one', () => {
      const ctx = buildConfirmationEmailContext(input());
      expect(ctx.relatedTourOneName).toBe('Blue Room Snorkel');
      expect(ctx.relatedTourTwoName).toBe('');
    });

    it('never fabricates a rating for an unreviewed tour (LD11 cold start)', () => {
      const ctx = buildConfirmationEmailContext(
        input({
          relatedTours: [
            {
              name: 'New Tour',
              slug: 'new-tour',
              imageUrl: null,
              aggregateRating: null,
              priceFrom: null,
              currency: Currency.USD,
            },
          ],
        }),
      );
      expect(ctx.relatedTourOneRating).toBe('');
      expect(ctx.relatedTourOnePrice).toBe('');
    });
  });
});

describe('buildPartyLines', () => {
  const bands = new Map([
    ['ab1', 'Adult'],
    ['ab2', 'Child'],
  ]);

  it('groups and pluralises age bands', () => {
    expect(
      buildPartyLines(
        [{ ageBandId: 'ab1' }, { ageBandId: 'ab1' }, { ageBandId: 'ab2' }],
        bands,
      ),
    ).toEqual(['2 adults', '1 child']);
  });

  it('collapses a unit-priced party into guests', () => {
    expect(
      buildPartyLines([{ ageBandId: null }, { ageBandId: null }], new Map()),
    ).toEqual(['2 guests']);
  });

  it('does not double-pluralise an operator band already named in the plural', () => {
    // Band labels are operator free text: "Adults" must not become "adultss".
    expect(
      buildPartyLines(
        [{ ageBandId: 'x' }, { ageBandId: 'x' }],
        new Map([['x', 'Adults']]),
      ),
    ).toEqual(['2 adults']);
  });

  it('leaves a multi-word band label alone', () => {
    expect(
      buildPartyLines([{ ageBandId: 'x' }], new Map([['x', 'Child (4-12)']])),
    ).toEqual(['1 child (4-12)']);
  });

  it('falls back to Traveler for a band that no longer exists', () => {
    expect(buildPartyLines([{ ageBandId: 'gone' }], new Map())).toEqual([
      '1 traveler',
    ]);
  });
});

describe('buildConfirmationEmailSubject', () => {
  const base = {
    tourName: 'Klein Curacao Day Trip',
    dateShort: '22 May 2026',
    start: startAt,
  };

  it('uses the dated subject for a normal booking', () => {
    expect(
      buildConfirmationEmailSubject({
        ...base,
        localNow: new Date(Date.UTC(2026, 4, 1, 8, 0)),
      }),
    ).toBe("You're booked: Klein Curacao Day Trip on 22 May 2026");
  });

  // Master (June 11 2026): the <24h variant doubles as the reminder, because the
  // pre-tour reminder fires at 24h and skips last-minute bookings.
  it('says "today" for a same-day booking', () => {
    expect(
      buildConfirmationEmailSubject({
        ...base,
        localNow: new Date(Date.UTC(2026, 4, 22, 6, 0)),
      }),
    ).toBe("You're booked today: Klein Curacao Day Trip");
  });

  it('says "tomorrow" for a booking inside 24 hours but on the next day', () => {
    expect(
      buildConfirmationEmailSubject({
        ...base,
        localNow: new Date(Date.UTC(2026, 4, 21, 20, 0)),
      }),
    ).toBe("You're booked for tomorrow: Klein Curacao Day Trip");
  });
});

describe('buildConfirmationEmailText', () => {
  it('never leaks the template stylesheet into the text part', () => {
    const text = buildConfirmationEmailText(
      buildConfirmationEmailContext(input()),
    );
    expect(text).not.toContain('<');
    expect(text).not.toContain('font-size');
    expect(text).toContain('IT-2026-04821');
  });

  it('states the cash-only rule for that variant', () => {
    const text = buildConfirmationEmailText(
      buildConfirmationEmailContext(
        input({
          booking: {
            ...input().booking,
            paymentModel: PaymentModel.ON_ARRIVAL,
            onArrivalPayment: OnArrivalPayment.CASH_ONLY,
          },
        }),
      ),
    );
    expect(text).toContain('in cash');
  });
});

describe('helpers', () => {
  it.each([
    ['en', Locale.en],
    ['en-US', Locale.en],
    ['NL', Locale.nl],
    ['zh_CN', Locale.zh],
    ['klingon', Locale.en],
    [null, Locale.en],
    ['', Locale.en],
  ])('toLocale(%s) -> %s', (input_, expected) => {
    expect(toLocale(input_)).toBe(expected);
  });

  it('derives the deposit pct from the booked amounts, not the live tier', () => {
    expect(depositPctOf('60.00', '220.00')).toBe('27');
    expect(depositPctOf('44.00', '220.00')).toBe('20');
  });

  it('never divides by a zero total', () => {
    expect(depositPctOf('0', '0')).toBe('0');
  });

  it.each([
    [540, '9 hours'],
    [60, '1 hour'],
    [90, '90 minutes'],
    [null, null],
    [0, null],
  ])('durationLabel(%s) -> %s', (minutes, expected) => {
    expect(durationLabel(minutes)).toBe(expected);
  });

  it('prefers the traveler locale then falls back to English', () => {
    const rows = [
      { locale: Locale.en, v: 'en' },
      { locale: Locale.nl, v: 'nl' },
    ];
    expect(preferLocale(rows, Locale.nl)?.v).toBe('nl');
    expect(preferLocale(rows, Locale.de)?.v).toBe('en');
    expect(preferLocale([], Locale.de)).toBeUndefined();
  });

  describe('featured recommendation block', () => {
    it('empties every slot token when nothing is placed on the email', () => {
      const ctx = buildConfirmationEmailContext(input({ recommendations: [] }));
      expect(ctx.recommendationOneName).toBe('');
      expect(ctx.recommendationOneUrl).toBe('');
      expect(ctx.recommendationTwoName).toBe('');
      expect(ctx.recommendationThreeName).toBe('');
    });

    it('passes an EXTERNAL link through untouched and formats the meta', () => {
      const ctx = buildConfirmationEmailContext(
        input({
          recommendations: [
            {
              title: 'Palm Suite Apartment',
              imageUrl: 'https://cdn.test/rec.jpg',
              linkUrl: 'https://www.airbnb.com/rooms/123',
              external: true,
              ctaLabel: 'See availability on Airbnb',
              rating: 4.8,
              priceAmount: 160,
              currency: Currency.USD,
            },
          ],
        }),
      );
      expect(ctx.recommendationOneName).toBe('Palm Suite Apartment');
      expect(ctx.recommendationOneUrl).toBe('https://www.airbnb.com/rooms/123');
      expect(ctx.recommendationOneCtaLabel).toBe('See availability on Airbnb');
      expect(String(ctx.recommendationOneMeta)).toContain('4.8');
      expect(String(ctx.recommendationOneMeta)).toContain('from');
    });

    it('absolutizes an INTERNAL site-relative link with the site + locale', () => {
      const ctx = buildConfirmationEmailContext(
        input({
          recommendations: [
            {
              title: 'Sunset Cruise',
              imageUrl: 'https://cdn.test/tour.jpg',
              linkUrl: '/curacao/sunset-cruise',
              external: false,
              ctaLabel: null,
              rating: null,
              priceAmount: null,
              currency: Currency.USD,
            },
          ],
        }),
      );
      // frontendUrl in the test input is https://island.tours; locale en.
      expect(ctx.recommendationOneUrl).toBe(
        'https://island.tours/en/curacao/sunset-cruise',
      );
      // Null ctaLabel falls back to a sensible default in the email.
      expect(ctx.recommendationOneCtaLabel).toBe('See more');
      // No rating/price -> the meta line is empty and the template hides it.
      expect(ctx.recommendationOneMeta).toBe('');
    });

    it('fills up to three slots and leaves the rest empty', () => {
      const rec = (title: string) => ({
        title,
        imageUrl: 'https://cdn.test/x.jpg',
        linkUrl: 'https://x.test',
        external: true,
        ctaLabel: null,
        rating: null,
        priceAmount: null,
        currency: Currency.USD,
      });
      const ctx = buildConfirmationEmailContext(
        input({ recommendations: [rec('A'), rec('B')] }),
      );
      expect(ctx.recommendationOneName).toBe('A');
      expect(ctx.recommendationTwoName).toBe('B');
      expect(ctx.recommendationThreeName).toBe('');
    });
  });
});

// ── BK-2 pre-tour reminder builder (WP-B) ────────────────────────────────────

describe('buildReminderEmailContext', () => {
  const REMINDER_TEMPLATE = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'mail',
      'templates',
      'pre-tour-reminder-email.template.html',
    ),
    'utf8',
  );

  function reminderInput(
    over: Partial<ReminderEmailInput> = {},
  ): ReminderEmailInput {
    return {
      booking: {
        displayRef: 'IT-2026-04821',
        currency: Currency.USD,
        customerLocale: Locale.en,
        contactFirstName: 'Denley',
        paymentModel: PaymentModel.OPERATOR_LINK,
        balanceAmount: '160.00',
        tourStartDateTime: startAt,
        localDate: new Date(Date.UTC(2026, 4, 22)),
        startTime: '08:00',
        tourEndDateTime: new Date(Date.UTC(2026, 4, 22, 17, 0)),
        pickupRequested: true,
        pickupAddress: 'Hotel Brion',
        pickupMinutesPrior: 45,
        pickupWindowStart: null,
        pickupWindowEnd: null,
        partyLines: ['2 adults', '1 child'],
        ...over.booking,
      },
      tour: {
        name: 'Klein Curacao Day Trip',
        heroImageUrl: 'https://cdn.test/hero.jpg',
        durationLabel: '9 hours',
        weatherDependent: true,
        checkInMinutesBefore: 30,
        meetingPoint: 'Sint Annabaai Pier',
        meetingPointLat: 12.1,
        meetingPointLng: -68.9,
        whatToBring: ['Towel', 'Sunscreen'],
        ...over.tour,
      },
      operator: {
        name: 'Miss Ann Boat Trips',
        email: 'hello@missann.test',
        phone: '+5999 123 4567',
        ...over.operator,
      },
      site: {
        logoUrl: 'https://cdn.test/logo.png',
        whatsappNumber: '+599 9 123 4567',
        whatsappEnabled: true,
        ...over.site,
      },
      isSameDay: over.isSameDay ?? false,
      // The rail is present by default so the token sweep covers it; the
      // opted-out / thin-island case passes `crossSell: []`.
      crossSell: over.crossSell ?? [
        {
          name: 'West Coast Buggy Adventure',
          imageUrl: 'https://cdn.test/buggy.jpg',
          aggregateRating: 4.8,
          aggregateReviewCount: 212,
          priceFrom: '89.00',
          currency: Currency.USD,
        },
        {
          name: 'Sunset Sailing Cruise',
          imageUrl: 'https://cdn.test/sail.jpg',
          aggregateRating: 4.7,
          aggregateReviewCount: 138,
          priceFrom: '65.00',
          currency: Currency.USD,
        },
      ],
      unsubscribeUrl:
        over.unsubscribeUrl ?? 'https://island.tours/unsubscribe/tok_test',
      destination: { slug: 'curacao', ...over.destination },
      config: {
        emailIconBase: 'https://cdn.test/icons',
        frontendUrl: 'https://island.tours',
        ...over.config,
      },
    };
  }

  it('renders the locked template with nothing left literal', () => {
    const ctx = buildReminderEmailContext(reminderInput());
    expect(findUnresolvedTokens(REMINDER_TEMPLATE, ctx)).toEqual([]);
    const html = renderEmailTemplate(REMINDER_TEMPLATE, ctx);
    expect(html).not.toMatch(/\{[a-zA-Z][a-zA-Z0-9_.]*\}/);
  });

  it('subject is "Tomorrow: {tour} · {time}" at T-24h and switches wholesale for same-day', () => {
    expect(buildReminderEmailContext(reminderInput()).subjectLine).toBe(
      'Tomorrow: Klein Curacao Day Trip · 08:00',
    );
    const today = buildReminderEmailContext(reminderInput({ isSameDay: true }));
    expect(today.subjectLine).toBe('Today: Klein Curacao Day Trip · 08:00');
    expect(today.headline).toBe("You're set for today, Denley.");
    expect(today.questionsTitle).toBe('Questions about today?');
  });

  it('drops the dangling separator when the snapshot has no start time', () => {
    const ctx = buildReminderEmailContext(
      reminderInput({
        booking: { ...reminderInput().booking, startTime: null },
      }),
    );
    expect(ctx.subjectLine).toBe('Tomorrow: Klein Curacao Day Trip');
  });

  describe('the balance note (the ONLY money mention, B-02)', () => {
    it('operator_link with a real balance gets the wireframe note - amount, no link', () => {
      const ctx = buildReminderEmailContext(reminderInput());
      expect(ctx.balanceNotePrefix).toBe('Your remaining balance of');
      expect(ctx.balanceAmount).toBe('$160.00');
      expect(ctx.balanceNoteSuffix).toContain('Miss Ann Boat Trips');
      expect(ctx.balanceNoteSuffix).toContain('Already paid?');
      expect(String(ctx.balanceNoteSuffix)).not.toMatch(/https?:\/\//);
    });

    it('the amount arrives as its OWN token so the template can bold it', () => {
      // The renderer escapes every {token}, so a <b> inside a copy string can
      // only print as &lt;b&gt; - this is why the sentence is split at all.
      const ctx = buildReminderEmailContext(reminderInput());
      const html = renderEmailTemplate(REMINDER_TEMPLATE, ctx);
      expect(html).toContain(
        'Your remaining balance of <b>$160.00</b> runs through',
      );
      expect(html).not.toContain('&lt;b&gt;');
    });

    it.each([
      PaymentModel.ON_ARRIVAL,
      PaymentModel.PAID_IN_FULL,
      PaymentModel.OPERATOR_FULL,
    ])('%s never gets a balance note', (paymentModel) => {
      const ctx = buildReminderEmailContext(
        reminderInput({
          booking: { ...reminderInput().booking, paymentModel },
        }),
      );
      expect(ctx.balanceNotePrefix).toBe('');
      expect(ctx.balanceAmount).toBe('');
      expect(ctx.balanceNoteSuffix).toBe('');
    });

    it('a zero balance hides the note even on operator_link', () => {
      const ctx = buildReminderEmailContext(
        reminderInput({
          booking: { ...reminderInput().booking, balanceAmount: '0.00' },
        }),
      );
      expect(ctx.balanceNotePrefix).toBe('');
      expect(renderEmailTemplate(REMINDER_TEMPLATE, ctx)).not.toContain(
        'Remaining balance',
      );
    });
  });

  describe('the "Islanders also love..." cross-sell rail', () => {
    it('renders two cards with the wireframe meta, bolding the price', () => {
      const html = renderEmailTemplate(
        REMINDER_TEMPLATE,
        buildReminderEmailContext(reminderInput()),
      );
      expect(html).toContain('Islanders also love...');
      expect(html).toContain('Picked to pair with your booking');
      expect(html).toContain(
        '★ 4.8 (212) · from <b style="color:#1F2937">$89</b>',
      );
      expect(html).toContain(
        '★ 4.7 (138) · from <b style="color:#1F2937">$65</b>',
      );
      // The availability line is true by construction (the loader only ever
      // hands over tours with an OPEN departure inside the window).
      expect(html.match(/Open departures this week/g)).toHaveLength(2);
      expect(html).toContain('https://island.tours/en/curacao/tours/');
      // The apostrophe arrives HTML-escaped, as every copy token does.
      expect(html).toContain('Browse the Islanders&#39; top picks');
    });

    it('an empty rail hides the block, its divider AND the unsubscribe line', () => {
      const ctx = buildReminderEmailContext(
        reminderInput({ crossSell: [], unsubscribeUrl: '' }),
      );
      const html = renderEmailTemplate(REMINDER_TEMPLATE, ctx);
      expect(html).not.toContain('Islanders also love');
      expect(html).not.toContain('Open departures this week');
      expect(html).not.toContain('Unsubscribe from offers');
      expect(html).not.toContain('/unsubscribe/');
      // The footer itself survives, minus the picks promise.
      expect(html).toContain(
        'Island Tours · www.island.tours · Willemstad, Curaçao',
      );
      expect(html).toContain('Built by Islanders.');
    });

    it('the footer unsubscribe is the server-minted token URL, verbatim', () => {
      const html = renderEmailTemplate(
        REMINDER_TEMPLATE,
        buildReminderEmailContext(reminderInput()),
      );
      expect(html).toContain(
        '<a href="https://island.tours/unsubscribe/tok_test"',
      );
      expect(html).toContain('You get these picks as an Island Tours guest.');
      expect(html).toContain('(your booking emails always arrive).');
    });

    it('a card with no rating yet shows no fabricated number (LD11)', () => {
      const ctx = buildReminderEmailContext(
        reminderInput({
          crossSell: [
            {
              name: 'Brand New Tour',
              imageUrl: null,
              aggregateRating: null,
              aggregateReviewCount: 0,
              priceFrom: '40.00',
              currency: Currency.USD,
            },
            {
              name: 'Unpriced Tour',
              imageUrl: null,
              aggregateRating: 4.9,
              aggregateReviewCount: 0,
              priceFrom: null,
              currency: Currency.USD,
            },
          ],
        }),
      );
      expect(ctx.crossSellOneMetaPrefix).toBe('from ');
      expect(ctx.crossSellOnePrice).toBe('$40');
      // No price to follow => no dangling "from", and no review count in ().
      expect(ctx.crossSellTwoMetaPrefix).toBe('★ 4.9');
      expect(ctx.crossSellTwoPrice).toBe('');
    });
  });

  it('carries the weather flag straight from the tour snapshot', () => {
    expect(buildReminderEmailContext(reminderInput()).weatherDependent).toBe(
      true,
    );
    expect(
      buildReminderEmailContext(
        reminderInput({
          tour: { ...reminderInput().tour, weatherDependent: false },
        }),
      ).weatherDependent,
    ).toBe(false);
  });

  it('"back around" reads the local wall clock off the end snapshot', () => {
    expect(buildReminderEmailContext(reminderInput()).durationLine).toBe(
      'Duration: 9 hours, back around 17:00',
    );
    const noEnd = buildReminderEmailContext(
      reminderInput({
        booking: { ...reminderInput().booking, tourEndDateTime: null },
      }),
    );
    expect(noEnd.durationLine).toBe('Duration: 9 hours');
  });

  it('localises copy through the 7-locale module (de sample)', () => {
    const ctx = buildReminderEmailContext(
      reminderInput({
        booking: { ...reminderInput().booking, customerLocale: Locale.de },
      }),
    );
    expect(ctx.subjectLine).toBe('Morgen: Klein Curacao Day Trip · 08:00');
    expect(ctx.headline).toBe('Morgen geht es los, Denley.');
    expect(ctx.whatToBringTitle).toBe('Was du mitbringst');
    // Money still formats for the reader's locale, in the charged currency.
    expect(ctx.balanceAmount).toContain('160,00');
    expect(ctx.balanceNotePrefix).toBe('Dein Restbetrag von');
    expect(ctx.railTitle).toBe('Locals lieben außerdem...');
    // The German template renders with zero unresolved tokens too.
    expect(findUnresolvedTokens(REMINDER_TEMPLATE, ctx)).toEqual([]);
  });

  it('the text part mirrors the html and never contains markup', () => {
    const ctx = buildReminderEmailContext(reminderInput());
    const text = buildReminderEmailText(ctx);
    expect(text).toContain("You're set for tomorrow, Denley.");
    expect(text).toContain('Pickup: Hotel Brion');
    expect(text).toContain('- Towel');
    expect(text).not.toContain('<');
    // The balance sentence reassembles around the amount.
    expect(text).toContain(
      'Remaining balance: Your remaining balance of $160.00 runs through',
    );
    // The rail and its opt-out both reach the text part - a half-offered
    // unsubscribe is worse than none.
    expect(text).toContain(
      'West Coast Buggy Adventure - ★ 4.8 (212) · from $89 - Open departures this week',
    );
    expect(text).toContain(
      "Browse the Islanders' top picks: https://island.tours/en/curacao/tours/",
    );
    expect(text).toContain(
      'Unsubscribe from offers: https://island.tours/unsubscribe/tok_test',
    );
  });

  it('the text part drops the rail and the opt-out together', () => {
    const text = buildReminderEmailText(
      buildReminderEmailContext(
        reminderInput({ crossSell: [], unsubscribeUrl: '' }),
      ),
    );
    expect(text).not.toContain('Islanders also love');
    expect(text).not.toContain('Unsubscribe from offers');
    expect(text).toContain('Built by Islanders.');
  });
});

describe('buildConfirmationEmailSubject locales (B-18/B-22)', () => {
  const base = {
    tourName: 'Klein Curacao Day Trip',
    dateShort: '22. Mai 2026',
    start: startAt,
  };

  it('resolves the dated subject in the traveller locale', () => {
    expect(
      buildConfirmationEmailSubject({
        ...base,
        localNow: new Date(Date.UTC(2026, 4, 1, 8, 0)),
        locale: Locale.de,
      }),
    ).toBe('Gebucht: Klein Curacao Day Trip am 22. Mai 2026');
  });

  it('resolves the <24h today/tomorrow variants in the traveller locale', () => {
    expect(
      buildConfirmationEmailSubject({
        ...base,
        localNow: new Date(Date.UTC(2026, 4, 22, 6, 0)),
        locale: Locale.fr,
      }),
    ).toBe("Réservé pour aujourd'hui : Klein Curacao Day Trip");
    expect(
      buildConfirmationEmailSubject({
        ...base,
        localNow: new Date(Date.UTC(2026, 4, 21, 20, 0)),
        locale: Locale.nl,
      }),
    ).toBe('Geboekt voor morgen: Klein Curacao Day Trip');
  });
});
