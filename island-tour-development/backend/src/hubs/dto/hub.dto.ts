import { Locale } from '@/common/constants/locales';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AttributeDataType,
  Currency,
  HubPickType,
  HubSectionType,
  HubStatus,
  HubType,
  PricingModel,
  WholeUnitType,
} from '@prisma/client';
import { MoneyDto } from '@/fx/dto/money.dto';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

// ── Response DTOs ──────────────────────────────────────────────────────────────

export class AllowedCategoryItemDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) id!: string;
  @ApiProperty({ example: '7fa65f12-4b21-4e1a-9a3c-1d8e9a2b4c6d' })
  categoryId!: string;
  @ApiProperty({
    example: { id: '7fa65f12-...', name: 'Boat Tours', slug: 'boat-tours' },
  })
  category!: { id: string; name: string; slug: string };
}

export class HubResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) id!: string;
  @ApiProperty({ example: 'a1b2c3d4-0000-0000-0000-000000000001' })
  destinationId!: string;
  @ApiProperty({ example: 'Klein Curaçao' }) name!: string;
  @ApiProperty({ example: 'klein-curacao' }) slug!: string;
  @ApiPropertyOptional({
    example: 'A small uninhabited island off the coast of Curaçao.',
  })
  description!: string | null;
  @ApiPropertyOptional({
    enum: HubType,
    example: HubType.LOCATION,
    nullable: true,
  })
  hubType!: HubType | null;
  @ApiPropertyOptional({
    example: 'https://cdn.example.com/hubs/klein-curacao-hero.jpg',
    nullable: true,
  })
  heroImage!: string | null;
  @ApiPropertyOptional({
    example: 'https://cdn.example.com/hubs/klein-curacao-og.jpg',
    nullable: true,
  })
  ogImage!: string | null;
  @ApiProperty({ enum: HubStatus, example: HubStatus.PUBLISHED })
  status!: HubStatus;
  @ApiPropertyOptional({ example: 11.9833, nullable: true }) latitude!:
    | number
    | null;
  @ApiPropertyOptional({ example: -68.6333, nullable: true }) longitude!:
    | number
    | null;
  @ApiProperty({ example: true }) isSeeded!: boolean;
  @ApiProperty({ example: true }) isActive!: boolean;
  @ApiProperty({ example: '2024-06-01T08:00:00.000Z' }) createdAt!: Date;
  @ApiProperty({ example: '2024-06-01T08:00:00.000Z' }) updatedAt!: Date;
}

export class HubLocalizedResponseDto extends HubResponseDto {
  @ApiProperty({ enum: Locale, example: Locale.nl }) locale!: Locale;
  @ApiProperty({ example: false }) isMachineTranslated!: boolean;
}

export class HubByDestinationResponseDto extends HubLocalizedResponseDto {
  @ApiProperty({
    example: 7,
    description:
      'Published (LIVE) tours tagged with this hub in the destination.',
  })
  publishedTourCount!: number;
}

export class HubDetailLocalizedResponseDto extends HubLocalizedResponseDto {
  @ApiPropertyOptional({ nullable: true, example: null }) overview!:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true, example: null }) h1Override!:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true, example: null }) heroTagline!:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true, example: null }) breadcrumbLabel!:
    | string
    | null;
  @ApiProperty({ type: [AllowedCategoryItemDto] })
  allowedCategories!: AllowedCategoryItemDto[];
}

export class PaginatedLocalizedHubsResponseDto {
  @ApiProperty({ example: 1 }) total!: number;
  @ApiProperty({ example: 1 }) page!: number;
  @ApiProperty({ example: 20 }) limit!: number;
  @ApiProperty({ type: [HubLocalizedResponseDto] })
  data!: HubLocalizedResponseDto[];
}

export class HubTranslationEntryDto {
  @ApiProperty({ enum: Locale, example: Locale.nl }) locale!: Locale;
  @ApiPropertyOptional({ nullable: true }) name!: string | null;
  @ApiPropertyOptional({ nullable: true }) overview!: string | null;
  @ApiPropertyOptional({ nullable: true }) heroTagline!: string | null;
  @ApiPropertyOptional({ nullable: true }) h1Override!: string | null;
  @ApiPropertyOptional({ nullable: true }) breadcrumbLabel!: string | null;
  @ApiProperty({ example: false }) isMachineTranslated!: boolean;
}

