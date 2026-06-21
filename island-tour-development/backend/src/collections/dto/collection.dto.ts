import { Locale } from '@/common/constants/locales';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CollectionType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class CollectionResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) id!: string;
  @ApiProperty({ example: 'a1b2c3d4-0000-0000-0000-000000000001' }) destinationId!: string;
  @ApiProperty({ example: 'Top 10 Tours' }) name!: string;
  @ApiProperty({ example: 'top-10-tours' }) slug!: string;
  @ApiProperty({ enum: CollectionType }) collectionType!: CollectionType;
  @ApiProperty({ type: [String], example: [] }) tourIds!: string[];
  @ApiPropertyOptional({ example: { booking_type: 'private' }, nullable: true }) filterQuery!: unknown;
  @ApiPropertyOptional({ example: null, nullable: true }) heroImage!: string | null;
  @ApiProperty({ example: 'recommended' }) sortOrder!: string;
  @ApiProperty({ example: true }) isActive!: boolean;
  @ApiProperty({ example: false }) isSeeded!: boolean;
  @ApiProperty({ example: '2024-06-01T08:00:00.000Z' }) createdAt!: Date;
  @ApiProperty({ example: '2024-06-01T08:00:00.000Z' }) updatedAt!: Date;
}

export class CollectionLocalizedResponseDto extends CollectionResponseDto {
  @ApiProperty({ enum: Locale, example: Locale.nl }) locale!: Locale;
  @ApiProperty({ example: false }) isMachineTranslated!: boolean;
}

export class CollectionDetailResponseDto extends CollectionLocalizedResponseDto {
  @ApiPropertyOptional({ nullable: true }) overview!: string | null;
  @ApiPropertyOptional({ nullable: true }) h1Override!: string | null;
  @ApiPropertyOptional({ nullable: true }) breadcrumbLabel!: string | null;
  @ApiProperty({ type: [Object], description: 'Resolved tours (manual order, or dynamic filter result)' })
  tours!: unknown[];
}

export class CollectionTranslationEntryDto {
  @ApiProperty({ enum: Locale, example: Locale.nl }) locale!: Locale;
  @ApiPropertyOptional({ nullable: true }) name!: string | null;
  @ApiPropertyOptional({ nullable: true }) overview!: string | null;
  @ApiPropertyOptional({ nullable: true }) h1Override!: string | null;
  @ApiPropertyOptional({ nullable: true }) breadcrumbLabel!: string | null;
  @ApiProperty({ example: false }) isMachineTranslated!: boolean;
}

export class CollectionPageContentResponseDto {
  @ApiProperty({ enum: Locale, example: Locale.nl }) locale!: Locale;
  @ApiPropertyOptional({ nullable: true }) aboutText!: string | null;
  @ApiPropertyOptional({ nullable: true }) metaTitle!: string | null;
  @ApiPropertyOptional({ nullable: true }) metaDescription!: string | null;
}

export class FaqResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) id!: string;
  @ApiProperty({ enum: Locale, example: Locale.en }) locale!: Locale;
  @ApiProperty({ example: 'How are these tours chosen?' }) question!: string;
  @ApiProperty({ example: 'Hand-picked by our editors.' }) answer!: string;
  @ApiProperty({ example: 0 }) displayOrder!: number;
  @ApiProperty({ example: true }) isActive!: boolean;
}

export class DeleteMessageResponseDto {
  @ApiProperty({ example: 'Deleted successfully' }) message!: string;
}

// ── Query DTOs ────────────────────────────────────────────────────────────────

export class LocaleQueryDto {
  @ApiPropertyOptional({ enum: Locale, default: 'en' })
  @IsOptional() @IsEnum(Locale) locale?: Locale = Locale.en;
}

export class FaqLocaleQueryDto {
  @ApiPropertyOptional({ enum: Locale })
  @IsOptional() @IsEnum(Locale) locale?: Locale;
}

export class ActiveCollectionsQueryDto {
  @ApiProperty({ example: 'curacao', description: 'Destination slug' })
  @IsString()
  destinationSlug!: string;

  @ApiPropertyOptional({ enum: Locale, default: 'en' })
  @IsOptional() @IsEnum(Locale) locale?: Locale = Locale.en;
}

