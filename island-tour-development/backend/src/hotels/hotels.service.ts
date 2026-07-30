import { Locale } from '@/common/constants/locales';
import { mergeTranslation } from '@/common/utils/translation.util';
import { ContentTranslationEnqueuer } from '@/content-translation/content-translation.enqueuer';
import { PrismaService } from '@/prisma/prisma.service';
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Currency, Prisma } from '@prisma/client';
import {
  CreateHotelDto,
  UpdateHotelDto,
  UpsertHotelTranslationDto,
} from './dto/hotel.dto';

const TRANSLATION_SELECT = {
  locale: true,
  eyebrow: true,
  areaLabel: true,
  title: true,
  description: true,
  ctaLabel: true,
  isMachineTranslated: true,
} as const;

const BASE_SELECT = {
  id: true,
  isEnabled: true,
  displayOrder: true,
  isSeeded: true,
  imageUrl: true,
  bookingUrl: true,
  rating: true,
  reviewCount: true,
  sleeps: true,
  pricePerNight: true,
  currency: true,
} as const;

/**
 * Which hotel the card shows: lowest `displayOrder` wins, `id` breaking ties so
 * the choice is stable across requests when an admin has left several on 0.
 */
const PROMOTION_ORDER: Prisma.HotelOrderByWithRelationInput[] = [
  { displayOrder: 'asc' },
  { id: 'asc' },
];

/**
 * Prisma hands Decimals back as Decimal objects, which serialize to JSON as
 * STRINGS. The card does arithmetic and formatting on these, so converting once
 * here beats every consumer re-parsing `"4.8"` on every render.
 */
function num(value: Prisma.Decimal | null): number | null {
  return value === null ? null : value.toNumber();
}

/**
 * EXPORTED, and it has to be: the controller's methods return these shapes by
 * inference, and Nest's build emits declarations - an unexported local interface
 * makes every one of those a TS4053 ("cannot be named"). `tsc --noEmit` does not
 * catch it, because it never emits the declaration that fails.
 */
export interface HotelRow {
  id: string;
  isEnabled: boolean;
  displayOrder: number;
  isSeeded: boolean;
  imageUrl: string | null;
  bookingUrl: string | null;
  rating: Prisma.Decimal | null;
  reviewCount: number | null;
  sleeps: number | null;
  pricePerNight: Prisma.Decimal | null;
  currency: Currency;
}

export interface TranslationRow {
  locale: Locale;
  eyebrow: string | null;
  areaLabel: string | null;
  title: string | null;
  description: string | null;
  ctaLabel: string | null;
  isMachineTranslated: boolean;
}

@Injectable()
export class HotelsService {
  private readonly logger = new Logger(HotelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contentTranslation: ContentTranslationEnqueuer,
  ) {}

  // ── Public read ─────────────────────────────────────────────────────────────

  /**
   * The one hotel the thank-you page should promote, for one locale.
   *
   * Deliberately read-only: an anonymous GET must never write.
   *
   * Unlike the homepage's "null means keep the bundled default" contract, this
   * one hands the frontend a single `enabled` verdict and nulls everything when
   * it is false. The missing pieces here have no honest built-in fallback: there
   * is no bundled property name, photo or booking link, and inventing one would
   * advertise a place that does not exist. Deciding it server-side also means the
   * gate can gain a condition without a frontend deploy, and a frontend bug
   * cannot render half a card.
   *
   * A hotel that is enabled but INCOMPLETE is skipped rather than ending the
   * search - otherwise a half-filled row sitting at `displayOrder: 0` would
   * silently suppress the perfectly good one behind it. Which is why the whole
   * enabled set is read and then walked in promotion order.
   */
  async getPublic(locale: Locale) {
    const rows = await this.prisma.hotel.findMany({
      where: { isEnabled: true },
      select: {
        ...BASE_SELECT,
        // Both locales: `mergeTranslation` fills any field the locale row leaves
        // blank from English, so a translated title with an untranslated pitch
        // shows the English pitch rather than nothing.
        translations: {
          where: { locale: { in: [locale, Locale.en] } },
          select: TRANSLATION_SELECT,
        },
      },
      orderBy: PROMOTION_ORDER,
    });

    for (const row of rows) {
      const payload = this.toPublicPayload(row, row.translations, locale);
      if (payload) return payload;
    }

    return this.hiddenPayload(locale);
  }