export class HubPageContentResponseDto {
  @ApiProperty({ enum: Locale, example: Locale.nl }) locale!: Locale;
  @ApiPropertyOptional({ nullable: true }) aboutText!: string | null;
  @ApiPropertyOptional({ nullable: true }) metaTitle!: string | null;
  @ApiPropertyOptional({ nullable: true }) metaDescription!: string | null;
}

/**
 * Page content as it appears inside the render payload: already resolved to the
 * requested locale with English fallback, so there is no `locale` field to
 * report - each value may have come from a different row than its neighbours.
 */
export class HubRenderPageContentDto {
  @ApiPropertyOptional({ nullable: true }) aboutText!: string | null;
  @ApiPropertyOptional({ nullable: true }) metaTitle!: string | null;
  @ApiPropertyOptional({ nullable: true }) metaDescription!: string | null;
}

export class FaqResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) id!: string;
  @ApiProperty({ enum: Locale, example: Locale.en }) locale!: Locale;
  @ApiProperty({ example: 'What should I bring?' }) question!: string;
  @ApiProperty({ example: 'Bring sunscreen, water, and a hat.' })
  answer!: string;
  @ApiProperty({ example: 0 }) displayOrder!: number;
  @ApiProperty({ example: true }) isActive!: boolean;
}

// ── Content sections ────────────────────────────────────────────────────────

export class HubContentSectionItemDto {
  @ApiProperty({ enum: Locale, example: Locale.en }) locale!: Locale;
  @ApiProperty({ enum: HubSectionType, example: HubSectionType.DISCOVER })
  sectionType!: HubSectionType;
  @ApiProperty({ example: 'The White Beach' }) heading!: string;
  @ApiProperty({ example: 'A two-kilometre stretch of powder-soft sand...' })
  body!: string;
  @ApiPropertyOptional({
    nullable: true,
    example: 'https://cdn.example.com/hubs/klein-curacao-white-beach.jpg',
    description:
      'Optional illustrative image for the section (Discover cards).',
  })
  image!: string | null;
  @ApiProperty({ example: 0 }) displayOrder!: number;
}

export class ReplaceContentSectionsResponseDto {
  @ApiProperty({ example: 6 }) count!: number;
  @ApiProperty({ type: [HubContentSectionItemDto] })
  sections!: HubContentSectionItemDto[];
}

// ── Our Picks ───────────────────────────────────────────────────────────────

export class OurPickTourSummaryDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) id!: string;
  @ApiProperty({ example: 'klein-curacao-snorkel-cruise' }) slug!: string;
  @ApiProperty({ example: 'Klein Curaçao Snorkel & BBQ Cruise' })
  title!: string;
  @ApiPropertyOptional({ nullable: true, description: 'Hero image URL.' })
  heroImage!: string | null;
  @ApiPropertyOptional({ nullable: true }) heroImageAlt!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    example: 120,
    description: 'Cached listing "from" price (raw Decimal).',
  })
  priceFrom!: number | null;
  @ApiPropertyOptional({ nullable: true, example: 150 })
  basePrice!: number | null;
  @ApiProperty({ example: 'USD' }) currency!: string;
  @ApiProperty({ enum: PricingModel, example: PricingModel.PER_PERSON })
  pricingModel!: PricingModel;
  @ApiPropertyOptional({
    enum: WholeUnitType,
    nullable: true,
    description: 'Set only when pricingModel = UNIT (private charters).',
  })
  unitType!: WholeUnitType | null;
  @ApiPropertyOptional({ nullable: true, example: 4.8 })
  rating!: number | null;
  @ApiProperty({ example: 1738 }) reviewCount!: number;
  @ApiPropertyOptional({ nullable: true, example: 480 })
  durationMinutesFrom!: number | null;
  @ApiPropertyOptional({ nullable: true, example: 540 })
  durationMinutesTo!: number | null;
  @ApiProperty({ example: 0 }) bookingCount!: number;
  @ApiPropertyOptional({
    nullable: true,
    example: 'yacht',
    description:
      'boat_type attribute value (for the pick card); null if unset.',
  })
  boatType?: string | null;
  @ApiPropertyOptional({
    type: MoneyDto,
    description:
      'Converted-price display object (guide §20.9). Canonical for display in the requested `?currency`; prefer over the raw `priceFrom`/`basePrice`/`currency` above.',
  })
  money?: MoneyDto;
}

