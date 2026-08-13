import { Locale } from '@/common/constants/locales';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class CategoryResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'Boat Tours' })
  name!: string;

  @ApiProperty({ example: 'boat-tours' })
  slug!: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/boat-tours.jpg',
    nullable: true,
  })
  heroImage!: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/boat-tours-og.jpg',
    nullable: true,
    description: 'Open Graph image for social sharing.',
  })
  ogImage!: string | null;

  @ApiPropertyOptional({
    example: 'Catamaran sailing, snorkelling and island cruises.',
    nullable: true,
  })
  description!: string | null;

  @ApiPropertyOptional({ example: 'boat', nullable: true })
  icon!: string | null;

  @ApiProperty({ example: 1 })
  sortOrder!: number;

  @ApiPropertyOptional({ example: null, nullable: true })
  parentCategoryId!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: true })
  isSeeded!: boolean;

  @ApiProperty({ example: '2024-06-01T08:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2024-06-01T08:00:00.000Z' })
  updatedAt!: Date;
}

export class CategoryLocalizedResponseDto extends CategoryResponseDto {
  @ApiProperty({ enum: Locale, example: Locale.nl })
  locale!: Locale;

  @ApiProperty({ example: false })
  isMachineTranslated!: boolean;
}

// Returned by getById / getBySlug - includes all translated fields
export class CategoryDetailResponseDto extends CategoryLocalizedResponseDto {
  @ApiPropertyOptional({
    example: 'Discover stunning boat tours around the island.',
    nullable: true,
  })
  overview!: string | null;

  @ApiPropertyOptional({ example: 'Boat Tours in Curaçao', nullable: true })
  h1Override!: string | null;

  @ApiPropertyOptional({ example: 'Boat Tours', nullable: true })
  breadcrumbLabel!: string | null;
}

// Destination-scoped responses (V2 §3 tour-gating) - carry the published tour count.
export class CategoryByDestinationResponseDto extends CategoryLocalizedResponseDto {
  @ApiProperty({
    example: 7,
    description: 'Published (LIVE) tours for this category in the destination.',
  })
  publishedTourCount!: number;
}

export class CategoryDetailByDestinationResponseDto extends CategoryDetailResponseDto {
  @ApiProperty({
    example: 7,
    description: 'Published (LIVE) tours for this category in the destination.',
  })
  publishedTourCount!: number;
}

export class PaginatedLocalizedCategoriesResponseDto {
  @ApiProperty({ example: 6 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ type: [CategoryLocalizedResponseDto] })
  data!: CategoryLocalizedResponseDto[];
}

export class DeleteCategoryResponseDto {
  @ApiProperty({ example: 'Category deactivated successfully' })
  message!: string;
}

export class DeleteMessageResponseDto {
  @ApiProperty({ example: 'Deleted successfully' })
  message!: string;
}

// ── Translation DTOs ──────────────────────────────────────────────────────────

export class CategoryTranslationFieldsDto {
  @ApiPropertyOptional({ example: 'Boottochten' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({
    example: 'Ontdek de mooiste boottochten van het eiland.',
  })
  @IsOptional()
  @IsString()
  overview?: string;

  @ApiPropertyOptional({ example: 'Boottochten op Curaçao' })
  @IsOptional()
  @IsString()
  h1Override?: string;

  @ApiPropertyOptional({ example: 'Boottochten' })
  @IsOptional()
  @IsString()
  breadcrumbLabel?: string;
}

export class UpsertCategoryTranslationsDto {
  @ApiProperty({ type: CategoryTranslationFieldsDto })
  @ValidateNested()
  @Type(() => CategoryTranslationFieldsDto)
  fields!: CategoryTranslationFieldsDto;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isMachineTranslated?: boolean = false;
}

export class CategoryTranslationEntryDto {
  @ApiProperty({ enum: Locale, example: Locale.nl })
  locale!: Locale;

  @ApiPropertyOptional({ example: 'Boottochten', nullable: true })
  name!: string | null;

  @ApiPropertyOptional({
    example: 'Ontdek de mooiste boottochten van het eiland.',
    nullable: true,
  })
  overview!: string | null;

  @ApiPropertyOptional({ example: 'Boottochten op Curaçao', nullable: true })
  h1Override!: string | null;

  @ApiPropertyOptional({ example: 'Boottochten', nullable: true })
  breadcrumbLabel!: string | null;

  @ApiProperty({ example: false })
  isMachineTranslated!: boolean;
}

// ── Page Content DTOs ─────────────────────────────────────────────────────────

export class UpsertCategoryPageContentDto {
  @ApiPropertyOptional({
    example: 'Boat tours in Curaçao offer stunning Caribbean views...',
  })
  @IsOptional()
  @IsString()
  aboutText?: string;

  @ApiPropertyOptional({ example: 'Best Boat Tours in Curaçao | Island Tours' })
  @IsOptional()
  @IsString()
  metaTitle?: string;

  @ApiPropertyOptional({ example: 'Discover top-rated boat tours in Curaçao.' })
  @IsOptional()
  @IsString()
  metaDescription?: string;
}

export class CategoryPageContentResponseDto {
  @ApiProperty({ enum: Locale, example: Locale.nl })
  locale!: Locale;

  @ApiPropertyOptional({
    example: 'Boottochten op Curaçao zijn...',
    nullable: true,
  })
  aboutText!: string | null;

  @ApiPropertyOptional({
    example: 'Beste Boottochten | Island Tours',
    nullable: true,
  })
  metaTitle!: string | null;

  @ApiPropertyOptional({
    example: 'Ontdek topbeoordeelde boottochten...',
    nullable: true,
  })
  metaDescription!: string | null;
}

// ── FAQ DTOs ──────────────────────────────────────────────────────────────────

export class CategoryFaqResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'What is included in the tour?' })
  question!: string;

  @ApiProperty({
    example: 'The tour includes a life jacket, snorkeling gear, and a guide.',
  })
  answer!: string;

  @ApiProperty({ example: 0 })
  displayOrder!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ enum: Locale, example: Locale.en })
  locale!: Locale;
}