  /**
   * One row as the card would render it, or null when it fails the gate.
   *
   * THE GATE: the card is a 50/50 photo-and-details split whose only action is
   * its button, so an image, a name and a link are all load-bearing - without any
   * one of them this hotel is not promotable.
   */
  private toPublicPayload(
    row: HotelRow,
    translations: TranslationRow[],
    locale: Locale,
  ) {
    const copy = mergeTranslation(translations, locale);
    const title = copy?.title?.trim() || null;

    if (!row.imageUrl || !row.bookingUrl || !title) return null;

    return {
      enabled: true,
      locale,
      imageUrl: row.imageUrl,
      bookingUrl: row.bookingUrl,
      rating: num(row.rating),
      reviewCount: row.reviewCount,
      sleeps: row.sleeps,
      pricePerNight: num(row.pricePerNight),
      currency: row.currency,
      eyebrow: copy?.eyebrow?.trim() || null,
      areaLabel: copy?.areaLabel?.trim() || null,
      title,
      descriptionLines: splitLines(copy?.description),
      ctaLabel: copy?.ctaLabel?.trim() || null,
    };
  }

  /**
   * The "do not render" answer, content and all.
   *
   * Every field is nulled rather than merely flagged: the shape is identical to
   * the enabled one, so a caller that forgets the flag renders an empty card
   * instead of leaking a half-configured promo, and the currency still carries a
   * real value because the frontend types it as an enum, not a maybe.
   */
  private hiddenPayload(locale: Locale) {
    return {
      enabled: false,
      locale,
      imageUrl: null,
      bookingUrl: null,
      rating: null,
      reviewCount: null,
      sleeps: null,
      pricePerNight: null,
      currency: Currency.USD,
      eyebrow: null,
      areaLabel: null,
      title: null,
      descriptionLines: [] as string[],
      ctaLabel: null,
    };
  }

  // ── Admin ───────────────────────────────────────────────────────────────────

  /**
   * Every hotel in promotion order, each with its stored locales.
   *
   * `isPromoted` is decided across the WHOLE list, not per row, because that is
   * what it means: exactly one hotel reaches the site, and it is the first
   * complete enabled one. A row-by-row "this one is valid" flag would show three
   * hotels all claiming to be live.
   */
  async findAll() {
    const rows = await this.prisma.hotel.findMany({
      select: {
        ...BASE_SELECT,
        translations: {
          select: TRANSLATION_SELECT,
          orderBy: { locale: 'asc' },
        },
      },
      orderBy: PROMOTION_ORDER,
    });

    const promotedId = rows.find(
      (row) => row.isEnabled && this.isComplete(row, row.translations),
    )?.id;

    return rows.map((row) => this.toAdminShape(row, row.id === promotedId));
  }

  async findOne(id: string) {
    const row = await this.prisma.hotel.findUnique({
      where: { id },
      select: {
        ...BASE_SELECT,
        translations: {
          select: TRANSLATION_SELECT,
          orderBy: { locale: 'asc' },
        },
      },
    });
    if (!row) throw new NotFoundException(`Hotel ${id} not found`);

    // Whether THIS row is the one on the site needs the others too: a complete
    // hotel ahead of it in promotion order takes the card.
    const promoted = await this.resolvePromotedId();
    return this.toAdminShape(row, row.id === promoted);
  }

  async create(dto: CreateHotelDto, adminId: string) {
    const { title, description, areaLabel, eyebrow, ctaLabel, ...base } = dto;

    const row = await this.prisma.hotel.create({
      data: {
        ...base,
        // English copy is created WITH the row rather than left to a second
        // request: the title is part of the render gate, so a hotel with no
        // translation row could never be promoted, and a half-created one is
        // exactly the state an admin cannot see or diagnose.
        translations: {
          create: {
            locale: Locale.en,
            title,
            description,
            areaLabel,
            eyebrow,
            ctaLabel,
          },
        },
      },
      select: { id: true },
    });

    this.logger.log(`Admin ${adminId} created hotel ${row.id}`);
    // New English copy needs translating into the other six locales.
    this.contentTranslation.enqueue('hotel', row.id);
    return this.findOne(row.id);
  }

