import { Prisma } from '@prisma/client';
import type { Currency, Locale } from '@prisma/client';
import { OCTO_CAP, type OctoCapabilitySet } from '@/octo/common/octo-capabilities';
import { buildPricing, type OctoPricing } from '@/octo/common/octo-money';

/**
 * Tour → OCTO Product serializer (spec §4.2–§4.4, §8.1).
 *
 * ## What it does
 * Maps our `Tour` (+ options/units/content children) onto the OCTO Product shape,
 * gating fields by the active capability set: core fields always; `octo/pricing`
 * adds currency/pricing; `octo/content` adds localized title/description/features/
 * media/locations/commentary. Money is emitted as integer minor units.
 *
 * ## Usage
 * The service loads a tour with {@link octoTourInclude}, then calls
 * `serializeTour(tour, { caps, locale, faqs })`.
 */

// ── Prisma query shape this serializer expects ────────────────────────────────
const translationSelect = {
  locale: true,
  title: true,
  overview: true,
  description: true,
  shortDescription: true,
} satisfies Prisma.TourTranslationSelect;

export const octoTourInclude = {
  ageBands: { orderBy: [{ isDefault: 'desc' }, { displayOrder: 'asc' }] },
  categories: { select: { isPrimary: true, category: { select: { slug: true } } } },
  images: { orderBy: { displayOrder: 'asc' } },
  inclusions: {
    orderBy: { displayOrder: 'asc' },
    include: { translations: { select: { locale: true, label: true } } },
  },
  exclusions: {
    orderBy: { displayOrder: 'asc' },
    include: { translations: { select: { locale: true, label: true } } },
  },
  features: {
    orderBy: { displayOrder: 'asc' },
    include: { translations: { select: { locale: true, text: true } } },
  },
  locations: {
    orderBy: { displayOrder: 'asc' },
    include: {
      translations: {
        select: { locale: true, title: true, shortDescription: true },
      },
    },
  },
  languages: true,
  translations: { select: translationSelect },
} satisfies Prisma.TourInclude;

export type OctoTourPayload = Prisma.TourGetPayload<{
  include: typeof octoTourInclude;
}>;

/** One FAQ line (already locale-resolved by the caller). */
export interface OctoFaq {
  question: string;
  answer: string;
}

interface SerializeTourOptions {
  caps: OctoCapabilitySet;
  /** Content locale (already negotiated from Accept-Language). */
  locale: Locale;
  /** Locale-resolved FAQs for this tour (content capability only). */
  faqs?: OctoFaq[];
}

// ── locale fallback helpers ───────────────────────────────────────────────────
function pick<T extends { locale: Locale }>(
  rows: T[],
  locale: Locale,
): T | undefined {
  return rows.find((r) => r.locale === locale) ?? rows.find((r) => r.locale === 'en');
}

function isoCutoff(amount: number, unit: string): string {
  switch (unit) {
    case 'minute':
      return `PT${amount}M`;
    case 'day':
      return `P${amount}D`;
    case 'hour':
    default:
      return `PT${amount}H`;
  }
}

// ── unit (= one age band) ───────────────────────────────────────────────────────
function serializeUnit(
  band: OctoTourPayload['ageBands'][number],
  currency: Currency,
  withPricing: boolean,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: band.id,
    internalName: band.label,
    reference: null,
    restrictions: {
      minAge: band.minAge,
      maxAge: band.maxAge,
      paxCount: 1,
    },
  };

  if (withPricing) {
    const pricing: OctoPricing = buildPricing({
      retail: band.price,
      original: band.priceOriginal,
      net: band.priceNet,
      currency,
    });
    out.pricingFrom = [pricing];
  }

  return out;
}

// ── option (synthesized single DEFAULT from tour-level fields) ────────────────────
function serializeOption(
  tour: OctoTourPayload,
  currency: Currency,
  withPricing: boolean,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: 'DEFAULT',
    default: true,
    internalName: 'Standard',
    reference: null,
    availabilityLocalStartTimes: [],
    cancellationCutoff: isoCutoff(tour.cancellationHours, 'hour'),
    cancellationCutoffAmount: tour.cancellationHours,
    cancellationCutoffUnit: 'hour',
    requiredContactFields: ['firstName', 'lastName', 'emailAddress'],
    restrictions: {
      minUnits: tour.minPartySize,
      maxUnits: tour.maxPartySize,
    },
    units: tour.ageBands.map((b) => serializeUnit(b, currency, withPricing)),
  };

  if (withPricing) {
    // Option "from" price = cheapest age band's retail.
    const cheapest = tour.ageBands
      .map((b) =>
        buildPricing({
          retail: b.price,
          original: b.priceOriginal,
          net: b.priceNet,
          currency,
        }),
      )
      .sort((a, b) => a.retail - b.retail)[0];
    out.pricingFrom = cheapest ? [cheapest] : [];
  }

  return out;
}

