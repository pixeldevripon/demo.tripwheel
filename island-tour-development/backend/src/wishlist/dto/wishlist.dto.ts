import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency, Locale } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { MoneyDto } from '@/fx/dto/money.dto';

// ── Query ─────────────────────────────────────────────────────────────────────

export class WishlistQueryDto {
  @ApiPropertyOptional({
    enum: Locale,
    default: Locale.en,
    description: 'Locale for the tour title',
  })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;

  @ApiPropertyOptional({
    enum: Currency,
    description:
      'Shopper display currency; adds a converted `money` object per card',
  })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;
}

// ── Response ────────────────────────────────────────────────────────────────

export class WishlistTourImageDto {
  @ApiProperty({ example: 'https://res.cloudinary.com/.../hero.jpg' })
  url!: string;
  @ApiPropertyOptional({ example: 'Catamaran at sunset', nullable: true })
  altText!: string | null;
}

/**
 * A saved tour, shaped like a public search hit (so the frontend reuses the same
 * card mapper) plus `savedAt`.
 */
export class WishlistTourDto {
  @ApiProperty({ example: 'd1f1…' }) id!: string;
  @ApiProperty({
    example: 'Sunset Catamaran Cruise',
    description: 'Localized title (falls back to name)',
  })
  title!: string;
  @ApiProperty({
    example: 'Sunset Catamaran Cruise',
    description: 'Canonical English name',
  })
  name!: string;
  @ApiProperty({ example: 'sunset-catamaran-cruise' }) slug!: string;
  @ApiProperty({ example: 'curacao', nullable: true }) destinationSlug!:
    | string
    | null;
  @ApiProperty({ example: '39', nullable: true }) priceFrom!: string | null;
  @ApiProperty({ example: '65', nullable: true }) basePrice!: string | null;
  @ApiProperty({ example: 'USD' }) defaultCurrency!: string;
  @ApiPropertyOptional({
    type: MoneyDto,
    description: 'Converted display prices when `currency` was requested',
  })
  money?: MoneyDto;
  @ApiProperty({ example: 'PER_PERSON' }) pricingModel!: string;
  @ApiProperty({ example: 120, nullable: true }) durationMinutesFrom!:
    | number
    | null;
  @ApiProperty({ example: 150, nullable: true }) durationMinutesTo!:
    | number
    | null;
  @ApiProperty({ example: 'NONE' }) pickupModel!: string;
  @ApiProperty({ example: 24, nullable: true }) cancellationHours!:
    | number
    | null;
  @ApiProperty({ example: 4.8, nullable: true }) aggregateRating!:
    | number
    | null;
  @ApiProperty({ example: 132 }) aggregateReviewCount!: number;
  @ApiProperty({ example: true }) isLocalsFavourite!: boolean;
  @ApiProperty({ type: [WishlistTourImageDto] })
  images!: WishlistTourImageDto[];
  @ApiProperty({ example: '2026-06-20T10:00:00.000Z' }) savedAt!: string;
}

export class WishlistMutationResponseDto {
  @ApiProperty({ example: 'd1f1…' }) tourId!: string;
  @ApiProperty({
    example: true,
    description: 'true after add, false after remove',
  })
  saved!: boolean;
}
