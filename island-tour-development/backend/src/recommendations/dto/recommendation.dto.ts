import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Currency,
  Locale,
  RecommendationPlacement,
  RecommendationRefType,
  RecommendationSource,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
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
const SLUG_MAX_LENGTH = 120;

/** A rating is out of 5, and nobody sleeps 500 people in an apartment. */
const MAX_RATING = 5;
const MAX_SLEEPS = 99;
const MAX_PRICE = 1_000_000;

// ── Response DTOs ─────────────────────────────────────────────────────────────

/**
 * The FEATURED recommendation for one surface + locale: the record flattened
 * together with that locale's copy. Each surface renders one card, so this is one
 * recommendation - the first enabled, complete one in `displayOrder` whose
 * placements include the requested surface.
 *
 * `enabled` IS THE CONTRACT. Unlike the homepage - where every null field falls
 * back to a bundled dictionary default - a card's name, photo and link have no
 * sensible built-in, because inventing one would advertise a place that does not
 * exist. So the service decides here whether the card is renderable at all, and
 * everything is nulled out when it is not.
 *
 * For an INTERNAL recommendation the image/title/link are resolved from the LIVE
 * entity (tour/destination/collection/hub) it points at; `external` is then false
 * and the frontend links same-tab. For EXTERNAL it is the admin's own content and
 * `external` is true (open in a new tab).
 */
export class PublicRecommendationResponseDto {
  @ApiProperty({
    example: true,
    description:
      'Whether the public site should render the card at all. False when NO ' +
      'recommendation qualifies for this surface (all switched off, none placed ' +
      'here, or each missing its essentials). Every other field is null then.',
  })
  enabled!: boolean;

  @ApiProperty({ enum: Locale, example: Locale.en })
  locale!: Locale;

  @ApiProperty({
    example: true,
    description:
      'Whether the link is OFF-SITE (external content) - the frontend opens it ' +
      'in a new tab. INTERNAL recommendations are false: they link same-tab to ' +
      'an on-site page.',
  })
  external!: boolean;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/demo/image/upload/palm-suite.jpg',
    nullable: true,
  })
  imageUrl!: string | null;

  @ApiPropertyOptional({
    example: 'https://www.airbnb.com',
    nullable: true,
    description:
      'Where the CTA goes. Absolute https for EXTERNAL; a site-relative path ' +
      '(`/curacao/tours/sunset-cruise`) for INTERNAL, which the frontend ' +
      'localises.',
  })
  linkUrl!: string | null;

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
  priceAmount!: number | null;

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
      'card renders one paragraph per entry.',
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
export class RecommendationTranslationEntryDto {
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

/** A category as returned to the dashboard. */
export class RecommendationCategoryResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'Hotels' })
  name!: string;

  @ApiProperty({ example: 'hotels' })
  slug!: string;

  @ApiPropertyOptional({ example: 'building', nullable: true })
  icon!: string | null;

  @ApiProperty({ example: 0 })
  displayOrder!: number;

  @ApiProperty({
    example: true,
    description: 'Seeded categories cannot be deleted (403).',
  })
  isSeeded!: boolean;

  @ApiProperty({
    example: 2,
    description: 'How many recommendations are filed under this category.',
  })
  recommendationCount!: number;
}

/** A category slimmed to what a recommendation row nests. */
export class RecommendationCategoryRefDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'Hotels' })
  name!: string;

  @ApiProperty({ example: 'hotels' })
  slug!: string;

  @ApiPropertyOptional({
    example: 'TreePalm',
    nullable: true,
    description: 'Icon name for the list (from the category icon picker).',
  })
  icon!: string | null;
}

/** The admin view of one recommendation: the record plus every stored locale. */
export class RecommendationResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({
    enum: RecommendationSource,
    example: RecommendationSource.EXTERNAL,
  })
  source!: RecommendationSource;

  @ApiPropertyOptional({ type: RecommendationCategoryRefDto, nullable: true })
  category!: RecommendationCategoryRefDto | null;

  @ApiProperty({ example: true })
  isEnabled!: boolean;

  @ApiProperty({
    example: 0,
    description:
      'Promotion priority per surface - the lowest enabled, complete row placed ' +
      'on a surface takes that surface.',
  })
  displayOrder!: number;

  @ApiProperty({
    example: true,
    description:
      'Seeded recommendations cannot be deleted (403). Switch it off instead.',
  })
  isSeeded!: boolean;

  @ApiProperty({
    enum: RecommendationPlacement,
    isArray: true,
    example: [RecommendationPlacement.THANK_YOU_PAGE],
    description: 'The surfaces this may be featured on.',
  })
  placements!: RecommendationPlacement[];

  @ApiPropertyOptional({
    enum: RecommendationRefType,
    nullable: true,
    example: null,
    description: 'INTERNAL only: which entity kind this points at.',
  })
  refType!: RecommendationRefType | null;

  @ApiPropertyOptional({
    nullable: true,
    example: null,
    description: 'INTERNAL only: the id of the pointed-at entity.',
  })
  refId!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: null,
    description:
      'INTERNAL only: the LIVE name of the pointed-at entity, for the list. ' +
      'Null when the entity no longer resolves (archived/deleted).',
  })
  refLabel!: string | null;

  @ApiPropertyOptional({ nullable: true })
  imageUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  linkUrl!: string | null;

  @ApiPropertyOptional({ example: 4.8, nullable: true })
  rating!: number | null;

  @ApiPropertyOptional({ example: 1738, nullable: true })
  reviewCount!: number | null;

  @ApiPropertyOptional({ example: 4, nullable: true })
  sleeps!: number | null;

  @ApiPropertyOptional({ example: 160, nullable: true })
  priceAmount!: number | null;

  @ApiProperty({ enum: Currency, example: Currency.USD })
  currency!: Currency;

  @ApiProperty({
    enum: RecommendationPlacement,
    isArray: true,
    example: [RecommendationPlacement.THANK_YOU_PAGE],
    description:
      'The surfaces this row is CURRENTLY the featured card on - decided across ' +
      'the whole list per surface. Empty when another row wins every surface it ' +
      'is placed on, or it is incomplete. Surfaced because the failure mode is ' +
      'silent: a card with no link simply never appears.',
  })
  featuredPlacements!: RecommendationPlacement[];

  @ApiProperty({
    example: true,
    description:
      'Whether it COULD be featured: the render gate (a resolvable image + ' +
      'title + link), minus the on/off switch and placement.',
  })
  isComplete!: boolean;

  @ApiProperty({ type: [RecommendationTranslationEntryDto] })
  translations!: RecommendationTranslationEntryDto[];
}

