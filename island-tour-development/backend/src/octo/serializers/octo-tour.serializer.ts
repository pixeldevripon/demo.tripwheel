import { Prisma } from '@prisma/client';
import type { Currency, Locale } from '@prisma/client';
import {
  OCTO_CAP,
  type OctoCapabilitySet,
} from '@/octo/common/octo-capabilities';
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
  categories: {
    select: { isPrimary: true, category: { select: { slug: true } } },
  },
  images: { orderBy: { displayOrder: 'asc' } },
  highlights: {
    orderBy: { displayOrder: 'asc' },
    include: { translations: { select: { locale: true, text: true } } },
  },
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
  return (
    rows.find((r) => r.locale === locale) ?? rows.find((r) => r.locale === 'en')
  );
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

// ── Derived OCTO features ─────────────────────────────────────────────────────
// Four FeatureTypes duplicate structured tour fields the platform owns
// (cancellation window, check-in lead, wheelchair access, instant confirmation).
// Operators no longer hand-write these in the Features tab; the OCTO content feed
// synthesizes them here from the structured fields so the feed stays complete and
// can never disagree with the public site (single source of truth). Any legacy
// TourFeature rows of these types are filtered out before this runs.
const DERIVED_FEATURE_TYPES = new Set<string>([
  'CANCELLATION_TERM',
  'PREARRIVAL_INFORMATION',
  'ACCESSIBILITY_INFORMATION',
  'BOOKING_TERM',
]);

interface DerivedFeatureStrings {
  cancellation: string; // "{hours}" placeholder
  prearrival: string; // "{minutes}" placeholder
  accessibleYes: string;
  accessibleNo: string;
  bookingInstant: string;
  bookingOperator: string;
}

const DERIVED_FEATURE_I18N: Record<Locale, DerivedFeatureStrings> = {
  en: {
    cancellation:
      'Free cancellation up to {hours} hours before the start time for a full refund.',
    prearrival:
      'Please arrive {minutes} minutes before the start time. Bring your booking confirmation.',
    accessibleYes:
      'This tour is wheelchair accessible. Contact us for specific needs.',
    accessibleNo:
      'This tour is not wheelchair accessible. Contact us to discuss accessibility.',
    bookingInstant:
      'Instant confirmation. You will receive your voucher by email immediately after booking.',
    bookingOperator:
      'Your booking is confirmed by the operator after review.',
  },
  nl: {
    cancellation:
      'Gratis annuleren tot {hours} uur voor de starttijd voor volledige terugbetaling.',
    prearrival:
      'Kom {minutes} minuten voor de starttijd aan. Neem je boekingsbevestiging mee.',
    accessibleYes:
      'Deze tour is rolstoeltoegankelijk. Neem contact op voor specifieke wensen.',
    accessibleNo:
      'Deze tour is niet rolstoeltoegankelijk. Neem contact op om toegankelijkheid te bespreken.',
    bookingInstant:
      'Directe bevestiging. Je ontvangt je voucher direct na de boeking per e-mail.',
    bookingOperator:
      'Je boeking wordt na beoordeling door de aanbieder bevestigd.',
  },
  de: {
    cancellation:
      'Kostenlose Stornierung bis {hours} Stunden vor Beginn für eine volle Rückerstattung.',
    prearrival:
      'Bitte {minutes} Minuten vor Beginn eintreffen. Bring deine Buchungsbestätigung mit.',
    accessibleYes:
      'Diese Tour ist rollstuhlgerecht. Kontaktiere uns für spezielle Bedürfnisse.',
    accessibleNo:
      'Diese Tour ist nicht rollstuhlgerecht. Kontaktiere uns, um die Barrierefreiheit zu besprechen.',
    bookingInstant:
      'Sofortige Bestätigung. Du erhältst deinen Gutschein direkt nach der Buchung per E-Mail.',
    bookingOperator:
      'Deine Buchung wird nach Prüfung durch den Anbieter bestätigt.',
  },
  fr: {
    cancellation:
      "Annulation gratuite jusqu'à {hours} heures avant le début pour un remboursement intégral.",
    prearrival:
      "Merci d'arriver {minutes} minutes avant le début. Apportez votre confirmation de réservation.",
    accessibleYes:
      'Cette visite est accessible en fauteuil roulant. Contactez-nous pour des besoins spécifiques.',
    accessibleNo:
      "Cette visite n'est pas accessible en fauteuil roulant. Contactez-nous pour en discuter.",
    bookingInstant:
      'Confirmation immédiate. Vous recevrez votre bon par e-mail juste après la réservation.',
    bookingOperator:
      "Votre réservation est confirmée par l'opérateur après vérification.",
  },
  es: {
    cancellation:
      'Cancelación gratuita hasta {hours} horas antes del inicio para un reembolso completo.',
    prearrival:
      'Llega {minutes} minutos antes del inicio. Lleva tu confirmación de reserva.',
    accessibleYes:
      'Este tour es accesible para sillas de ruedas. Contáctanos para necesidades específicas.',
    accessibleNo:
      'Este tour no es accesible para sillas de ruedas. Contáctanos para hablar sobre accesibilidad.',
    bookingInstant:
      'Confirmación inmediata. Recibirás tu bono por correo justo después de reservar.',
    bookingOperator: 'Tu reserva la confirma el operador tras revisarla.',
  },
  pt: {
    cancellation:
      'Cancelamento gratuito até {hours} horas antes do início para reembolso total.',
    prearrival:
      'Chegue {minutes} minutos antes do início. Leve a sua confirmação de reserva.',
    accessibleYes:
      'Este passeio é acessível a cadeiras de rodas. Contacte-nos para necessidades específicas.',
    accessibleNo:
      'Este passeio não é acessível a cadeiras de rodas. Contacte-nos para falar sobre acessibilidade.',
    bookingInstant:
      'Confirmação imediata. Receberá o seu voucher por e-mail logo após a reserva.',
    bookingOperator: 'A sua reserva é confirmada pelo operador após análise.',
  },
  zh: {
    cancellation: '在开始时间前 {hours} 小时可免费取消并获全额退款。',
    prearrival: '请在开始时间前 {minutes} 分钟到达，并携带您的预订确认。',
    accessibleYes: '本行程可供轮椅通行。如有特殊需求请联系我们。',
    accessibleNo: '本行程不提供轮椅通行。如需了解无障碍安排请联系我们。',
    bookingInstant: '即时确认。预订后您将立即收到电子邮件凭证。',
    bookingOperator: '您的预订将在运营商审核后确认。',
  },
};

