import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FeaturedEntityType, Locale } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Admin-supplied media URL rules, matching the homepage DTO: a real https URL,
 * length-capped. `videoUrl` is rendered as a `<video src>` on the homepage
 * carousel, so a `javascript:`/`data:` value must never reach the DOM.
 */
const URL_MAX_LENGTH = 2048;
const URL_RULES = { protocols: ['https'], require_protocol: true };

// ── Response DTOs ─────────────────────────────────────────────────────────────

/**
 * A card, fully resolved. Title/image/href come from the referenced Category or
 * Hub rather than the featured row, so a card inherits that entity's
 * translations and can never drift from the page it links to.
 */
export class ResolvedExperienceResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({
    enum: FeaturedEntityType,
    example: FeaturedEntityType.CATEGORY,
  })
  entityType!: FeaturedEntityType;

  @ApiProperty({ example: 'Snorkeling' })
  title!: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      "The card photo, already resolved: the card's own poster when set, " +
      "otherwise the target entity's hero (then og) image. Doubles as the " +
      'poster for `videoUrl`.',
  })
  image!: string | null;

  @ApiPropertyOptional({ nullable: true })
  videoUrl!: string | null;

  @ApiProperty({
    example: '/curacao/snorkeling',
    nullable: true,
    description:
      'Locale-less path; the frontend localizes it. Null when the card is ' +
      'marked not-clickable - it still renders, it just does not link.',
  })
  href!: string | null;
}

/** The admin row - raw stored values plus a readable label. */
export class FeaturedExperienceResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ enum: FeaturedEntityType })
  entityType!: FeaturedEntityType;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  entityId!: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Null = show everywhere.',
  })
  destinationId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  videoUrl!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Card poster override. Null = the card uses the target entity image ' +
      '(see `entityImage`).',
  })
  posterUrl!: string | null;

  @ApiProperty({
    example: true,
    description: 'False = the card shows but is not clickable.',
  })
  isLink!: boolean;

  @ApiProperty({ example: 0 })
  displayOrder!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiPropertyOptional({
    example: 'Snorkeling',
    nullable: true,
    description:
      'Name of the referenced category/hub. Null means the target no longer ' +
      'exists - the public side drops such a row, so the admin list surfaces it.',
  })
  entityName!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      "The target entity's own photo (hero, else og). This is what the card " +
      'falls back to when `posterUrl` is null, so the editor can preview the ' +
      'real card without a second round of lookups.',
  })
  entityImage!: string | null;
}

// ── Query DTOs ────────────────────────────────────────────────────────────────

export class PublicExperiencesQueryDto {
  @ApiPropertyOptional({ enum: Locale, default: Locale.en })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;

  @ApiPropertyOptional({
    example: 'curacao',
    description:
      'Omit for the global homepage (matches "show everywhere" rows only). ' +
      'Pass a slug on a destination page to also pick up rows pinned to it.',
  })
  @IsOptional()
  @IsString()
  destination?: string;
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

export class CreateFeaturedExperienceDto {
  @ApiProperty({ enum: FeaturedEntityType })
  @IsEnum(FeaturedEntityType)
  entityType!: FeaturedEntityType;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  entityId!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  destinationId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUrl(URL_RULES)
  @MaxLength(URL_MAX_LENGTH)
  videoUrl?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: "Card poster. Null falls back to the target entity's image.",
  })
  @IsOptional()
  @IsUrl(URL_RULES)
  @MaxLength(URL_MAX_LENGTH)
  posterUrl?: string | null;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description:
      'Whether the card opens its target page. False = the card still shows, ' +
      'with its title, but is not clickable. Distinct from `isActive`, which ' +
      'removes the card from the carousel entirely.',
  })
  @IsOptional()
  @IsBoolean()
  isLink?: boolean;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateFeaturedExperienceDto {
  @ApiPropertyOptional({ enum: FeaturedEntityType })
  @IsOptional()
  @IsEnum(FeaturedEntityType)
  entityType?: FeaturedEntityType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  destinationId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUrl(URL_RULES)
  @MaxLength(URL_MAX_LENGTH)
  videoUrl?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: "Card poster. Null falls back to the target entity's image.",
  })
  @IsOptional()
  @IsUrl(URL_RULES)
  @MaxLength(URL_MAX_LENGTH)
  posterUrl?: string | null;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description:
      'Whether the card opens its target page. False = the card still shows, ' +
      'with its title, but is not clickable. Distinct from `isActive`, which ' +
      'removes the card from the carousel entirely.',
  })
  @IsOptional()
  @IsBoolean()
  isLink?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
