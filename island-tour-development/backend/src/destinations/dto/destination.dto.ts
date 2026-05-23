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

// ── Response DTOs ──────────────────────────────────────────────────────────────

export class DestinationResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) id!: string;
  @ApiProperty({ example: 'Curaçao' }) name!: string;
  @ApiProperty({ example: 'curacao' }) slug!: string;
  @ApiPropertyOptional({ example: 'https://cdn.example.com/curacao-hero.jpg' })
  heroImage!: string | null;
  @ApiProperty({ example: true }) isSeeded!: boolean;
  @ApiProperty({ example: true }) isActive!: boolean;
  @ApiProperty({ example: '2024-06-01T08:00:00.000Z' }) createdAt!: Date;
  @ApiProperty({ example: '2024-06-01T08:00:00.000Z' }) updatedAt!: Date;
}

export class DestinationLocalizedResponseDto extends DestinationResponseDto {
  @ApiProperty({ enum: Locale, example: Locale.nl })
  locale!: Locale;

  @ApiProperty({ example: false })
  isMachineTranslated!: boolean;
}

// Returned by getById / getBySlug — includes all translated fields
export class DestinationDetailResponseDto extends DestinationLocalizedResponseDto {
  @ApiPropertyOptional({ example: 'Curaçao is a sun-drenched island in the southern Caribbean.', nullable: true })
  overview!: string | null;

  @ApiPropertyOptional({ example: 'Tours & Activities in Curaçao', nullable: true })
  h1Override!: string | null;

  @ApiPropertyOptional({ example: 'Curaçao', nullable: true })
  breadcrumbLabel!: string | null;
}

export class PaginatedLocalizedDestinationsResponseDto {
  @ApiProperty({ example: 4 }) total!: number;
  @ApiProperty({ example: 1 }) page!: number;
  @ApiProperty({ example: 20 }) limit!: number;
  @ApiProperty({ type: [DestinationLocalizedResponseDto] }) data!: DestinationLocalizedResponseDto[];
}

export class DeleteDestinationResponseDto {
  @ApiProperty({ example: 'Destination deactivated successfully' }) message!: string;
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

  @ApiPropertyOptional({ example: 'Curaçao is een zonnig eiland in het zuidelijke Caribisch gebied.' })
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
    description: 'Destination names are proper nouns — always keep false for destinations.',
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

  @ApiPropertyOptional({ example: 'Curaçao is een zonnig eiland in het zuidelijke Caribisch gebied.', nullable: true })
  overview!: string | null;

  @ApiPropertyOptional({ example: 'Rondleidingen & Activiteiten op Curaçao', nullable: true })
  h1Override!: string | null;

  @ApiPropertyOptional({ example: 'Curaçao', nullable: true })
  breadcrumbLabel!: string | null;

  @ApiProperty({ example: false })
  isMachineTranslated!: boolean;
}

// ── Page Content DTOs ─────────────────────────────────────────────────────────

export class UpsertDestinationPageContentDto {
  @ApiPropertyOptional({ example: 'Curaçao is a vibrant Caribbean island known for its colourful architecture...' })
  @IsOptional()
  @IsString()
  aboutText?: string;

  @ApiPropertyOptional({ example: 'Best Tours & Activities in Curaçao | Island Tours' })
  @IsOptional()
  @IsString()
  metaTitle?: string;

  @ApiPropertyOptional({ example: 'Explore top-rated boat tours, snorkelling trips, and island experiences in Curaçao.' })
  @IsOptional()
  @IsString()
  metaDescription?: string;
}

export class DestinationPageContentResponseDto {
  @ApiProperty({ enum: Locale, example: Locale.nl })
  locale!: Locale;

  @ApiPropertyOptional({ example: 'Curaçao is een levendig Caribisch eiland...', nullable: true })
  aboutText!: string | null;

  @ApiPropertyOptional({ example: 'Beste Rondleidingen op Curaçao | Island Tours', nullable: true })
  metaTitle!: string | null;

  @ApiPropertyOptional({ example: 'Ontdek topbeoordeelde boottochten en eilandactiviteiten op Curaçao.', nullable: true })
  metaDescription!: string | null;
}

// ── FAQ DTOs ──────────────────────────────────────────────────────────────────

export class FaqResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'What is the best time to visit Curaçao?' })
  question!: string;

  @ApiProperty({ example: 'Curaçao enjoys warm weather year-round, but January–June offers the calmest seas.' })
  answer!: string;

  @ApiProperty({ example: 0 })
  displayOrder!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ enum: Locale, example: Locale.en })
  locale!: Locale;
}

export class CreateFaqDto {
  @ApiProperty({ enum: Locale, example: Locale.en })
  @IsEnum(Locale)
  locale!: Locale;

  @ApiProperty({ example: 'What is the best time to visit Curaçao?' })
  @IsString()
  @MinLength(5)
  question!: string;

  @ApiProperty({ example: 'Curaçao enjoys warm weather year-round, but January–June offers the calmest seas.' })
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
  @ApiPropertyOptional({ example: 'Do I need a visa to visit Curaçao?' })
  @IsOptional()
  @IsString()
  @MinLength(5)
  question?: string;

  @ApiPropertyOptional({ example: 'EU and US passport holders do not need a visa for stays up to 90 days.' })
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

  @ApiPropertyOptional({ description: 'Content locale', enum: Locale, default: Locale.en })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;
}

export class LocaleQueryDto {
  @ApiPropertyOptional({ description: 'Content locale', enum: Locale, default: Locale.en })
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
    description: 'Hero image URL — set after upload via the media module.',
  })
  @IsOptional()
  @IsString()
  heroImage?: string;
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

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
