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
  depositPctOf,
  durationLabel,
  preferLocale,
  toLocale,
  type ConfirmationEmailInput,
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
      languageLabel: 'English',
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
            languageLabel: null,
            endPoint: null,
            operatorNote: null,
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
        expect(String(ctx.relatedTourOnePrice)).toBe('from $45.00');
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
});