function buildDerivedFeatures(
  tour: OctoTourPayload,
  locale: Locale,
): { type: string; shortDescription: string }[] {
  const s = DERIVED_FEATURE_I18N[locale] ?? DERIVED_FEATURE_I18N.en;
  const out = [
    {
      type: 'CANCELLATION_TERM',
      shortDescription: s.cancellation.replace(
        '{hours}',
        String(tour.cancellationHours),
      ),
    },
    {
      type: 'ACCESSIBILITY_INFORMATION',
      shortDescription: tour.wheelchairAccessible
        ? s.accessibleYes
        : s.accessibleNo,
    },
    {
      type: 'BOOKING_TERM',
      shortDescription: tour.instantConfirmation
        ? s.bookingInstant
        : s.bookingOperator,
    },
  ];
  if (tour.checkInMinutesBefore != null) {
    out.push({
      type: 'PREARRIVAL_INFORMATION',
      shortDescription: s.prearrival.replace(
        '{minutes}',
        String(tour.checkInMinutesBefore),
      ),
    });
  }
  return out;
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
    ...tour.highlights.map((h) => ({
      type: 'HIGHLIGHT' as const,
      shortDescription: pick(h.translations, locale)?.text ?? null,
    })),
    ...tour.inclusions.map((i) => ({
      type: 'INCLUSION' as const,
      shortDescription: pick(i.translations, locale)?.label ?? null,
    })),
    ...tour.exclusions.map((e) => ({
      type: 'EXCLUSION' as const,
      shortDescription: pick(e.translations, locale)?.label ?? null,
    })),
    // Free-text feature types only; the four structured-backed types
    // (cancellation/pre-arrival/accessibility/booking) are synthesized below.
    ...tour.features
      .filter((f) => !DERIVED_FEATURE_TYPES.has(f.type))
      .map((f) => ({
        type: f.type,
        shortDescription: pick(f.translations, locale)?.text ?? null,
      })),
    ...buildDerivedFeatures(tour, locale),
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
