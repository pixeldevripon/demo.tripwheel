import { Locale } from '@/common/constants/locales';
import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { Currency } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  SearchSort,
  TourQueryDto,
  TourResponseDto,
} from '@/tours/dto/tour.dto';

export { SearchSort };

/**
 * Filter params the search page shares with the listing toolbar. Picked off
 * `TourQueryDto` rather than re-declared, so the two endpoints cannot drift on
 * validation, coercion or Swagger docs - the toolbar is one component and it
 * must mean the same thing on both pages.
 */
const SHARED_FILTER_KEYS = [
  'categoryIds',
  'minPrice',
  'maxPrice',
  'durationMin',
  'durationMax',
  'ratingMin',
  'cancellationMaxHours',
  'pickupAvailable',
  'guests',
  'timeOfDay',
] as const;

export class SearchQueryDto extends PickType(TourQueryDto, SHARED_FILTER_KEYS) {
  @ApiProperty({
    example: 'catamaran',
    description:
      'Search term (min 2 chars). Matches tour title/description/highlights + category & hub names.',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q!: string;

  @ApiPropertyOptional({
    example: 'curacao',
    description: 'Scope results to a destination slug (omit for global search)',
  })
  @IsOptional()
  @IsString()
  destinationSlug?: string;

  @ApiPropertyOptional({
    enum: SearchSort,
    default: SearchSort.relevance,
    description:
      'Sort order. `relevance` (default) ranks by where the term matched - tour name/title beats a category or hub name, which beats the overview or a highlight - and falls back to the canonical ranking within a tier.',
  })
  @IsOptional()
  @IsIn(Object.values(SearchSort))
  sort?: SearchSort = SearchSort.relevance;

  @ApiPropertyOptional({
    example: '2026-07-01',
    description:
      'Date (YYYY-MM-DD). When set, only tours with an OPEN departure on that date are returned; `guests` and `timeOfDay` refine that same-day availability.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  date?: string;

  @ApiPropertyOptional({ enum: Locale, default: 'en' })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;

  @ApiPropertyOptional({
    enum: Currency,
    description:
      'Shopper display currency; each hit carries a converted `money` object (guide §20.9).',
  })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

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
}

/**
 * A search hit is a public tour plus the two fields needed to render a result
 * link without a second request: the localized `title` and the destination slug
 * (the flat URL is `/{locale}/{destinationSlug}/{slug}`).
 */
export class SearchHitDto extends TourResponseDto {
  @ApiProperty({
    example: 'Sunset Catamaran Cruise',
    description: 'Localized title (falls back to the canonical name)',
  })
  title!: string;

  @ApiProperty({
    example: 'curacao',
    nullable: true,
    description: 'Destination slug for building the flat tour URL',
  })
  destinationSlug!: string | null;

  @ApiProperty({
    example: 'mostPopular',
    nullable: true,
    enum: ['sponsored', 'likelyToSellOut', 'mostPopular', 'new'],
    description:
      'Listing badge (master §3.6/§3.7) - at most one, by priority. null = no badge. See TOUR-BADGES.md.',
  })
  badge!: 'sponsored' | 'likelyToSellOut' | 'mostPopular' | 'new' | null;
}

export class SearchResultsResponseDto {
  @ApiProperty({ example: 7 }) total!: number;
  @ApiProperty({ example: 1 }) page!: number;
  @ApiProperty({ example: 20 }) limit!: number;
  @ApiProperty({ example: 'catamaran' }) query!: string;
  @ApiProperty({ type: [SearchHitDto] }) data!: SearchHitDto[];
}