export class HubOurPickItemDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) id!: string;
  @ApiProperty({ enum: HubPickType, example: HubPickType.BEST_OVERALL })
  pickType!: HubPickType;
  @ApiProperty({
    example: "We've been on every boat - this one wins on comfort.",
  })
  description!: string;
  @ApiProperty({ example: 0 }) displayOrder!: number;
  @ApiProperty({ type: OurPickTourSummaryDto }) tour!: OurPickTourSummaryDto;
}

export class SetOurPicksResponseDto {
  @ApiProperty({ example: 3 }) count!: number;
  @ApiProperty({ type: [HubOurPickItemDto] }) ourPicks!: HubOurPickItemDto[];
}

export class OurPickTranslationItemDto {
  @ApiProperty({ enum: Locale, example: Locale.nl }) locale!: Locale;
  @ApiProperty({ example: 'De beste boot - comfort wint.' })
  description!: string;
}

/** Admin read-back for the Our Picks editor (base blurb + all translations). */
export class HubOurPickForEditDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) id!: string;
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  tourId!: string;
  @ApiProperty({ example: 'Klein Curacao Catamaran' }) tourName!: string;
  @ApiProperty({ enum: HubPickType, example: HubPickType.BEST_OVERALL })
  pickType!: HubPickType;
  @ApiProperty({ example: 0 }) displayOrder!: number;
  @ApiProperty({
    example: "We've been on every boat - this one wins on comfort.",
  })
  description!: string;
  @ApiProperty({ type: [OurPickTranslationItemDto] })
  translations!: OurPickTranslationItemDto[];
}

// ── Comparison ──────────────────────────────────────────────────────────────

export class ComparisonTourItemDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) id!: string;
  @ApiProperty({ example: 0 }) displayOrder!: number;
  @ApiPropertyOptional({
    nullable: true,
    example: 'Dive school, massage with a view',
  })
  standoutNote!: string | null;
  @ApiProperty({ type: OurPickTourSummaryDto }) tour!: OurPickTourSummaryDto;
}

export class ComparisonCellDto {
  @ApiProperty({
    type: [String],
    example: ['Beach house', 'Beds', 'Shower'],
    description:
      'Value fragments for this cell (empty when the tour lacks it).',
  })
  parts!: string[];
  @ApiPropertyOptional({
    nullable: true,
    example: true,
    description: 'BOOLEAN attributes only: true/false; null for non-boolean.',
  })
  check!: boolean | null;
}

export class ComparisonRowDto {
  @ApiProperty({ example: 'boat_and_group' }) key!: string;
  @ApiProperty({ example: 'Boat & group' }) label!: string;
  @ApiProperty({
    enum: AttributeDataType,
    example: AttributeDataType.ENUM_MULTI,
  })
  dataType!: AttributeDataType;
  @ApiProperty({
    type: [ComparisonCellDto],
    description: 'One cell per tour column, index-aligned to `tours`.',
  })
  cells!: ComparisonCellDto[];
}

export class ComparisonGroupItemDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) id!: string;
  @ApiProperty({ example: 'Comfort trips' }) groupName!: string;
  @ApiProperty({ example: 0 }) displayOrder!: number;
  @ApiProperty({ type: [ComparisonTourItemDto] })
  tours!: ComparisonTourItemDto[];
  @ApiProperty({
    type: [ComparisonRowDto],
    description:
      'Curated six-row compare template (frozen first column = label). The "What stands out" row + price/book footer are composed on the frontend.',
  })
  rows!: ComparisonRowDto[];
}

export class SetComparisonResponseDto {
  @ApiProperty({ example: 2 }) count!: number;
  @ApiProperty({ type: [ComparisonGroupItemDto] })
  groups!: ComparisonGroupItemDto[];
}

// ── Public render payload (§14) ───────────────────────────────────────────────

export class HubHeroStatsDto {
  @ApiPropertyOptional({ nullable: true, example: 480 })
  durationMinutesFrom!: number | null;
  @ApiPropertyOptional({ nullable: true, example: 540 })
  durationMinutesTo!: number | null;
  @ApiPropertyOptional({ nullable: true, example: 120 })
  priceFrom!: number | null;
  @ApiProperty({
    example: 7,
    description:
      'Distinct ACTIVE departure weekdays across the hub (0-7); 7 = daily',
  })
  frequencyDays!: number;
  @ApiPropertyOptional({
    nullable: true,
    example: 'bbq_included',
    description:
      "Most common amenity attribute key across the hub's tours, for the hero inclusion pill (e.g. bbq_included). null when none apply.",
  })
  inclusion!: string | null;
}

