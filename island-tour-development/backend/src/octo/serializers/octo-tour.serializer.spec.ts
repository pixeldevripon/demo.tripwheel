import { Prisma } from '@prisma/client';
import { OCTO_CAP } from '@/octo/common/octo-capabilities';
import {
  serializeTour,
  type OctoTourPayload,
} from './octo-tour.serializer';

/** Minimal-but-complete OctoTourPayload fixture (flat age bands: adult + child). */
function makeTour(overrides: Partial<OctoTourPayload> = {}): OctoTourPayload {
  const base = {
    id: 'tour-1',
    name: 'Curaçao Snorkel Safari',
    reference: 'CUR-SNK-01',
    timeZone: 'America/Curacao',
    allowFreesale: false,
    instantConfirmation: true,
    instantDelivery: true,
    availabilityRequired: true,
    availabilityType: 'START_TIME',
    deliveryFormats: ['PDF_URL', 'QRCODE'],
    deliveryMethods: ['VOUCHER'],
    redemptionMethod: 'DIGITAL',
    defaultCurrency: 'USD',
    pricingModel: 'PER_PERSON',
    minPartySize: 1,
    maxPartySize: 12,
    cancellationHours: 48,
    durationMinutesFrom: 240,
    durationMinutesTo: 240,
    ageBands: [
      {
        id: 'band-adult',
        label: 'Adult',
        minAge: 13,
        maxAge: 99,
        price: new Prisma.Decimal('79.99'),
        priceOriginal: null,
        priceNet: new Prisma.Decimal('63.99'),
        isDefault: true,
        displayOrder: 0,
      },
      {
        id: 'band-child',
        label: 'Child (4-12)',
        minAge: 4,
        maxAge: 12,
        price: new Prisma.Decimal('49.99'),
        priceOriginal: null,
        priceNet: null,
        isDefault: false,
        displayOrder: 1,
      },
    ],
    categories: [{ isPrimary: true, category: { slug: 'boat-tours' } }],
    images: [
      { url: 'https://cdn/1.jpg', isHero: true, altText: 'Reef', displayOrder: 0 },
      { url: 'https://cdn/2.jpg', isHero: false, altText: null, displayOrder: 1 },
    ],
    inclusions: [
      { translations: [{ locale: 'en', label: 'Snorkel gear & guide' }] },
    ],
    exclusions: [{ translations: [{ locale: 'en', label: 'Gratuities' }] }],
    features: [],
    locations: [
      {
        types: ['START'],
        latitude: 12.1,
        longitude: -68.9,
        streetAddress: 'Pier 1',
        addressLocality: 'Willemstad',
        addressRegion: null,
        postalCode: null,
        addressCountry: 'CW',
        minutesTo: 0,
        minutesAt: 30,
        translations: [
          { locale: 'en', title: 'Marina', shortDescription: 'Meet at the pier' },
        ],
      },
    ],
    languages: [{ language: 'en' }, { language: 'nl' }],
    translations: [
      {
        locale: 'en',
        title: 'Curaçao Snorkel Safari',
        overview: 'A half-day snorkel tour.',
        description: 'Full description.',
        shortDescription: 'Half-day guided snorkel tour.',
      },
    ],
  };
  return { ...base, ...overrides } as unknown as OctoTourPayload;
}

const EN = 'en' as const;