// ── content (octo/content) ──────────────────────────────────────────────────────
function serializeContent(
  tour: OctoTourPayload,
  locale: Locale,
  faqs: OctoFaq[],
): Record<string, unknown> {
  const t = pick(tour.translations, locale);

  const features = [
    ...tour.inclusions.map((i) => ({
      type: 'INCLUSION' as const,
      shortDescription: pick(i.translations, locale)?.label ?? null,
    })),
    ...tour.exclusions.map((e) => ({
      type: 'EXCLUSION' as const,
      shortDescription: pick(e.translations, locale)?.label ?? null,
    })),
    ...tour.features.map((f) => ({
      type: f.type,
      shortDescription: pick(f.translations, locale)?.text ?? null,
    })),
  ].filter((f) => f.shortDescription !== null);

  const media = tour.images.map((img) => ({
    src: img.url,
    type: 'image/jpeg',
    rel: img.isHero ? 'COVER' : 'GALLERY',
    title: null,
    caption: img.altText ?? null,
    copyright: null,
  }));

  const locations = tour.locations.map((loc) => {
    const lt = pick(loc.translations, locale);
    return {
      title: lt?.title ?? '',
      shortDescription: lt?.shortDescription ?? null,
      types: loc.types,
      minutesTo: loc.minutesTo,
      minutesAt: loc.minutesAt,
      place: {
        latitude: loc.latitude,
        longitude: loc.longitude,
        postalAddress: {
          streetAddress: loc.streetAddress,
          addressLocality: loc.addressLocality,
          addressRegion: loc.addressRegion,
          postalCode: loc.postalCode,
          addressCountry: loc.addressCountry,
          postOfficeBoxNumber: null,
        },
      },
    };
  });

  const commentary = tour.languages.map((l) => ({
    format: 'IN_PERSON',
    language: l.language,
  }));

  const categoryLabels = tour.categories.map((c) => c.category.slug);

  return {
    title: t?.title ?? tour.name,
    shortDescription: t?.shortDescription ?? null,
    description: t?.description ?? t?.overview ?? null,
    durationMinutesFrom: tour.durationMinutesFrom,
    durationMinutesTo: tour.durationMinutesTo,
    features,
    faqs,
    media,
    locations,
    categoryLabels,
    commentary,
  };
}

// ── top-level Product ────────────────────────────────────────────────────────────
export function serializeTour(
  tour: OctoTourPayload,
  { caps, locale, faqs = [] }: SerializeTourOptions,
): Record<string, unknown> {
  const withPricing = caps.has(OCTO_CAP.PRICING);
  const withContent = caps.has(OCTO_CAP.CONTENT);
  const currency = tour.defaultCurrency;

  const product: Record<string, unknown> = {
    // ── Core ──
    id: tour.id,
    internalName: tour.name,
    reference: tour.reference,
    locale,
    timeZone: tour.timeZone,
    allowFreesale: tour.allowFreesale,
    instantConfirmation: tour.instantConfirmation,
    instantDelivery: tour.instantDelivery,
    availabilityRequired: tour.availabilityRequired,
    availabilityType: tour.availabilityType,
    deliveryFormats: tour.deliveryFormats,
    deliveryMethods: tour.deliveryMethods,
    redemptionMethod: tour.redemptionMethod,
    options: [serializeOption(tour, currency, withPricing)],
  };

  if (withPricing) {
    product.defaultCurrency = currency;
    product.availableCurrencies = [currency];
    // PricingModel.PER_PERSON → per participant (UNIT); UNIT (whole boat) → per booking.
    product.pricingPer = tour.pricingModel === 'UNIT' ? 'BOOKING' : 'UNIT';
  }

  if (withContent) {
    Object.assign(product, serializeContent(tour, locale, faqs));
  }

  return product;
}