export class HubRenderHeroDto {
  @ApiPropertyOptional({ nullable: true }) heroImage!: string | null;
  @ApiProperty({ example: 'Klein Curaçao day trips' }) h1!: string;
  @ApiPropertyOptional({ nullable: true }) heroTagline!: string | null;
  @ApiProperty({ type: [HubContentSectionItemDto] })
  fastFacts!: HubContentSectionItemDto[];
  @ApiProperty({ type: HubHeroStatsDto }) stats!: HubHeroStatsDto;
}

export class RelatedHubItemDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) id!: string;
  @ApiProperty({ example: 'dolphin-academy' }) slug!: string;
  @ApiProperty({ example: 'Dolphin Academy' }) name!: string;
  @ApiPropertyOptional({ nullable: true }) heroImage!: string | null;
}

export class HubRenderResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) id!: string;
  @ApiProperty({ example: 'klein-curacao' }) slug!: string;
  @ApiProperty({ example: 'Klein Curaçao' }) name!: string;
  @ApiProperty({ enum: Locale, example: Locale.en }) locale!: Locale;
  @ApiPropertyOptional({ enum: HubType, nullable: true })
  hubType!: HubType | null;
  @ApiPropertyOptional({ nullable: true }) breadcrumbLabel!: string | null;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiPropertyOptional({ nullable: true }) ogImage!: string | null;
  @ApiProperty({
    type: HubRenderPageContentDto,
    description:
      'Authored About + SEO copy, locale with English fallback. Folded in here so the page needs one request, not a second call to /hubs/:id/page-content.',
  })
  pageContent!: HubRenderPageContentDto;
  @ApiProperty({ type: HubRenderHeroDto }) hero!: HubRenderHeroDto;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Editorial lead (overview, en fallback)',
  })
  editorialLead!: string | null;
  @ApiProperty({ type: [HubOurPickItemDto] }) ourPicks!: HubOurPickItemDto[];
  @ApiProperty({ type: [ComparisonGroupItemDto] })
  comparisonGroups!: ComparisonGroupItemDto[];
  @ApiPropertyOptional({
    nullable: true,
    description:
      'Discover section intro/subtitle (first EDITORIAL content section body for the locale). null when unset - frontend falls back to a static string.',
  })
  discoverIntro!: string | null;
  @ApiProperty({
    type: [String],
    example: [
      'Sells out weeks ahead',
      'No phone signal',
      'Bring reef-safe sunscreen',
    ],
    description:
      'First-timer green-check takeaways (HIGHLIGHT content-section bodies, in order).',
  })
  highlights!: string[];
  @ApiProperty({ type: [HubContentSectionItemDto] })
  discover!: HubContentSectionItemDto[];
  @ApiProperty({ type: [HubContentSectionItemDto] })
  localTips!: HubContentSectionItemDto[];
  @ApiProperty({ type: [FaqResponseDto] }) faqs!: FaqResponseDto[];
  @ApiProperty({ type: [RelatedHubItemDto] }) relatedHubs!: RelatedHubItemDto[];
  @ApiProperty({
    type: [String],
    example: ['boat-tours', 'snorkeling', 'day-trips'],
    description:
      'Category slugs this hub is scoped to (frontend excludes them from the "Also worth your time" grid)',
  })
  allowedCategorySlugs!: string[];
}

export class AddAllowedCategoryResponseDto {
  @ApiProperty({ example: 'Allowed category added successfully' })
  message!: string;
  @ApiProperty({ type: AllowedCategoryItemDto })
  allowedCategory!: AllowedCategoryItemDto;
}

export class RemoveAllowedCategoryResponseDto {
  @ApiProperty({ example: 'Allowed category removed successfully' })
  message!: string;
}

export class DeleteHubResponseDto {
  @ApiProperty({ example: 'Hub deactivated successfully' }) message!: string;
}

export class DeleteMessageResponseDto {
  @ApiProperty({ example: 'Deleted successfully' }) message!: string;
}

// ── Query DTOs ─────────────────────────────────────────────────────────────────

export class LocaleQueryDto {
  @ApiPropertyOptional({
    enum: Locale,
    default: 'en',
    description:
      'Content locale - falls back to English when translation is missing',
  })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;

