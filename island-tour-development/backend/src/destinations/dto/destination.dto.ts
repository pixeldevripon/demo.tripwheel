import { Locale } from '@/common/constants/locales';
import { IsIanaTimeZone } from '@/common/validators/is-iana-timezone.validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency, Region } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

// ── Response DTOs ──────────────────────────────────────────────────────────────

export class DestinationResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) id!: string;
  @ApiProperty({ example: 'Curaçao' }) name!: string;
  @ApiProperty({ example: 'curacao' }) slug!: string;
  @ApiPropertyOptional({ example: 'https://cdn.example.com/curacao-hero.jpg' })
  heroImage!: string | null;
  @ApiPropertyOptional({
    enum: Region,
    example: Region.CARIBBEAN,
    nullable: true,
  })
  region!: Region | null;
  @ApiPropertyOptional({ example: 'Curaçao', nullable: true }) country!:
    | string
    | null;
  @ApiPropertyOptional({ example: 12.1696, nullable: true }) latitude!:
    | number
    | null;
  @ApiPropertyOptional({ example: -68.99, nullable: true }) longitude!:
    | number
    | null;
  @ApiPropertyOptional({ example: 'America/Curacao', nullable: true })
  timezone!: string | null;
  @ApiPropertyOptional({
    enum: Currency,
    example: Currency.USD,
    nullable: true,
  })
  currency!: Currency | null;
  @ApiPropertyOptional({ example: 'en', nullable: true }) language!:
    | string
    | null;
  @ApiProperty({ type: [String], example: [] }) galleryImages!: string[];
  @ApiPropertyOptional({
    example: 'https://cdn.example.com/curacao-og.jpg',
    nullable: true,
  })
  ogImage!: string | null;
  @ApiPropertyOptional({ example: null, nullable: true }) parentDestinationId!:
    | string
    | null;
  @ApiProperty({ example: true }) isSeeded!: boolean;
  @ApiProperty({ example: true }) isActive!: boolean;
  @ApiPropertyOptional({
    example: 1,
    nullable: true,
    description:
      'Curated platform order (1 = launch island leads every list). null = unranked, sorts after ranked rows alphabetically.',
  })
  displayOrder!: number | null;
  @ApiProperty({ example: '2024-06-01T08:00:00.000Z' }) createdAt!: Date;
  @ApiProperty({ example: '2024-06-01T08:00:00.000Z' }) updatedAt!: Date;
}

export class DestinationLocalizedResponseDto extends DestinationResponseDto {
  @ApiProperty({ enum: Locale, example: Locale.nl })
  locale!: Locale;

  @ApiProperty({ example: false })
  isMachineTranslated!: boolean;
}

// Returned by getActive - localized + a live (published) tour count
export class DestinationActiveResponseDto extends DestinationLocalizedResponseDto {
  @ApiProperty({
    example: 42,
    description: 'Number of LIVE (published) tours in this destination',
  })
  tourCount!: number;
}

// Returned by getById / getBySlug - includes all translated fields
export class DestinationDetailResponseDto extends DestinationLocalizedResponseDto {
  @ApiPropertyOptional({
    example: 'Curaçao is a sun-drenched island in the southern Caribbean.',
    nullable: true,
  })
  overview!: string | null;

  @ApiPropertyOptional({
    example: 'Tours & Activities in Curaçao',
    nullable: true,
  })
  h1Override!: string | null;

  @ApiPropertyOptional({ example: 'Curaçao', nullable: true })
  breadcrumbLabel!: string | null;
}

export class PaginatedLocalizedDestinationsResponseDto {
  @ApiProperty({ example: 4 }) total!: number;
  @ApiProperty({ example: 1 }) page!: number;
  @ApiProperty({ example: 20 }) limit!: number;
  @ApiProperty({ type: [DestinationLocalizedResponseDto] })
  data!: DestinationLocalizedResponseDto[];
}