describe('serializeTour', () => {
  it('core (no capabilities): mandatory fields + options/units, NO pricing/content', () => {
    const out = serializeTour(makeTour(), { caps: new Set(), locale: EN });

    expect(out.id).toBe('tour-1');
    expect(out.internalName).toBe('Curaçao Snorkel Safari');
    expect(out.availabilityType).toBe('START_TIME');
    expect(out.deliveryFormats).toEqual(['PDF_URL', 'QRCODE']);

    // pricing-gated fields absent
    expect(out.defaultCurrency).toBeUndefined();
    expect(out.availableCurrencies).toBeUndefined();
    expect(out.pricingPer).toBeUndefined();

    // content-gated fields absent
    expect(out.title).toBeUndefined();
    expect(out.description).toBeUndefined();
    expect(out.features).toBeUndefined();
    expect(out.media).toBeUndefined();

    const opt = (out.options as Record<string, unknown>[])[0];
    expect(opt.default).toBe(true);
    expect(opt.cancellationCutoff).toBe('PT48H');
    expect(opt.restrictions).toEqual({ minUnits: 1, maxUnits: 12 });
    const units = opt.units as Record<string, unknown>[];
    expect(units).toHaveLength(2);
    expect(units[0].pricingFrom).toBeUndefined(); // pricing not requested
    expect(units[0].internalName).toBe('Adult');
    expect((units[1].restrictions as Record<string, unknown>)).toMatchObject({
      minAge: 4,
      maxAge: 12,
      paxCount: 1,
    });
  });

  it('octo/pricing: adds currency + pricingPer + minor-unit pricingFrom', () => {
    const out = serializeTour(makeTour(), {
      caps: new Set([OCTO_CAP.PRICING]),
      locale: EN,
    });

    expect(out.defaultCurrency).toBe('USD');
    expect(out.availableCurrencies).toEqual(['USD']);
    expect(out.pricingPer).toBe('UNIT'); // PER_PERSON → UNIT

    const opt = (out.options as Record<string, unknown>[])[0];
    // option "from" = cheapest unit (child 49.99)
    expect((opt.pricingFrom as Record<string, unknown>[])[0].retail).toBe(4999);

    const adult = (opt.units as Record<string, unknown>[])[0];
    const adultPricing = (adult.pricingFrom as Record<string, unknown>[])[0];
    expect(adultPricing).toMatchObject({
      retail: 7999,
      original: 7999,
      net: 6399,
      currency: 'USD',
      currencyPrecision: 2,
      includedTaxes: [],
    });
  });

  it('pricingPer is BOOKING when the tour prices per whole unit', () => {
    const out = serializeTour(makeTour({ pricingModel: 'UNIT' } as never), {
      caps: new Set([OCTO_CAP.PRICING]),
      locale: EN,
    });
    expect(out.pricingPer).toBe('BOOKING');
  });

  it('octo/content: adds localized title/description, features, media, locations, commentary', () => {
    const out = serializeTour(makeTour(), {
      caps: new Set([OCTO_CAP.CONTENT]),
      locale: EN,
      faqs: [{ question: 'Q?', answer: 'A.' }],
    });

    expect(out.title).toBe('Curaçao Snorkel Safari');
    expect(out.shortDescription).toBe('Half-day guided snorkel tour.');
    expect(out.description).toBe('Full description.');
    expect(out.durationMinutesFrom).toBe(240);

    expect(out.features).toEqual([
      { type: 'INCLUSION', shortDescription: 'Snorkel gear & guide' },
      { type: 'EXCLUSION', shortDescription: 'Gratuities' },
    ]);

    const media = out.media as Record<string, unknown>[];
    expect(media[0]).toMatchObject({ src: 'https://cdn/1.jpg', rel: 'COVER' });
    expect(media[1]).toMatchObject({ rel: 'GALLERY' });

    expect(out.categoryLabels).toEqual(['boat-tours']);
    expect(out.faqs).toEqual([{ question: 'Q?', answer: 'A.' }]);
    expect(out.commentary).toEqual([
      { format: 'IN_PERSON', language: 'en' },
      { format: 'IN_PERSON', language: 'nl' },
    ]);

    const loc = (out.locations as Record<string, unknown>[])[0];
    expect(loc.title).toBe('Marina');
    expect((loc.place as Record<string, unknown>).latitude).toBe(12.1);
  });

  it('content falls back to EN when the requested locale is missing', () => {
    const out = serializeTour(makeTour(), {
      caps: new Set([OCTO_CAP.CONTENT]),
      locale: 'de',
    });
    // only EN translation exists → falls back
    expect(out.title).toBe('Curaçao Snorkel Safari');
    expect(out.description).toBe('Full description.');
  });
});