  @ApiPropertyOptional({
    enum: Currency,
    description:
      'Shopper display currency; tour cards carry a converted `money` object (guide §20.9).',
  })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;
}

export class FaqLocaleQueryDto {
  @ApiPropertyOptional({
    enum: Locale,
    example: Locale.en,
    description: 'Filter FAQs by locale - omit to return all locales',
  })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale;
}

export class HubQueryDto {
  @ApiPropertyOptional({ description: 'Filter by destination UUID' })
  @IsOptional()
  @IsUUID()
  destinationId?: string;

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
    enum: Locale,
    default: 'en',
    description:
      'Content locale - falls back to English when translation is missing',
  })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;
}

export class ActiveHubsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by destination UUID' })
  @IsOptional()
  @IsUUID()
  destinationId?: string;

  @ApiPropertyOptional({
    enum: Locale,
    default: 'en',
    description:
      'Content locale - falls back to English when translation is missing',
  })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;
}

export class HubBySlugQueryDto {
  @ApiProperty({
    example: 'curacao',
    description:
      'Destination slug - required because hub slugs are unique per destination',
  })
  @IsString()
  destinationSlug!: string;

  @ApiPropertyOptional({
    enum: Locale,
    default: 'en',
    description:
      'Content locale - falls back to English when translation is missing',
  })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;
}

export class HubRenderQueryDto {
  @ApiProperty({
    example: 'a1b2c3d4-0000-0000-0000-000000000001',
    description: 'Destination UUID - hub slugs are unique per destination',
  })
  @IsUUID()
  destinationId!: string;

  @ApiPropertyOptional({
    enum: Locale,
    default: 'en',
    description:
      'Content locale - falls back to English when translation is missing',
  })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;

  @ApiPropertyOptional({
    enum: Currency,
    description:
      'Shopper display currency; Our Picks + Comparison tour cards carry a converted `money` object (guide §20.9).',
  })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;
}

// ── Request DTOs ───────────────────────────────────────────────────────────────

export class CreateHubDto {
  @ApiProperty({ example: 'a1b2c3d4-0000-0000-0000-000000000001' })
  @IsUUID()
  destinationId!: string;

  @ApiProperty({ example: 'Klein Curaçao' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({
    example: 'A small uninhabited island off the coast of Curaçao.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/hubs/klein-curacao-hero.jpg',
    description:
      "Full-bleed hero image - the hub's defining element (HUB-DATA §2 G1).",
  })
  @IsOptional()
  @IsUrl()
  heroImage?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/hubs/klein-curacao-og.jpg',
    description: 'Open Graph image (E.4).',
  })
  @IsOptional()
  @IsUrl()
  ogImage?: string;

  @ApiPropertyOptional({
    enum: HubStatus,
    default: HubStatus.DRAFT,
    description:
      'Publish lifecycle (G6). New hubs default to DRAFT; promote to PUBLISHED via PATCH once the publish guard passes.',
  })
  @IsOptional()
  @IsEnum(HubStatus)
  status?: HubStatus;

  // ── V2 fields ──────────────────────────────────────────────────────────────
  @ApiProperty({
    enum: HubType,
    example: HubType.LOCATION,
    description: 'location | highlight | area (V2 §5).',
  })
  @IsEnum(HubType)
  hubType!: HubType;

