import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  BookingStatus,
  Currency,
  PaymentKind,
  PaymentProvider,
  PaymentStatus,
} from '@prisma/client';
import { IsLocalDate } from '@/common/validators/is-local-date.validator';

// ── Response ──────────────────────────────────────────────────────────────────

export class PaymentIntentResponseDto {
  @ApiProperty({
    example: true,
    description:
      'Whether an up-front platform charge is required. False only for OPERATOR_FULL (nothing to pay now); ON_ARRIVAL captures a deposit.',
  })
  paymentRequired!: boolean;

  @ApiPropertyOptional({
    example: 'pi_3Q…_secret_abc',
    description:
      'Stripe PaymentIntent client secret - hand to Stripe.js to collect the card.',
  })
  clientSecret?: string;

  @ApiPropertyOptional({
    example: 'pk_live_…',
    description: 'Stripe publishable key for Stripe.js.',
  })
  publishableKey?: string;

  @ApiPropertyOptional({
    example: '41.99',
    description: 'Amount charged now, in the booking currency.',
  })
  amount?: string;

  @ApiPropertyOptional({ enum: Currency, example: Currency.EUR })
  currency?: Currency;

  @ApiPropertyOptional({ enum: PaymentKind, example: PaymentKind.DEPOSIT })
  kind?: PaymentKind;

  @ApiPropertyOptional({
    enum: PaymentStatus,
    example: PaymentStatus.REQUIRES_PAYMENT,
  })
  status?: PaymentStatus;

  @ApiPropertyOptional({
    type: [String],
    example: ['card', 'paypal', 'ideal'],
    description:
      'Eligible payment methods for this booking (account-activated + currency-compatible). The checkout offers only these; card is inline, PayPal/iDEAL redirect.',
  })
  paymentMethodTypes?: string[];
}

export class WebhookAckDto {
  @ApiProperty({ example: true })
  received!: boolean;
}

/** Result of the synchronous settle-on-return call. */
export class SettleBookingResponseDto {
  @ApiProperty({
    enum: BookingStatus,
    description:
      'Current booking status after the synchronous settle attempt. ' +
      'CONFIRMED = the processing page can redirect to the TYP immediately.',
  })
  status!: BookingStatus;

  @ApiProperty({ description: 'TYP coordinate for the redirect.' })
  publicRef!: string;
}

/** One row of the dashboard payments table: the payment + booking context. */
export class PaymentListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() bookingId!: string;
  @ApiProperty({ enum: PaymentProvider }) provider!: PaymentProvider;
  @ApiProperty({ enum: PaymentKind }) kind!: PaymentKind;
  @ApiProperty({ enum: PaymentStatus }) status!: PaymentStatus;
  @ApiProperty({ example: '47.99' }) amount!: string;
  @ApiProperty({ enum: Currency }) currency!: Currency;
  @ApiPropertyOptional({ nullable: true, example: 'pi_3Q…' })
  intentId!: string | null;
  @ApiPropertyOptional({ nullable: true }) methodType!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
  @ApiProperty({ example: 'IT-2026-0A1B2C' }) bookingDisplayRef!: string;
  @ApiProperty() bookingPublicRef!: string;
  @ApiProperty({ example: 'Klein Curacao Day Trip' }) tourName!: string;
  @ApiPropertyOptional({ nullable: true, example: 'Jane Doe' })
  contactFullName!: string | null;
  @ApiProperty({ example: '2026-07-04' }) bookingLocalDate!: string;
  @ApiProperty({
    enum: ['OPERATOR_LINK', 'ON_ARRIVAL', 'PAID_IN_FULL', 'OPERATOR_FULL'],
  })
  paymentModel!: string;
}

export class ListPaymentsResponseDto {
  @ApiProperty({ example: 64 }) total!: number;
  @ApiProperty({ example: 1 }) page!: number;
  @ApiProperty({ example: 20 }) limit!: number;
  @ApiProperty({ type: [PaymentListItemDto] }) data!: PaymentListItemDto[];
}

// ── Request ─────────────────────────────────────────────────────────────────

/** Mollie posts only the payment id to its webhook (form-urlencoded `id`). */
export class MollieWebhookDto {
  @ApiProperty({
    example: 'tr_WDqYK6vllg',
    description: 'Mollie payment/object id.',
  })
  @IsString()
  id!: string;
}

export class ListPaymentsQueryDto {
  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({ enum: PaymentKind })
  @IsOptional()
  @IsEnum(PaymentKind)
  kind?: PaymentKind;

  @ApiPropertyOptional({ enum: PaymentProvider })
  @IsOptional()
  @IsEnum(PaymentProvider)
  provider?: PaymentProvider;

  @ApiPropertyOptional({
    example: 'IT-2026-0A1B2C',
    description:
      'Matches booking refs, intent id, guest name/email, or tour name.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    example: '2026-07-01',
    description: 'Payment created on/after this day (UTC).',
  })
  @IsOptional()
  @IsLocalDate()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-07-31',
    description: 'Payment created on/before this day (UTC).',
  })
  @IsOptional()
  @IsLocalDate()
  to?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
