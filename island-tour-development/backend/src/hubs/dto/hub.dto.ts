import { Locale } from '@/common/constants/locales';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HubType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

// ── Response DTOs ──────────────────────────────────────────────────────────────

export class AllowedCategoryItemDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) id!: string;
  @ApiProperty({ example: '7fa65f12-4b21-4e1a-9a3c-1d8e9a2b4c6d' }) categoryId!: string;
  @ApiProperty({
    example: { id: '7fa65f12-...', name: 'Boat Tours', slug: 'boat-tours' },
  })
  category!: { id: string; name: string; slug: string };
}

export class HubResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) id!: string;
  @ApiProperty({ example: 'a1b2c3d4-0000-0000-0000-000000000001' }) destinationId!: string;
  @ApiProperty({ example: 'Klein Curaçao' }) name!: string;
  @ApiProperty({ example: 'klein-curacao' }) slug!: string;
  @ApiPropertyOptional({ example: 'A small uninhabited island off the coast of Curaçao.' })
  description!: string | null;
  @ApiPropertyOptional({ enum: HubType, example: HubType.LOCATION, nullable: true })
  hubType!: HubType | null;
  @ApiPropertyOptional({ example: 11.9833, nullable: true }) latitude!: number | null;
  @ApiPropertyOptional({ example: -68.6333, nullable: true }) longitude!: number | null;
  @ApiProperty({ example: true }) isSeeded!: boolean;
  @ApiProperty({ example: true }) isActive!: boolean;
  @ApiProperty({ example: '2024-06-01T08:00:00.000Z' }) createdAt!: Date;
  @ApiProperty({ example: '2024-06-01T08:00:00.000Z' }) updatedAt!: Date;
}

export class HubLocalizedResponseDto extends HubResponseDto {
  @ApiProperty({ enum: Locale, example: Locale.nl }) locale!: Locale;
  @ApiProperty({ example: false }) isMachineTranslated!: boolean;
}

export class HubDetailLocalizedResponseDto extends HubLocalizedResponseDto {
  @ApiPropertyOptional({ nullable: true, example: null }) overview!: string | null;
  @ApiPropertyOptional({ nullable: true, example: null }) h1Override!: string | null;
  @ApiPropertyOptional({ nullable: true, example: null }) breadcrumbLabel!: string | null;
  @ApiProperty({ type: [AllowedCategoryItemDto] }) allowedCategories!: AllowedCategoryItemDto[];
}

export class PaginatedLocalizedHubsResponseDto {
  @ApiProperty({ example: 1 }) total!: number;
  @ApiProperty({ example: 1 }) page!: number;
  @ApiProperty({ example: 20 }) limit!: number;
  @ApiProperty({ type: [HubLocalizedResponseDto] }) data!: HubLocalizedResponseDto[];
}

export class HubTranslationEntryDto {
  @ApiProperty({ enum: Locale, example: Locale.nl }) locale!: Locale;
  @ApiPropertyOptional({ nullable: true }) name!: string | null;
  @ApiPropertyOptional({ nullable: true }) overview!: string | null;
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

export class FaqResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) id!: string;
  @ApiProperty({ enum: Locale, example: Locale.en }) locale!: Locale;
  @ApiProperty({ example: 'What should I bring?' }) question!: string;
  @ApiProperty({ example: 'Bring sunscreen, water, and a hat.' }) answer!: string;
  @ApiProperty({ example: 0 }) displayOrder!: number;
  @ApiProperty({ example: true }) isActive!: boolean;
}

export class AddAllowedCategoryResponseDto {
  @ApiProperty({ example: 'Allowed category added successfully' }) message!: string;
  @ApiProperty({ type: AllowedCategoryItemDto }) allowedCategory!: AllowedCategoryItemDto;
}

export class RemoveAllowedCategoryResponseDto {
  @ApiProperty({ example: 'Allowed category removed successfully' }) message!: string;
}

export class DeleteHubResponseDto {
  @ApiProperty({ example: 'Hub deactivated successfully' }) message!: string;
}

export class DeleteMessageResponseDto {
  @ApiProperty({ example: 'Deleted successfully' }) message!: string;
}

// ── Query DTOs ─────────────────────────────────────────────────────────────────

export class LocaleQueryDto {
  @ApiPropertyOptional({ enum: Locale, default: 'en', description: 'Content locale — falls back to English when translation is missing' })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;
}

export class FaqLocaleQueryDto {
  @ApiPropertyOptional({ enum: Locale, example: Locale.en, description: 'Filter FAQs by locale — omit to return all locales' })
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

  @ApiPropertyOptional({ enum: Locale, default: 'en', description: 'Content locale — falls back to English when translation is missing' })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;
}

export class ActiveHubsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by destination UUID' })
  @IsOptional()
  @IsUUID()
  destinationId?: string;

  @ApiPropertyOptional({ enum: Locale, default: 'en', description: 'Content locale — falls back to English when translation is missing' })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;
}

export class HubBySlugQueryDto {
  @ApiProperty({ example: 'curacao', description: 'Destination slug — required because hub slugs are unique per destination' })
  @IsString()
  destinationSlug!: string;

  @ApiPropertyOptional({ enum: Locale, default: 'en', description: 'Content locale — falls back to English when translation is missing' })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;
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

  @ApiPropertyOptional({ example: 'A small uninhabited island off the coast of Curaçao.' })
  @IsOptional()
  @IsString()
  description?: string;

  // ── V2 fields ──────────────────────────────────────────────────────────────
  @ApiProperty({ enum: HubType, example: HubType.LOCATION, description: 'location | highlight | area (V2 §5).' })
  @IsEnum(HubType)
  hubType!: HubType;

  @ApiPropertyOptional({ example: 11.9833, description: 'For location-type hubs.' })
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;

  @ApiPropertyOptional({ example: -68.6333 })
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;

  @ApiPropertyOptional({
    type: [String],
    example: ['cat-id-1', 'cat-id-2'],
    description: 'Initial set of allowed category IDs (can also be managed later via sub-routes)',
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

  @ApiPropertyOptional({ enum: HubType, example: HubType.LOCATION })
  @IsOptional() @IsEnum(HubType) hubType?: HubType;

  @ApiPropertyOptional({ example: 11.9833 })
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;

  @ApiPropertyOptional({ example: -68.6333 })
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;

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
  @ApiPropertyOptional({ example: 'Klein Curaçao is a small uninhabited island.' })
  @IsOptional()
  @IsString()
  aboutText?: string;

  @ApiPropertyOptional({ example: 'Klein Curaçao Day Trips — Island Tours' })
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

  @ApiProperty({ example: 'Bring sunscreen, drinking water, and snorkelling gear.' })
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
