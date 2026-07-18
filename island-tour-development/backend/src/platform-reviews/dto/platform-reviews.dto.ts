import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class PlatformReviewsConfigResponseDto {
  @ApiProperty({ example: 'default' })
  id!: string;

  @ApiProperty({
    example: 'google',
    nullable: true,
    description: "'trustpilot' | 'google' - null when not configured",
  })
  provider!: string | null;

  @ApiProperty({
    example: '••••••••abcd',
    nullable: true,
    description: 'Masked - never the plaintext key',
  })
  apiKey!: string | null;

  @ApiProperty({
    example: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
    nullable: true,
    description: 'Trustpilot business-unit ID or Google Place ID',
  })
  businessId!: string | null;

  @ApiProperty({ example: true })
  enabled!: boolean;

  @ApiProperty({ example: ['homepage'], type: [String] })
  displayPages!: string[];

  @ApiProperty({ nullable: true, example: '2026-07-18T10:00:00.000Z' })
  fetchedAt!: Date | null;

  @ApiProperty({
    nullable: true,
    example: null,
    description: 'Last fetch failure (cleared on success)',
  })
  lastError!: string | null;

  @ApiProperty({
    nullable: true,
    example: 245,
    description: 'Review count from the cached payload (admin insight)',
  })
  reviewCount!: number | null;

  @ApiProperty({ nullable: true, example: 4.7 })
  rating!: number | null;
}

/** One normalized third-party review (provider-agnostic shape). */
export class PlatformReviewDto {
  @ApiProperty({ example: 'Maria S.' })
  author!: string;

  @ApiProperty({
    nullable: true,
    example: 'https://lh3.googleusercontent.com/a/photo',
  })
  avatarUrl!: string | null;

  @ApiProperty({ example: 5 })
  rating!: number;

  @ApiProperty({ example: 'Best day of our trip - the crew was fantastic.' })
  text!: string;

  @ApiProperty({ nullable: true, example: '2026-06-30T18:21:00.000Z' })
  publishedAt!: string | null;

  @ApiProperty({ nullable: true, example: '2 weeks ago' })
  relativeTime!: string | null;
}

/**
 * Public payload for the marketing site. `visible` is the single gate the
 * frontend obeys: false when disabled, unconfigured, fetch never succeeded,
 * or the platform's review count has not crossed the social-proof threshold
 * (> 100 reviews).
 */
export class PublicPlatformReviewsResponseDto {
  @ApiProperty({ example: true })
  visible!: boolean;

  @ApiProperty({ example: 'google', nullable: true })
  provider!: string | null;

  @ApiProperty({ example: 4.7, nullable: true })
  rating!: number | null;

  @ApiProperty({ example: 245, nullable: true })
  reviewCount!: number | null;

  @ApiProperty({ type: [PlatformReviewDto] })
  reviews!: PlatformReviewDto[];

  @ApiProperty({ example: ['homepage'], type: [String] })
  displayPages!: string[];
}

export class RefreshPlatformReviewsResponseDto {
  @ApiProperty({ example: true })
  ok!: boolean;

  @ApiPropertyOptional({ example: 245 })
  reviewCount?: number;

  @ApiPropertyOptional({ example: 4.7 })
  rating?: number;

  @ApiPropertyOptional({
    example: 'Trustpilot responded 401 - check the API key',
  })
  error?: string;
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

export class UpdatePlatformReviewsConfigDto {
  @ApiPropertyOptional({
    enum: ['trustpilot', 'google'],
    nullable: true,
    description: 'null clears the provider (disables fetching)',
  })
  @IsOptional()
  @IsIn(['trustpilot', 'google'])
  provider?: 'trustpilot' | 'google';

  @ApiPropertyOptional({
    description:
      'Plaintext key to set; omit to keep the stored one (masked values are ignored); empty string clears it',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  apiKey?: string;

  @ApiPropertyOptional({
    example: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
    description: 'Trustpilot business-unit ID or Google Place ID',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  businessId?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ example: ['homepage'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  displayPages?: string[];
}
