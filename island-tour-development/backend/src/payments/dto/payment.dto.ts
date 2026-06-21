import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency, PaymentKind, PaymentStatus } from '@prisma/client';

// ── Response ──────────────────────────────────────────────────────────────────

export class PaymentIntentResponseDto {
  @ApiProperty({
    example: true,
    description:
      'Whether an up-front platform charge is required. False for ON_ARRIVAL / OPERATOR_FULL (nothing to pay now).',
  })
  paymentRequired!: boolean;

  @ApiPropertyOptional({
    example: 'pi_3Q…_secret_abc',
    description: 'Stripe PaymentIntent client secret — hand to Stripe.js to collect the card.',
  })
  clientSecret?: string;

  @ApiPropertyOptional({ example: 'pk_live_…', description: 'Stripe publishable key for Stripe.js.' })
  publishableKey?: string;

  @ApiPropertyOptional({ example: '41.99', description: 'Amount charged now, in the booking currency.' })
  amount?: string;

  @ApiPropertyOptional({ enum: Currency, example: Currency.EUR })
  currency?: Currency;

  @ApiPropertyOptional({ enum: PaymentKind, example: PaymentKind.DEPOSIT })
  kind?: PaymentKind;

  @ApiPropertyOptional({ enum: PaymentStatus, example: PaymentStatus.REQUIRES_PAYMENT })
  status?: PaymentStatus;
}

export class WebhookAckDto {
  @ApiProperty({ example: true })
  received!: boolean;
}