  @ApiPropertyOptional({
    example: 11.9833,
    description: 'For location-type hubs.',
  })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: -68.6333 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({
    type: [String],
    example: ['cat-id-1', 'cat-id-2'],
    description:
      'Initial set of allowed category IDs (can also be managed later via sub-routes)',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  allowedCategoryIds?: string[];
}

export class UpdateHubDto {
  @ApiPropertyOptional({ example: 'Klein Curaçao' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({
    example: 'klein-curacao',
    description:
      'Renaming issues an automatic 301 redirect; the old slug is protected by a 90-day reuse cooldown.',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  slug?: string;

  @ApiPropertyOptional({ example: 'Updated description.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/hubs/klein-curacao-hero.jpg',
  })
  @IsOptional()
  @IsUrl()
  heroImage?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/hubs/klein-curacao-og.jpg',
  })
  @IsOptional()
  @IsUrl()
  ogImage?: string;

  @ApiPropertyOptional({
    enum: HubStatus,
    example: HubStatus.PUBLISHED,
    description:
      'Publish lifecycle (G6). DRAFT -> PUBLISHED is gated by the publish guard (422 if requirements unmet).',
  })
  @IsOptional()
  @IsEnum(HubStatus)
  status?: HubStatus;

  @ApiPropertyOptional({ enum: HubType, example: HubType.LOCATION })
  @IsOptional()
  @IsEnum(HubType)
  hubType?: HubType;

  @ApiPropertyOptional({ example: 11.9833 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: -68.6333 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AddAllowedCategoryDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  categoryId!: string;
}

export class HubTranslationFieldsDto {
  @ApiPropertyOptional({ example: 'Klein Curaçao' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: 'A stunning uninhabited island.' })
  @IsOptional()
  @IsString()
  overview?: string;

  @ApiPropertyOptional({
    example: 'Where islanders send their visitors',
    description: 'Hero subtitle under the H1 (G5).',
  })
  @IsOptional()
  @IsString()
  heroTagline?: string;

  @ApiPropertyOptional({ example: 'Day Trips to Klein Curaçao' })
  @IsOptional()
  @IsString()
  h1Override?: string;

  @ApiPropertyOptional({ example: 'Klein Curaçao' })
  @IsOptional()
  @IsString()
  breadcrumbLabel?: string;
}

export class UpsertHubTranslationsDto {
  @ApiProperty({ type: HubTranslationFieldsDto })
  @ValidateNested()
  @Type(() => HubTranslationFieldsDto)
  fields!: HubTranslationFieldsDto;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isMachineTranslated?: boolean = false;
}

export class UpsertHubPageContentDto {
  @ApiPropertyOptional({
    example: 'Klein Curaçao is a small uninhabited island.',
  })
  @IsOptional()
  @IsString()
  aboutText?: string;

  @ApiPropertyOptional({ example: 'Klein Curaçao Day Trips - Island Tours' })
  @IsOptional()
  @IsString()
  metaTitle?: string;

  @ApiPropertyOptional({ example: 'Book day trips to Klein Curaçao.' })
  @IsOptional()
  @IsString()
  metaDescription?: string;
}

export class CreateFaqDto {
  @ApiProperty({ enum: Locale, example: Locale.en })
  @IsEnum(Locale)
  locale!: Locale;

  @ApiProperty({ example: 'What should I bring to Klein Curaçao?' })
  @IsString()
  @MinLength(5)
  question!: string;

  @ApiProperty({
    example: 'Bring sunscreen, drinking water, and snorkelling gear.',
  })
  @IsString()
  @MinLength(10)
  answer!: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class UpdateFaqDto {
  @ApiPropertyOptional({ example: 'What should I bring?' })
  @IsOptional()
  @IsString()
  @MinLength(5)
  question?: string;

  @ApiPropertyOptional({ example: 'Bring sunscreen and water.' })
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

// ── Content sections (Discover / Local Tips / Fast Facts / Editorial) ─────────

export class HubContentSectionInputDto {
  @ApiProperty({ enum: Locale, example: Locale.en })
  @IsEnum(Locale)
  locale!: Locale;

  @ApiProperty({ enum: HubSectionType, example: HubSectionType.DISCOVER })
  @IsEnum(HubSectionType)
  sectionType!: HubSectionType;

  @ApiProperty({ example: 'The White Beach' })
  @IsString()
  @MinLength(1)
  heading!: string;

  @ApiProperty({ example: 'A two-kilometre stretch of powder-soft sand...' })
  @IsString()
  @MinLength(1)
  body!: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/hubs/klein-curacao-white-beach.jpg',
    description:
      'Optional illustrative image for the section (Discover cards).',
  })
  @IsOptional()
  @IsUrl()
  image?: string;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class ReplaceContentSectionsDto {
  @ApiProperty({
    type: [HubContentSectionInputDto],
    description:
      'Full replacement set of content sections for the hub (all locales/types). Existing rows are deleted and replaced.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HubContentSectionInputDto)
  sections!: HubContentSectionInputDto[];
}

// ── Our Picks ─────────────────────────────────────────────────────────────────

export class OurPickTranslationInputDto {
  @ApiProperty({ enum: Locale, example: Locale.nl })
  @IsEnum(Locale)
  locale!: Locale;

  @ApiProperty({ example: 'De beste boot - comfort wint.' })
  @IsString()
  @MinLength(1)
  description!: string;
}

export class HubOurPickInputDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  tourId!: string;

  @ApiProperty({ enum: HubPickType, example: HubPickType.BEST_OVERALL })
  @IsEnum(HubPickType)
  pickType!: HubPickType;

  @ApiProperty({
    example: "We've been on every boat - this one wins on comfort.",
    description: 'Base-locale (en) editorial blurb fallback.',
  })
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({
    type: [OurPickTranslationInputDto],
    description: 'Per-locale blurb translations (HubOurPickTranslation).',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OurPickTranslationInputDto)
  translations?: OurPickTranslationInputDto[];
}

export class SetOurPicksDto {
  @ApiProperty({
    type: [HubOurPickInputDto],
    description:
      'Full replacement set of Our Pick selections. Master caps this at 3 (Best overall / Most popular / Best for families).',
  })
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => HubOurPickInputDto)
  picks!: HubOurPickInputDto[];
}

// ── Comparison ──────────────────────────────────────────────────────────────

export class ComparisonGroupNameTranslationInputDto {
  @ApiProperty({ enum: Locale, example: Locale.nl })
  @IsEnum(Locale)
  locale!: Locale;

  @ApiProperty({ example: 'Comforttrips' })
  @IsString()
  @MinLength(1)
  groupName!: string;
}

export class ComparisonStandoutTranslationInputDto {
  @ApiProperty({ enum: Locale, example: Locale.nl })
  @IsEnum(Locale)
  locale!: Locale;

  @ApiProperty({ example: 'Duikschool, massage met uitzicht' })
  @IsString()
  @MinLength(1)
  standoutNote!: string;
}

export class ComparisonTourInputDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  tourId!: string;

  @ApiPropertyOptional({
    example: 'Dive school, massage with a view',
    description: 'Base-locale "what stands out" cell.',
  })
  @IsOptional()
  @IsString()
  standoutNote?: string;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({
    type: [ComparisonStandoutTranslationInputDto],
    description:
      'Per-locale "what stands out" cell (HubComparisonTourTranslation).',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComparisonStandoutTranslationInputDto)
  translations?: ComparisonStandoutTranslationInputDto[];
}

export class ComparisonGroupInputDto {
  @ApiProperty({
    example: 'Comfort trips',
    description: 'Base-locale group label.',
  })
  @IsString()
  @MinLength(1)
  groupName!: string;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({
    type: [ComparisonGroupNameTranslationInputDto],
    description: 'Per-locale group name (HubComparisonGroupTranslation).',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComparisonGroupNameTranslationInputDto)
  translations?: ComparisonGroupNameTranslationInputDto[];

  @ApiProperty({
    type: [ComparisonTourInputDto],
    description: 'Tour columns within this group.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComparisonTourInputDto)
  tours!: ComparisonTourInputDto[];
}

export class SetComparisonDto {
  @ApiProperty({
    type: [ComparisonGroupInputDto],
    description:
      'Full replacement set of comparison groups + their tour columns.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComparisonGroupInputDto)
  groups!: ComparisonGroupInputDto[];
}

// ── Comparison (admin all-locale read-back for the editor) ────────────────────

export class ComparisonGroupNameTranslationItemDto {
  @ApiProperty({ enum: Locale, example: Locale.nl }) locale!: Locale;
  @ApiProperty({ example: 'Comforttrips' }) groupName!: string;
}

export class ComparisonStandoutTranslationItemDto {
  @ApiProperty({ enum: Locale, example: Locale.nl }) locale!: Locale;
  @ApiProperty({ example: 'Duikschool, massage met uitzicht' })
  standoutNote!: string;
}

export class ComparisonTourForEditDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) id!: string;
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  tourId!: string;
  @ApiProperty({ example: 'Klein Curaçao Deluxe Catamaran' }) tourName!: string;
  @ApiProperty({ example: 'Dive school, massage with a view', nullable: true })
  standoutNote!: string | null;
  @ApiProperty({ example: 0 }) displayOrder!: number;
  @ApiProperty({ type: [ComparisonStandoutTranslationItemDto] })
  translations!: ComparisonStandoutTranslationItemDto[];
}

export class ComparisonGroupForEditDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) id!: string;
  @ApiProperty({ example: 'Comfort trips' }) groupName!: string;
  @ApiProperty({ example: 0 }) displayOrder!: number;
  @ApiProperty({ type: [ComparisonGroupNameTranslationItemDto] })
  translations!: ComparisonGroupNameTranslationItemDto[];
  @ApiProperty({ type: [ComparisonTourForEditDto] })
  tours!: ComparisonTourForEditDto[];
}
