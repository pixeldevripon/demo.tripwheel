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
    example: '72',
    description:
      'Lowest bookable price in `currency` (age-band min or unit base). A WHOLE currency unit, rounded UP (`retailWhole`).',
  })
  priceFrom!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: '1104',
    description:
      'Unit/base price in `currency` (UNIT tours); null for per-person. Whole unit, rounded up.',
  })
  basePrice!: string | null;
}

/**
 * The `money` object on a tour DETAIL, which carries the child retail amounts a
 * booking widget prices from as well as the headline figures.
 *
 * These exist because the widget shows a live estimate before the traveller has
 * a server quote, and it used to build that estimate by multiplying each source
 * price by `fxRate` itself. Two things went wrong with that. The arithmetic
 * disagreed with the backend's - a $139 tour reached the card as this object's
 * whole "128" and the widget as its own 127.88, so one page showed two prices
 * for one tour - and the widget's own rows kept cents the platform had already
 * decided travellers should not see ("35,88 EUR" for a $39 add-on).
 *
 * Every amount here is run through `retailWhole` (ceil to a whole currency
 * unit), the same rule the quote and the booking totals use. The frontend
 * renders them as served: it does no FX and no rounding of its own.
 *
 * Keyed by child id rather than nested on each child so the conversion stays one
 * object the client can trust, and so the source amounts on the children remain
 * untouched for OCTO and any non-display consumer.
 */
export class TourDetailMoneyDto extends MoneyDto {
  @ApiPropertyOptional({
    nullable: true,
    example: '19',
    description:
      'Per-extra-guest surcharge in `currency` (GROUP unit tours); null otherwise.',
  })
  extraPersonPrice!: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { '3f2a…': '128', '7b1c…': '77' },
    description:
      'Age-band id → its price in `currency` (whole unit, rounded up).',
  })
  ageBands!: Record<string, string>;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { '9c4d…': '23', 'a10e…': '36' },
    description:
      'Add-on id → its unit price in `currency` (whole unit, rounded up).',
  })
  addOns!: Record<string, string>;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { 'd52f…': '14' },
    description:
      'Pickup-location id → its per-person zone price in `currency` (whole unit, rounded up). Priced zones only.',
  })
  pickupLocations!: Record<string, string>;
}
