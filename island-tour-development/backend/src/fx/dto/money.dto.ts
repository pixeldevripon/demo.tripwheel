import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency } from '@prisma/client';

/**
 * Canonical converted-price display object for public read endpoints (guide §20.9).
 * `currency` is the shopper currency actually shown; `sourceCurrency`/`fxRate` make the
 * conversion auditable. Amounts are strings (Decimal-safe). When no FX rate is available
 * the builder falls back to source currency (rate "1") so a page never blocks.
 */
export class MoneyDto {
  @ApiProperty({
    enum: Currency,
    description: 'Currency the amounts are shown in.',
  })
  currency!: Currency;

  @ApiProperty({ enum: Currency, description: "The tour's source currency." })
  sourceCurrency!: Currency;

  @ApiProperty({
    example: '0.92',
    description:
      'sourceCurrency → currency rate applied (1 when same or unresolved).',
  })
  fxRate!: string;

  @ApiPropertyOptional({
    nullable: true,
    example: '71.99',
    description:
      'Lowest bookable price in `currency` (age-band min or unit base).',
  })
  priceFrom!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: '1104.00',
    description:
      'Unit/base price in `currency` (UNIT tours); null for per-person.',
  })
  basePrice!: string | null;
}