  async update(id: string, dto: UpdateHotelDto, adminId: string) {
    await this.assertExists(id);

    await this.prisma.hotel.update({
      where: { id },
      data: {
        ...(dto.isEnabled !== undefined && { isEnabled: dto.isEnabled }),
        ...(dto.displayOrder !== undefined && {
          displayOrder: dto.displayOrder,
        }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.bookingUrl !== undefined && { bookingUrl: dto.bookingUrl }),
        ...(dto.rating !== undefined && { rating: dto.rating }),
        ...(dto.reviewCount !== undefined && { reviewCount: dto.reviewCount }),
        ...(dto.sleeps !== undefined && { sleeps: dto.sleeps }),
        ...(dto.pricePerNight !== undefined && {
          pricePerNight: dto.pricePerNight,
        }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
      },
      select: { id: true },
    });

    this.logger.log(`Admin ${adminId} updated hotel ${id}`);
    // Re-read so the response carries `isPromoted` and the translations - the
    // editor needs both to redraw, and computing the gate in one place is what
    // keeps it from drifting between reads.
    return this.findOne(id);
  }

  /**
   * Delete a hotel. Seeded rows are protected, the same contract as
   * `Destination.isSeeded`: the promo keeps one guaranteed occupant, so the
   * section cannot be emptied by an accidental delete - only switched off
   * deliberately via `isEnabled`.
   *
   * Translations go with it (FK cascade). There is nothing else to detach - a
   * hotel is referenced by no booking, tour or slug row, which is exactly why
   * this is a hard delete rather than an archive.
   */
  async remove(id: string, adminId: string) {
    const hotel = await this.prisma.hotel.findUnique({
      where: { id },
      select: { id: true, isSeeded: true },
    });
    if (!hotel) throw new NotFoundException(`Hotel ${id} not found`);

    if (hotel.isSeeded) {
      throw new ForbiddenException(
        'Seeded hotels cannot be deleted. Switch it off instead if it should ' +
          'not be promoted.',
      );
    }

    await this.prisma.hotel.delete({ where: { id } });
    this.logger.log(`Admin ${adminId} deleted hotel ${id}`);
    return { message: 'Hotel deleted successfully' };
  }

  async getTranslations(id: string) {
    await this.assertExists(id);

    return this.prisma.hotelTranslation.findMany({
      where: { hotelId: id },
      select: TRANSLATION_SELECT,
      orderBy: { locale: 'asc' },
    });
  }

  async upsertTranslation(
    id: string,
    locale: Locale,
    dto: UpsertHotelTranslationDto,
    adminId: string,
  ) {
    await this.assertExists(id);

    const { fields, isMachineTranslated } = dto;

    const result = await this.prisma.hotelTranslation.upsert({
      where: { hotelId_locale: { hotelId: id, locale } },
      create: {
        hotelId: id,
        locale,
        isMachineTranslated: isMachineTranslated ?? false,
        eyebrow: fields.eyebrow,
        areaLabel: fields.areaLabel,
        title: fields.title,
        description: fields.description,
        ctaLabel: fields.ctaLabel,
      },
      update: {
        isMachineTranslated: isMachineTranslated ?? false,
        // Human write path: reset the AI bookkeeping so the machine refresher
        // never overwrites what was typed here.
        sourceHash: null,
        ...(fields.eyebrow !== undefined && { eyebrow: fields.eyebrow }),
        ...(fields.areaLabel !== undefined && { areaLabel: fields.areaLabel }),
        ...(fields.title !== undefined && { title: fields.title }),
        ...(fields.description !== undefined && {
          description: fields.description,
        }),
        ...(fields.ctaLabel !== undefined && { ctaLabel: fields.ctaLabel }),
      },
      select: TRANSLATION_SELECT,
    });

    this.logger.log(`Admin ${adminId} upserted hotel ${id} copy [${locale}]`);
    // An English edit re-sources the other locales.
    if (locale === Locale.en) {
      this.contentTranslation.enqueue('hotel', id);
    }
    return result;
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  /** The admin shape: numbers instead of Decimals, plus the promotion verdict. */
  private toAdminShape(
    row: HotelRow & { translations: TranslationRow[] },
    isPromoted: boolean,
  ) {
    return {
      ...row,
      rating: num(row.rating),
      pricePerNight: num(row.pricePerNight),
      /**
       * Whether this hotel is the one the public site is showing right now.
       * Surfaced because the failure mode is silent: a hotel with no booking link
       * simply never appears, and an admin has no other way to find that out.
       */
      isPromoted,
      /** Whether it COULD be promoted - the render gate, minus the switch. */
      isComplete: this.isComplete(row, row.translations),
    };
  }

  /**
   * The render gate, judged on ENGLISH copy: English is what every other locale
   * falls back to, so a Dutch-only title would leave six locales with no name.
   */
  private isComplete(row: HotelRow, translations: TranslationRow[]): boolean {
    const en = translations.find((t) => t.locale === Locale.en);
    return !!row.imageUrl && !!row.bookingUrl && !!en?.title?.trim();
  }

  /** Id of the hotel the public site is promoting, or undefined if none is. */
  private async resolvePromotedId(): Promise<string | undefined> {
    const rows = await this.prisma.hotel.findMany({
      where: { isEnabled: true },
      select: {
        ...BASE_SELECT,
        translations: {
          where: { locale: Locale.en },
          select: TRANSLATION_SELECT,
        },
      },
      orderBy: PROMOTION_ORDER,
    });

    return rows.find((row) => this.isComplete(row, row.translations))?.id;
  }

  private async assertExists(id: string) {
    const found = await this.prisma.hotel.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException(`Hotel ${id} not found`);
  }
}

/**
 * The stored description, one entry per paragraph on the card.
 *
 * Newline-separated rather than a child table: it is two short strings in the
 * design, and a repeatable row per line would be a table, an ordering column and
 * an editor for something an admin types in one textarea. Blank lines are
 * dropped so a trailing return does not render an empty paragraph.
 */
function splitLines(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
