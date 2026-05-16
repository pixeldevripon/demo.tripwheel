import { SUPPORTED_LOCALES } from '@/common/constants/locales';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
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
  @ApiProperty({ enum: SUPPORTED_LOCALES, example: 'nl' })
  locale!: string;

  @ApiProperty({ example: false })
  isMachineTranslated!: boolean;
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

  @ApiPropertyOptional({ example: 'Ontdek de mooiste boottochten van het eiland.' })
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
  @ApiProperty({ enum: SUPPORTED_LOCALES, example: 'nl' })
  locale!: string;

  @ApiProperty({
    example: { name: 'Boottochten', overview: 'Ontdek...', h1Override: null, breadcrumbLabel: null },
  })
  fields!: Record<string, string>;

  @ApiProperty({ example: false })
  isMachineTranslated!: boolean;
}

// ── Page Content DTOs ─────────────────────────────────────────────────────────

export class CategoryPageContentFieldsDto {
  @ApiPropertyOptional({ example: 'Boat tours in Curaçao offer stunning Caribbean views...' })
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

export class UpsertCategoryPageContentDto {
  @ApiProperty({ type: CategoryPageContentFieldsDto })
  @ValidateNested()
  @Type(() => CategoryPageContentFieldsDto)
  fields!: CategoryPageContentFieldsDto;
}

export class CategoryPageContentResponseDto {
  @ApiProperty({ enum: SUPPORTED_LOCALES, example: 'nl' })
  locale!: string;

  @ApiProperty({
    example: {
      aboutText: 'Boottochten op Curaçao zijn...',
      metaTitle: 'Beste Boottochten | Island Tours',
      metaDescription: 'Ontdek...',
    },
  })
  fields!: Record<string, string>;
}

// ── FAQ DTOs ──────────────────────────────────────────────────────────────────

export class FaqResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'What is included in the tour?' })
  question!: string;

  @ApiProperty({ example: 'The tour includes a life jacket, snorkeling gear, and a guide.' })
  answer!: string;

  @ApiProperty({ example: 0 })
  displayOrder!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ enum: SUPPORTED_LOCALES, example: 'en' })
  locale!: string;
}

export class CreateFaqDto {
  @ApiProperty({ enum: SUPPORTED_LOCALES, example: 'en' })
  @IsIn(SUPPORTED_LOCALES)
  locale!: string;

  @ApiProperty({ example: 'What is included in the tour?' })
  @IsString()
  @MinLength(5)
  question!: string;

  @ApiProperty({ example: 'The tour includes a life jacket, snorkeling gear, and a guide.' })
  @IsString()
  @MinLength(10)
  answer!: string;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number = 0;
}

export class UpdateFaqDto {
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

  @ApiPropertyOptional({ description: 'Content locale', enum: SUPPORTED_LOCALES, default: 'en' })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: string = 'en';
}

export class LocaleQueryDto {
  @ApiPropertyOptional({ description: 'Content locale', enum: SUPPORTED_LOCALES, default: 'en' })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: string = 'en';
}

export class FaqLocaleQueryDto {
  @ApiPropertyOptional({
    description: 'Filter FAQs by locale. Omit to return all locales.',
    enum: SUPPORTED_LOCALES,
  })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: string;
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
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'Sunset Cruises' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
