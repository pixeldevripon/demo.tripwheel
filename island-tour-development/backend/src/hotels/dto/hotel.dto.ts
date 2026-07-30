import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency, Locale } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * The image URL is rendered by `next/image`, which THROWS at render time on a
 * malformed src - so one bad save would break the thank-you page for every
 * traveller who just paid. Require a real https URL and cap the length.
 *
 * Host allow-listing is NOT duplicated here: the frontend owns that list
 * (`remotePatterns`) and a second copy would be a second thing to drift.
 */
const URL_MAX_LENGTH = 2048;
const URL_RULES = { protocols: ['https'], require_protocol: true };

/** Ceilings that only stop absurd input; the card has no layout beyond these. */
const SHORT_TEXT_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 600;

/** A rating is out of 5, and nobody sleeps 500 people in an apartment. */
const MAX_RATING = 5;
const MAX_SLEEPS = 99;
const MAX_PRICE = 1_000_000;

// ── Response DTOs ─────────────────────────────────────────────────────────────

/**
 * The PROMOTED hotel for one locale: the record flattened together with that
 * locale's copy. The thank-you page renders one card, so this is one hotel - the
 * first enabled, complete one in `displayOrder`.
 *
 * `enabled` IS THE CONTRACT. Unlike the homepage - where every null field falls
 * back to a bundled dictionary default - a property's name, photo and booking
 * link have no sensible built-in, because inventing one would advertise a place
 * that does not exist. So the service decides here whether the card is renderable
 * at all, and everything is nulled out when it is not: the frontend cannot
 * accidentally render half a card, and a future gate condition needs no frontend
 * deploy.
 */
export class PublicHotelResponseDto {
  @ApiProperty({
    example: true,
    description:
      'Whether the public site should render the card at all. False when NO ' +
      'hotel qualifies: every one is either switched off or missing one of the ' +
      'three essentials (image, title, booking link). Every other field is null ' +
      'in that case.',
  })
  enabled!: boolean;

  @ApiProperty({ enum: Locale, example: Locale.en })
  locale!: Locale;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/demo/image/upload/palm-suite.jpg',
    nullable: true,
  })
  imageUrl!: string | null;

  @ApiPropertyOptional({ example: 'https://www.airbnb.com', nullable: true })
  bookingUrl!: string | null;

  @ApiPropertyOptional({
    example: 4.8,
    nullable: true,
    description:
      'A NUMBER, not the Decimal string Prisma hands back - the card formats ' +
      'it and would otherwise have to re-parse it on every render.',
  })
  rating!: number | null;

  @ApiPropertyOptional({ example: 1738, nullable: true })
  reviewCount!: number | null;

  @ApiPropertyOptional({ example: 4, nullable: true })
  sleeps!: number | null;

  @ApiPropertyOptional({ example: 160, nullable: true })
  pricePerNight!: number | null;

  @ApiProperty({
    enum: Currency,
    example: Currency.USD,
    description:
      "The price's OWN currency. It travels with the amount so the card " +
      'renders that currency symbol - it must never print a hardcoded $ over ' +
      'a euro price.',
  })
  currency!: Currency;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'Null keeps the bundled (already translated) eyebrow label.',
  })
  eyebrow!: string | null;

  @ApiPropertyOptional({ example: 'Jan Thiel', nullable: true })
  areaLabel!: string | null;

  @ApiPropertyOptional({ example: 'Palm Suite Apartment', nullable: true })
  title!: string | null;

  @ApiProperty({
    type: [String],
    example: [
      'Quiet, modern, 5min from the beach',
      'Owned and hosted by Island Tours',
    ],
    description:
      'The stored description split on newlines, blank lines dropped - the ' +
      'card renders one paragraph per entry. Split here rather than on the ' +
      'frontend so the wire shape says what the card actually needs.',
  })
  descriptionLines!: string[];

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'Null keeps the bundled (already translated) CTA label.',
  })
  ctaLabel!: string | null;
}

/** One locale's stored copy, as returned to the dashboard. */
export class HotelTranslationEntryDto {
  @ApiProperty({ enum: Locale, example: Locale.nl })
  locale!: Locale;

  @ApiPropertyOptional({ nullable: true })
  eyebrow!: string | null;

  @ApiPropertyOptional({ nullable: true })
  areaLabel!: string | null;

  @ApiPropertyOptional({ nullable: true })
  title!: string | null;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  ctaLabel!: string | null;

  @ApiProperty({ example: false })
  isMachineTranslated!: boolean;
}

/** The admin view of one hotel: the record plus every stored locale. */
export class HotelResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({
    example: true,
    description: 'Whether this hotel may be promoted at all.',
  })
  isEnabled!: boolean;

  @ApiProperty({
    example: 0,
    description:
      'Promotion priority - the lowest enabled, complete hotel takes the card.',
  })
  displayOrder!: number;

  @ApiProperty({
    example: true,
    description:
      'Seeded hotels cannot be deleted (403), the same protection seeded ' +
      'destinations have. Switch it off instead.',
  })
  isSeeded!: boolean;

  @ApiPropertyOptional({ nullable: true })
  imageUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  bookingUrl!: string | null;

  @ApiPropertyOptional({ example: 4.8, nullable: true })
  rating!: number | null;

  @ApiPropertyOptional({ example: 1738, nullable: true })
  reviewCount!: number | null;

  @ApiPropertyOptional({ example: 4, nullable: true })
  sleeps!: number | null;

  @ApiPropertyOptional({ example: 160, nullable: true })
  pricePerNight!: number | null;

  @ApiProperty({ enum: Currency, example: Currency.USD })
  currency!: Currency;

  @ApiProperty({
    example: true,
    description:
      'Whether THIS hotel is the one on the public site right now - decided ' +
      'across the whole list, since exactly one is promoted. The editor shows ' +
      'it rather than leaving an admin to discover that a half-filled hotel ' +
      'never reached the site.',
  })
  isPromoted!: boolean;

  @ApiProperty({
    example: true,
    description:
      'Whether it COULD be promoted: the render gate (image + English title + ' +
      'booking link), minus the on/off switch.',
  })
  isComplete!: boolean;

  @ApiProperty({ type: [HotelTranslationEntryDto] })
  translations!: HotelTranslationEntryDto[];
}