export class DeleteDestinationResponseDto {
  @ApiProperty({ example: 'Destination deactivated successfully' })
  message!: string;
}

export class DeleteMessageResponseDto {
  @ApiProperty({ example: 'Deleted successfully' }) message!: string;
}

// ── Translation DTOs ──────────────────────────────────────────────────────────

export class DestinationTranslationFieldsDto {
  @ApiPropertyOptional({ example: 'Curaçao' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({
    example: 'Curaçao is een zonnig eiland in het zuidelijke Caribisch gebied.',
  })
  @IsOptional()
  @IsString()
  overview?: string;

  @ApiPropertyOptional({ example: 'Rondleidingen & Activiteiten op Curaçao' })
  @IsOptional()
  @IsString()
  h1Override?: string;

  @ApiPropertyOptional({ example: 'Curaçao' })
  @IsOptional()
  @IsString()
  breadcrumbLabel?: string;
}

export class UpsertDestinationTranslationsDto {
  @ApiProperty({ type: DestinationTranslationFieldsDto })
  @ValidateNested()
  @Type(() => DestinationTranslationFieldsDto)
  fields!: DestinationTranslationFieldsDto;

  @ApiPropertyOptional({
    example: false,
    default: false,
    description:
      'Destination names are proper nouns - always keep false for destinations.',
  })
  @IsOptional()
  @IsBoolean()
  isMachineTranslated?: boolean = false;
}

export class DestinationTranslationEntryDto {
  @ApiProperty({ enum: Locale, example: Locale.nl })
  locale!: Locale;

  @ApiPropertyOptional({ example: 'Curaçao', nullable: true })
  name!: string | null;

  @ApiPropertyOptional({
    example: 'Curaçao is een zonnig eiland in het zuidelijke Caribisch gebied.',
    nullable: true,
  })
  overview!: string | null;

  @ApiPropertyOptional({
    example: 'Rondleidingen & Activiteiten op Curaçao',
    nullable: true,
  })
  h1Override!: string | null;

  @ApiPropertyOptional({ example: 'Curaçao', nullable: true })
  breadcrumbLabel!: string | null;

  @ApiProperty({ example: false })
  isMachineTranslated!: boolean;
}

// ── Page Content DTOs ─────────────────────────────────────────────────────────

export class UpsertDestinationPageContentDto {
  @ApiPropertyOptional({
    example:
      'Curaçao is a vibrant Caribbean island known for its colourful architecture...',
  })
  @IsOptional()
  @IsString()
  aboutText?: string;

  @ApiPropertyOptional({
    example: 'Best Tours & Activities in Curaçao | Island Tours',
  })
  @IsOptional()
  @IsString()
  metaTitle?: string;

  @ApiPropertyOptional({
    example:
      'Explore top-rated boat tours, snorkelling trips, and island experiences in Curaçao.',
  })
  @IsOptional()
  @IsString()
  metaDescription?: string;
}

/**
 * One authored About-band section as the public page receives it. Declared before
 * DestinationPageContentResponseDto because that class references it inside an
 * @ApiProperty decorator, which is evaluated at class-definition time.
 */
export class PublicPageContentSectionDto {
  @ApiProperty({
    example: 'top-things',
    nullable: true,
    description:
      'Stable editorial slug on seeded sections; null on admin-created ones.',
  })
  sectionKey!: string | null;

  @ApiProperty({ example: 'Top things to do' })
  heading!: string;

  @ApiProperty({
    example:
      'Sail to Klein Curacao at sunrise, drift over the reef at Playa Piskado, then walk the Willemstad quays after dark.',
  })
  body!: string;
}

export class DestinationPageContentResponseDto {
  @ApiProperty({ enum: Locale, example: Locale.nl })
  locale!: Locale;

  @ApiPropertyOptional({
    example: 'Curaçao is een levendig Caribisch eiland...',
    nullable: true,
  })
  aboutText!: string | null;

  @ApiPropertyOptional({
    example: 'Beste Rondleidingen op Curaçao | Island Tours',
    nullable: true,
  })
  metaTitle!: string | null;

  @ApiPropertyOptional({
    example:
      'Ontdek topbeoordeelde boottochten en eilandactiviteiten op Curaçao.',
    nullable: true,
  })
  metaDescription!: string | null;

  @ApiProperty({
    type: [PublicPageContentSectionDto],
    description:
      'Active authored sections for the About band, already collapsed to the requested locale (English per section where a translation is missing) and ordered by displayOrder. Empty when the island has none - the frontend then falls back to its bundled dictionary labels.',
  })
  sections!: PublicPageContentSectionDto[];
}

// ── FAQ DTOs ──────────────────────────────────────────────────────────────────

export class DestinationFaqResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'What is the best time to visit Curaçao?' })
  question!: string;

  @ApiProperty({
    example:
      'Curaçao enjoys warm weather year-round, but January–June offers the calmest seas.',
  })
  answer!: string;

  @ApiProperty({ example: 0 })
  displayOrder!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ enum: Locale, example: Locale.en })
  locale!: Locale;
}