export class CollectionBySlugQueryDto {
  @ApiProperty({ example: 'curacao', description: 'Destination slug' })
  @IsString()
  destinationSlug!: string;

  @ApiPropertyOptional({ enum: Locale, default: 'en' })
  @IsOptional() @IsEnum(Locale) locale?: Locale = Locale.en;
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

export class CreateCollectionDto {
  @ApiProperty({ example: 'a1b2c3d4-0000-0000-0000-000000000001' })
  @IsUUID()
  destinationId!: string;

  @ApiProperty({ example: 'Top 10 Tours' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ example: 'top-10-tours', description: 'Auto-generated from name when omitted. Must not equal a category slug.' })
  @IsOptional() @IsString() @MinLength(2) slug?: string;

  @ApiProperty({ enum: CollectionType, example: CollectionType.MANUAL })
  @IsEnum(CollectionType)
  collectionType!: CollectionType;

  @ApiPropertyOptional({ type: [String], description: 'MANUAL: ordered tour ids' })
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) tourIds?: string[];

  @ApiPropertyOptional({ example: { categoryId: 'uuid', attributes: { booking_type: 'private' } }, description: 'DYNAMIC: saved filter' })
  @IsOptional() @IsObject() filterQuery?: Record<string, unknown>;

  @ApiPropertyOptional({ example: null })
  @IsOptional() @IsString() heroImage?: string;

  @ApiPropertyOptional({ example: 'recommended', description: 'recommended | price_asc | price_desc | rating | newest' })
  @IsOptional() @IsString() sortOrder?: string;
}

export class UpdateCollectionDto {
  @ApiPropertyOptional({ example: 'Top 10 Tours' })
  @IsOptional() @IsString() @MinLength(2) name?: string;

  @ApiPropertyOptional({
    example: 'top-10-tours',
    description:
      'Renaming issues an automatic 301 redirect; the old slug is protected by a 90-day reuse cooldown. Must not equal a category slug.',
  })
  @IsOptional() @IsString() @MinLength(2) slug?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) tourIds?: string[];

  @ApiPropertyOptional({ example: { attributes: { booking_type: 'private' } } })
  @IsOptional() @IsObject() filterQuery?: Record<string, unknown>;

  @ApiPropertyOptional({ example: null })
  @IsOptional() @IsString() heroImage?: string;

  @ApiPropertyOptional({ example: 'rating' })
  @IsOptional() @IsString() sortOrder?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CollectionTranslationFieldsDto {
  @ApiPropertyOptional({ example: 'Top 10 Tours' })
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @ApiPropertyOptional({ example: 'Onze top 10 tours' })
  @IsOptional() @IsString() overview?: string;
  @ApiPropertyOptional({ example: 'Top 10 Tours op Curaçao' })
  @IsOptional() @IsString() h1Override?: string;
  @ApiPropertyOptional({ example: 'Top 10' })
  @IsOptional() @IsString() breadcrumbLabel?: string;
}

export class UpsertCollectionTranslationsDto {
  @ApiProperty({ type: CollectionTranslationFieldsDto })
  @ValidateNested() @Type(() => CollectionTranslationFieldsDto)
  fields!: CollectionTranslationFieldsDto;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional() @IsBoolean() isMachineTranslated?: boolean = false;
}

export class UpsertCollectionPageContentDto {
  @ApiPropertyOptional({ example: 'These are our most-booked tours...' })
  @IsOptional() @IsString() aboutText?: string;
  @ApiPropertyOptional({ example: 'Top 10 Tours in Curaçao | Island Tours' })
  @IsOptional() @IsString() metaTitle?: string;
  @ApiPropertyOptional({ example: 'Book the 10 best-rated tours in Curaçao.' })
  @IsOptional() @IsString() metaDescription?: string;
}

export class CreateFaqDto {
  @ApiProperty({ enum: Locale, example: Locale.en })
  @IsEnum(Locale) locale!: Locale;
  @ApiProperty({ example: 'How are these tours chosen?' })
  @IsString() @MinLength(5) question!: string;
  @ApiProperty({ example: 'Hand-picked by our editors based on ratings and bookings.' })
  @IsString() @MinLength(10) answer!: string;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional() @IsInt() @Min(0) displayOrder?: number;
}

export class UpdateFaqDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(5) question?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(10) answer?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) displayOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
