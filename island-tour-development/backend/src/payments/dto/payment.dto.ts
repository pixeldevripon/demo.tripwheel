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
  SettlementStatus,
} from '@prisma/client';
import { IsLocalDate } from '@/common/validators/is-local-date.validator';
import { SettlementMethod } from '@/settlements/dto/settlement.dto';

// ── Response ──────────────────────────────────────────────────────────────────

export class PaymentIntentResponseDto {
  @ApiProperty({
    example: true,
    description:
      'Whether an up-front platform charge is required. False only for OPERATOR_FULL (nothing to pay now); ON_ARRIVAL captures a deposit.',
  })
  paymentRequired!: boolean;

  @ApiPropertyOptional({
    enum: PaymentProvider,
    example: PaymentProvider.STRIPE,
    description:
      'Which PSP takes this charge (admin-selected). STRIPE → inline Elements via clientSecret; MOLLIE → hosted redirect via checkoutUrl.',
  })
  provider?: PaymentProvider;

  @ApiPropertyOptional({
    example: 'https://www.mollie.com/checkout/select-method/7UhSN1zuXS',
    description:
      'Mollie hosted-checkout URL - redirect the traveller here. Absent on the Stripe path; also absent when the Mollie payment is already paid (status SUCCEEDED - go straight to processing).',
  })
  checkoutUrl?: string;

  @ApiPropertyOptional({
    example: 'pfl_3RkSN1zuPE',
    description:
      'Mollie profile id for the inline Components card form (mollie.js) - PUBLIC, the Mollie sibling of a publishable key. Only on the MOLLIE setup response (no returnUrl yet); absent = inline form not configured, use the hosted page.',
  })
  profileId?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'Whether the Mollie account runs on a test API key - mollie.js needs the flag to tokenize against the test profile.',
  })
  testmode?: boolean;

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

  @ApiProperty({
    example: false,
    description:
      'True when the latest charge attempt failed/was canceled/expired at the ' +
      'PSP (verified live, both providers) - the processing page sends the ' +
      'traveller back to the checkout to retry instead of polling forever. ' +
      'Always false once the booking is CONFIRMED.',
  })
  paymentFailed!: boolean;
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
  @ApiPropertyOptional({
    nullable: true,
    enum: SettlementStatus,
    description:
      'Settlement-ledger status of the parent booking (null until confirmed).',
  })
  settlementStatus!: SettlementStatus | null;
  @ApiProperty({
    enum: SettlementMethod,
    description:
      'HOW the parent booking settles (derived from its payment model).',
  })
  settlementMethod!: SettlementMethod;
  @ApiProperty({
    description:
      "True when the parent booking's paid_in_full payout is HELD by a pending " +
      'cancellation request. Render "On hold" beside the settlement badge.',
  })
  settlementHeld!: boolean;
}

export class ListPaymentsResponseDto {
  @ApiProperty({ example: 64 }) total!: number;
  @ApiProperty({ example: 1 }) page!: number;
  @ApiProperty({ example: 20 }) limit!: number;
  @ApiProperty({ type: [PaymentListItemDto] }) data!: PaymentListItemDto[];
}

// ── Request ─────────────────────────────────────────────────────────────────

/**
 * Optional intent-creation body. Only the Mollie (hosted redirect) path uses
 * it: Mollie needs the redirect targets AT payment creation, unlike Stripe
 * where the browser passes return_url at confirm time. Both URLs are validated
 * server-side against the CORS origin allow-list.
 */
export class CreatePaymentIntentDto {
  @ApiPropertyOptional({
    example:
      'https://islandtours.example/curacao/tour/checkout/processing?ref=…',
    description:
      'Where Mollie sends the traveller after the payment attempt (the processing page). Omitting it on the Mollie path returns the SETUP response (Components profile, no payment created); sending it CREATES the payment.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  returnUrl?: string;

  @ApiPropertyOptional({
    example: 'https://islandtours.example/curacao/tour/checkout?…',
    description:
      'Where Mollie sends the traveller when they abort on the hosted page (back to the checkout).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  cancelUrl?: string;

  @ApiPropertyOptional({
    example: 'tkn_UqAvArS3gw',
    description:
      'Mollie Components card token (mollie.js) - creates a creditcard payment for the card typed inline; the checkout URL is then only the 3DS hop.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cardToken?: string;
}

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