// ── Query DTOs ────────────────────────────────────────────────────────────────

export class RecommendationPublicQueryDto {
  @ApiPropertyOptional({ enum: Locale, default: Locale.en })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;

  @ApiPropertyOptional({
    enum: RecommendationPlacement,
    default: RecommendationPlacement.THANK_YOU_PAGE,
    description: 'Which surface to feature a card for.',
  })
  @IsOptional()
  @IsEnum(RecommendationPlacement)
  placement?: RecommendationPlacement = RecommendationPlacement.THANK_YOU_PAGE;
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

/**
 * Locale-agnostic recommendation fields. Every property is optional so a PATCH
 * only touches what it names; an explicit `null` clears one.
 */
export class UpdateRecommendationDto {
  @ApiPropertyOptional({
    enum: RecommendationSource,
    example: RecommendationSource.EXTERNAL,
    description:
      'EXTERNAL (custom content, off-site) or INTERNAL (a pointer at a platform ' +
      'entity, rendered from live data).',
  })
  @IsOptional()
  @IsEnum(RecommendationSource)
  source?: RecommendationSource;

  @ApiPropertyOptional({
    nullable: true,
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    description: 'The category to file this under. Null = uncategorised.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(SLUG_MAX_LENGTH)
  categoryId?: string | null;

  @ApiPropertyOptional({
    example: true,
    description:
      'Master switch. Off hides the card whatever else is filled in.',
  })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({
    enum: RecommendationPlacement,
    isArray: true,
    example: [RecommendationPlacement.THANK_YOU_PAGE],
    description: 'Where this may be featured. An empty array parks it nowhere.',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(RecommendationPlacement, { each: true })
  placements?: RecommendationPlacement[];

  @ApiPropertyOptional({
    enum: RecommendationRefType,
    nullable: true,
    description: 'INTERNAL only: which entity kind this points at.',
  })
  @IsOptional()
  @IsEnum(RecommendationRefType)
  refType?: RecommendationRefType | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'INTERNAL only: the id of the pointed-at entity.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(SLUG_MAX_LENGTH)
  refId?: string | null;

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
  linkUrl?: string | null;

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
  priceAmount?: number | null;

  @ApiPropertyOptional({ enum: Currency, example: Currency.USD })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;
}

/**
 * Creating a recommendation. Extends the update shape with the ENGLISH COPY,
 * written in the same transaction as the row.
 *
 * No field is required at the DTO level - the shape is the same for INTERNAL and
 * EXTERNAL. The service enforces the source-specific rules: EXTERNAL needs a
 * `title` (the render gate and the list label), INTERNAL needs `refType` + `refId`
 * (its title/photo follow the entity). Everything else can be filled in later - a
 * new recommendation is expected to sit incomplete (and unfeatured) while written.
 */
export class CreateRecommendationDto extends UpdateRecommendationDto {
  @ApiPropertyOptional({
    example: 'Palm Suite Apartment',
    description: 'Required for EXTERNAL; ignored for INTERNAL.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(SHORT_TEXT_MAX_LENGTH)
  title?: string;

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
export class RecommendationTranslationFieldsDto {
  @ApiPropertyOptional({ example: 'OUR APARTMENT' })
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

export class UpsertRecommendationTranslationDto {
  @ApiProperty({ type: RecommendationTranslationFieldsDto })
  @ValidateNested()
  @Type(() => RecommendationTranslationFieldsDto)
  fields!: RecommendationTranslationFieldsDto;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isMachineTranslated?: boolean = false;
}

// ── Category request DTOs ─────────────────────────────────────────────────────

export class CreateRecommendationCategoryDto {
  @ApiProperty({ example: 'Restaurants' })
  @IsString()
  @MinLength(1)
  @MaxLength(SHORT_TEXT_MAX_LENGTH)
  name!: string;

  @ApiPropertyOptional({
    example: 'restaurants',
    description: 'URL-safe key. Defaults to a slug of the name.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(SLUG_MAX_LENGTH)
  slug?: string;

  @ApiPropertyOptional({ example: 'utensils', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(SHORT_TEXT_MAX_LENGTH)
  icon?: string | null;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class UpdateRecommendationCategoryDto {
  @ApiPropertyOptional({ example: 'Restaurants' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(SHORT_TEXT_MAX_LENGTH)
  name?: string;

  @ApiPropertyOptional({ example: 'restaurants' })
  @IsOptional()
  @IsString()
  @MaxLength(SLUG_MAX_LENGTH)
  slug?: string;

  @ApiPropertyOptional({ example: 'utensils', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(SHORT_TEXT_MAX_LENGTH)
  icon?: string | null;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
