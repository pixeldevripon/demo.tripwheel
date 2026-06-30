import { applyDecorators } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { NotFoundErrorDto } from '@/common/dto/error-responses.dto';
import { ApiNotFoundResponse } from '@nestjs/swagger';
import { PaymentIntentResponseDto, WebhookAckDto } from './dto/payment.dto';

export const ApiCreateIntentDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Create (or fetch) the up-front payment intent for a booking',
      description:
        'Returns a Stripe PaymentIntent client secret for the platform charge (deposit or full). ' +
        'ON_ARRIVAL / OPERATOR_FULL return `{ paymentRequired: false }`. Idempotent per (booking, kind).',
    }),
    ApiCreatedResponse({ type: PaymentIntentResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiServiceUnavailableResponse({
      description: 'Payments are not configured.',
    }),
  );

export const ApiStripeWebhookDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Stripe webhook (signature-verified, idempotent)',
      description:
        'Public + throttle-exempt. Verifies the Stripe-Signature header against the raw body, ' +
        'records the event once, and settles the booking on payment_intent.succeeded.',
    }),
    ApiOkResponse({ type: WebhookAckDto }),
  );

export const ApiMollieWebhookDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Mollie webhook (idempotent ledger, reconciliation pending)',
      description:
        'Public + throttle-exempt. Mollie posts only a payment id; the event is recorded once ' +
        'in `mollie_webhook_events` so redelivery is a no-op (mirrors the Stripe ledger). ' +
        'Full status reconciliation lands with the Mollie checkout flow.',
    }),
    ApiOkResponse({ type: WebhookAckDto }),
  );
