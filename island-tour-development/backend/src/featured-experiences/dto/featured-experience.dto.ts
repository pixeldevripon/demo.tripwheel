import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Locale } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Admin-supplied media URL rules, matching the homepage DTO: a real https URL,
 * length-capped. `videoUrl` is rendered as a `<video src>` on the homepage
 * carousel, so a `javascript:`/`data:` value must never reach the DOM.
 */
const URL_MAX_LENGTH = 2048;
const URL_RULES = { protocols: ['https'], require_protocol: true };

const TITLE_MAX_LENGTH = 80;

// ── Response DTOs ─────────────────────────────────────────────────────────────

/**
 * A public card. PRESENTATION ONLY (founder, 2026-08-04): an admin-typed
 * label + poster + optional video. No link, no category/hub reference - the
 * reel is a mood board of the platform's activities, not navigation. The
 * label is a single admin-entered string, not translated across locales.
 */
export class ResolvedExperienceResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'Sunset Cruises' })
  title!: string;

  @ApiProperty({
    description:
      "The card's poster. Never null on the public side - a card without one " +
      'is dropped by the resolver. Doubles as the poster for `videoUrl`.',
  })
  image!: string | null;

  @ApiPropertyOptional({ nullable: true })
  videoUrl!: string | null;
}

/** The admin row - the stored values, verbatim. */
export class FeaturedExperienceResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'Sunset Cruises' })
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  videoUrl!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Card poster; doubles as the video poster. A card with no poster is ' +
      'dropped by the public resolver.',
  })
  posterUrl!: string | null;

  @ApiProperty({ example: 0 })
  displayOrder!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;
}

// ── Query DTOs ────────────────────────────────────────────────────────────────

/**
 * Both fields are accepted and IGNORED: cards are presentation-only with a
 * single admin-entered label, so there is nothing locale- or destination-
 * specific to resolve. They stay declared so requests from already-deployed
 * frontends (which send `?locale=`) do not 400 under `forbidNonWhitelisted`.
 */
export class PublicExperiencesQueryDto {
  @ApiPropertyOptional({ enum: Locale, default: Locale.en })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;

  @ApiPropertyOptional({ example: 'curacao' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  destination?: string;
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

export class CreateFeaturedExperienceDto {
  @ApiProperty({ example: 'Sunset Cruises', description: 'The card label.' })
  // Trimmed BEFORE MinLength so a whitespace-only label cannot slip past the
  // dashboard's own client-side trim via a direct API call.
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : (value as unknown),
  )
  @IsString()
  @MinLength(1)
  @MaxLength(TITLE_MAX_LENGTH)
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUrl(URL_RULES)
  @MaxLength(URL_MAX_LENGTH)
  videoUrl?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Card poster; doubles as the video poster. Without one the card is ' +
      'dropped by the public resolver.',
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

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateFeaturedExperienceDto {
  @ApiPropertyOptional({ example: 'Sunset Cruises' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : (value as unknown),
  )
  @IsString()
  @MinLength(1)
  @MaxLength(TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUrl(URL_RULES)
  @MaxLength(URL_MAX_LENGTH)
  videoUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
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

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