export class CreateCategoryFaqDto {
  @ApiProperty({ enum: Locale, example: Locale.en })
  @IsEnum(Locale)
  locale!: Locale;

  @ApiProperty({ example: 'What is included in the tour?' })
  @IsString()
  @MinLength(5)
  question!: string;

  @ApiProperty({
    example: 'The tour includes a life jacket, snorkeling gear, and a guide.',
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

export class UpdateCategoryFaqDto {
  @ApiPropertyOptional({ example: 'Is food included?' })
  @IsOptional()
  @IsString()
  @MinLength(5)
  question?: string;

  @ApiPropertyOptional({ example: 'Yes, light snacks are provided.' })
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

export class CategoryQueryDto {
  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
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

// ── Request DTOs ──────────────────────────────────────────────────────────────

export class CreateCategoryDto {
  @ApiProperty({
    example: 'Sunset Cruises',
    description: 'Category display name. Slug is auto-generated.',
  })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({
    example: 'sunset-cruises',
    description: 'URL slug. Auto-generated from the name when omitted.',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  slug?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/boat-tours.jpg',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  heroImage?: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/boat-tours-og.jpg',
    nullable: true,
    description: 'Open Graph image for social sharing.',
  })
  @IsOptional()
  @IsString()
  ogImage?: string | null;

  // ── V2 fields ──────────────────────────────────────────────────────────────
  @ApiPropertyOptional({
    example: 'Catamaran sailing, snorkelling and island cruises.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'boat',
    description: 'Icon identifier for UI.',
  })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Display order in nav/filter.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    description:
      'Parent category id: creates the category as a FILTER-ONLY sub-category ' +
      '(no standalone page, no slug_registry rows). Omit for a top-level category.',
  })
  @IsOptional()
  @IsString()
  parentCategoryId?: string;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'Sunset Cruises' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({
    example: 'sunset-cruises',
    description:
      'Renaming issues an automatic 301 redirect in every destination the category is seeded into; the old slug is protected by a 90-day reuse cooldown.',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  slug?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/boat-tours.jpg',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  heroImage?: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/boat-tours-og.jpg',
    nullable: true,
    description: 'Open Graph image for social sharing.',
  })
  @IsOptional()
  @IsString()
  ogImage?: string | null;

  @ApiPropertyOptional({
    example: 'Catamaran sailing, snorkelling and island cruises.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'boat' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Parent category id. null detaches (promotes to top-level, restoring its pages); ' +
      'setting it on a top-level category demotes it to a filter-only sub-category and ' +
      'requires confirmPageRemoval: true.',
  })
  @IsOptional()
  @IsString()
  parentCategoryId?: string | null;

  @ApiPropertyOptional({
    example: true,
    description:
      'Required (true) when demoting a top-level category into a sub-category: accepts that ' +
      'its standalone page is removed on every destination (slug retired with the 90-day ' +
      'cooldown). Seeded categories can never be demoted.',
  })
  @IsOptional()
  @IsBoolean()
  confirmPageRemoval?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