// ── Query DTOs ────────────────────────────────────────────────────────────────

export class HotelLocaleQueryDto {
  @ApiPropertyOptional({ enum: Locale, default: Locale.en })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

/**
 * Locale-agnostic apartment fields. Every property is optional so a PATCH only
 * touches what it names; an explicit `null` clears one.
 */
export class UpdateHotelDto {
  @ApiPropertyOptional({
    example: true,
    description:
      'Master switch. Off hides the card whatever else is filled in.',
  })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({
    example: 0,
    description:
      'Promotion priority. The lowest enabled, complete hotel takes the card.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/demo/image/upload/palm-suite.jpg',
    nullable: true,
  })
  @IsOptional()
  @IsUrl(URL_RULES)
  @MaxLength(URL_MAX_LENGTH)
  imageUrl?: string | null;

  @ApiPropertyOptional({ example: 'https://www.airbnb.com', nullable: true })
  @IsOptional()
  @IsUrl(URL_RULES)
  @MaxLength(URL_MAX_LENGTH)
  bookingUrl?: string | null;

  @ApiPropertyOptional({
    example: 4.8,
    nullable: true,
    description: 'Out of 5, one decimal place.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(MAX_RATING)
  rating?: number | null;

  @ApiPropertyOptional({ example: 1738, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  reviewCount?: number | null;

  @ApiPropertyOptional({ example: 4, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_SLEEPS)
  sleeps?: number | null;

  @ApiPropertyOptional({ example: 160, nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_PRICE)
  pricePerNight?: number | null;

  @ApiPropertyOptional({ enum: Currency, example: Currency.USD })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;
}

/**
 * Creating a hotel. Extends the update shape with the ENGLISH COPY, which is
 * written in the same transaction as the row.
 *
 * The title is the only required field in the whole payload. That is deliberate:
 * it is part of the render gate AND the label the dashboard list shows, so a
 * hotel without one is a row an admin cannot identify and the site can never
 * promote. Everything else can be filled in afterwards - a new hotel is expected
 * to sit incomplete (and therefore unpromoted) while it is being written.
 */
export class CreateHotelDto extends UpdateHotelDto {
  @ApiProperty({ example: 'Palm Suite Apartment' })
  @IsString()
  @MinLength(1)
  @MaxLength(SHORT_TEXT_MAX_LENGTH)
  title!: string;

  @ApiPropertyOptional({ example: 'Jan Thiel' })
  @IsOptional()
  @IsString()
  @MaxLength(SHORT_TEXT_MAX_LENGTH)
  areaLabel?: string | null;

  @ApiPropertyOptional({
    example:
      'Quiet, modern, 5min from the beach\nOwned and hosted by Island Tours',
    description: 'One line per paragraph on the card.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(DESCRIPTION_MAX_LENGTH)
  description?: string | null;

  @ApiPropertyOptional({
    example: null,
    description: "Null keeps the site's own translated eyebrow label.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(SHORT_TEXT_MAX_LENGTH)
  eyebrow?: string | null;

  @ApiPropertyOptional({
    example: null,
    description: "Null keeps the site's own translated CTA label.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(SHORT_TEXT_MAX_LENGTH)
  ctaLabel?: string | null;
}

/** Per-locale copy. Mirrors the `fields` wrapper every other entity uses. */
export class HotelTranslationFieldsDto {
  @ApiPropertyOptional({ example: '🌴 OUR APARTMENT' })
  @IsOptional()
  @IsString()
  @MaxLength(SHORT_TEXT_MAX_LENGTH)
  eyebrow?: string | null;

  @ApiPropertyOptional({ example: 'Jan Thiel' })
  @IsOptional()
  @IsString()
  @MaxLength(SHORT_TEXT_MAX_LENGTH)
  areaLabel?: string | null;

  @ApiPropertyOptional({ example: 'Palm Suite Apartment' })
  @IsOptional()
  @IsString()
  @MaxLength(SHORT_TEXT_MAX_LENGTH)
  title?: string | null;

  @ApiPropertyOptional({
    example:
      'Quiet, modern, 5min from the beach\nOwned and hosted by Island Tours',
    description: 'One line per paragraph on the card.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(DESCRIPTION_MAX_LENGTH)
  description?: string | null;

  @ApiPropertyOptional({ example: 'See availability on Airbnb' })
  @IsOptional()
  @IsString()
  @MaxLength(SHORT_TEXT_MAX_LENGTH)
  ctaLabel?: string | null;
}

export class UpsertHotelTranslationDto {
  @ApiProperty({ type: HotelTranslationFieldsDto })
  @ValidateNested()
  @Type(() => HotelTranslationFieldsDto)
  fields!: HotelTranslationFieldsDto;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isMachineTranslated?: boolean = false;
}