export class CreateDestinationFaqDto {
  @ApiProperty({ enum: Locale, example: Locale.en })
  @IsEnum(Locale)
  locale!: Locale;

  @ApiProperty({ example: 'What is the best time to visit Curaçao?' })
  @IsString()
  @MinLength(5)
  question!: string;

  @ApiProperty({
    example:
      'Curaçao enjoys warm weather year-round, but January–June offers the calmest seas.',
  })
  @IsString()
  @MinLength(10)
  answer!: string;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number = 0;
}

export class UpdateDestinationFaqDto {
  @ApiPropertyOptional({ example: 'Do I need a visa to visit Curaçao?' })
  @IsOptional()
  @IsString()
  @MinLength(5)
  question?: string;

  @ApiPropertyOptional({
    example:
      'EU and US passport holders do not need a visa for stays up to 90 days.',
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  answer?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ── Query DTOs ────────────────────────────────────────────────────────────────

export class DestinationQueryDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Content locale',
    enum: Locale,
    default: Locale.en,
  })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;
}

export class LocaleQueryDto {
  @ApiPropertyOptional({
    description: 'Content locale',
    enum: Locale,
    default: Locale.en,
  })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;
}

export class FaqLocaleQueryDto {
  @ApiPropertyOptional({
    description: 'Filter FAQs by locale. Omit to return all locales.',
    enum: Locale,
  })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale;
}

// ── Request DTOs ───────────────────────────────────────────────────────────────

export class CreateDestinationDto {
  @ApiProperty({
    example: 'Aruba',
    description: 'Destination display name.',
  })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({
    example: 'aruba',
    description: 'URL slug. Auto-generated from the name when omitted.',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  slug?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/aruba-hero.jpg',
    description: 'Hero image URL - set after upload via the media module.',
  })
  @IsOptional()
  @IsString()
  heroImage?: string;

  // ── V2 fields ──────────────────────────────────────────────────────────────
  @ApiProperty({
    enum: Region,
    example: Region.CARIBBEAN,
    description: 'Geographic region (required - V2 §2). No URL impact.',
  })
  @IsEnum(Region)
  region!: Region;

  @ApiPropertyOptional({ example: 'Aruba' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 12.5211 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: -69.9683 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiProperty({
    example: 'America/Aruba',
    description:
      'IANA timezone (required). All tour/departure/booking local-time math for this destination anchors to it.',
  })
  @IsIanaTimeZone()
  timezone!: string;

  @ApiPropertyOptional({ enum: Currency, example: Currency.USD })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiPropertyOptional({ example: 'en' })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ type: [String], example: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  galleryImages?: string[];

  @ApiPropertyOptional({ example: 'https://cdn.example.com/aruba-og.jpg' })
  @IsOptional()
  @IsString()
  ogImage?: string;

  @ApiPropertyOptional({
    description:
      'Parent destination id for future sub-destinations (unused at launch).',
  })
  @IsOptional()
  @IsString()
  parentDestinationId?: string;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Curated platform order (1 = leads every island list). Omit to leave unranked (sorts after ranked rows).',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  displayOrder?: number;
}

export class UpdateDestinationDto {
  @ApiPropertyOptional({ example: 'Aruba' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/aruba-hero.jpg' })
  @IsOptional()
  @IsString()
  heroImage?: string;

  @ApiPropertyOptional({ enum: Region, example: Region.CARIBBEAN })
  @IsOptional()
  @IsEnum(Region)
  region?: Region;

  @ApiPropertyOptional({ example: 'Aruba' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 12.5211 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: -69.9683 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ example: 'America/Aruba' })
  @IsOptional()
  @IsIanaTimeZone()
  timezone?: string;

  @ApiPropertyOptional({ enum: Currency, example: Currency.USD })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiPropertyOptional({ example: 'en' })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ type: [String], example: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  galleryImages?: string[];

  @ApiPropertyOptional({ example: 'https://cdn.example.com/aruba-og.jpg' })
  @IsOptional()
  @IsString()
  ogImage?: string;

  @ApiPropertyOptional({
    example: 1,
    nullable: true,
    description:
      'Curated platform order (1 = leads every island list). Send null to unrank (sorts after ranked rows).',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  displayOrder?: number | null;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ── Hero "Popular" links (admin-curated) ─────────────────────────────────────

/** One resolved, renderable link as the public hero prints it. */
export class PopularLinkResponseDto {
  @ApiProperty({
    example: 'Off-Road Tours',
    description:
      "The TARGET PAGE'S own name, localized - never an admin-typed label, so " +
      'the link can never disagree with the page it opens.',
  })
  name!: string;

  @ApiProperty({
    example: 'off-road-tours',
    description:
      'Slug only. Hubs, collections and categories share the flat ' +
      '/{destination}/{slug} namespace, so one href shape covers all three and ' +
      'the caller joins it to the island it already resolved.',
  })
  slug!: string;
}

/** One curated slot as the admin editor sees it - unresolved and ungated. */
export class PopularLinkAdminResponseDto {
  @ApiProperty({ example: '5f1c…' })
  id!: string;

  @ApiProperty({
    example: 0,
    description: 'Zero-based, left to right as rendered.',
  })
  displayOrder!: number;

  @ApiPropertyOptional({ example: '2bdc…', nullable: true })
  categoryId!: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  hubId!: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  collectionId!: string | null;
}

/**
 * One slot on the way in. Exactly one target id must be set; the service rejects
 * zero (an empty link) and more than one (an ambiguous link).
 *
 * `displayOrder` is deliberately absent: the array's own order is the row's
 * order, so a client cannot number two slots the same and collide on the unique
 * (destinationId, displayOrder) index.
 */
export class PopularLinkInputDto {
  @ApiPropertyOptional({ example: '2bdc4a64-48a5-450d-a6e2-a5d1a240506a' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'e83c43e3-5bdf-4abc-a8ac-df6e1ee4f6be' })
  @IsOptional()
  @IsString()
  hubId?: string;

  @ApiPropertyOptional({ example: 'd6dda6a0-086c-4677-b5a9-21affa0c8cf4' })
  @IsOptional()
  @IsString()
  collectionId?: string;
}

/**
 * Replace-all: the body IS the whole row. One save for the section (the
 * one-save-button rule) - per-slot writes would let two concurrent edits
 * interleave into an order neither admin chose. An empty array clears the
 * curation, which returns the island to the automatic composition.
 */
export class ReplacePopularLinksDto {
  @ApiProperty({
    type: [PopularLinkInputDto],
    description:
      'Up to 8 slots, in render order. Empty clears the curation and the island ' +
      'falls back to the automatic hub -> lead collection -> categories row.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PopularLinkInputDto)
  links!: PopularLinkInputDto[];
}
