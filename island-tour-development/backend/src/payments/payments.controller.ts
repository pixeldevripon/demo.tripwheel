import {
  BadRequestException,
  Controller,
  Headers,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '@/auth/decorators/public.decorator';
import { PaymentsService } from './payments.service';
import { ApiCreateIntentDocs, ApiStripeWebhookDocs } from './payments.swagger';

/**
 * PaymentsController - checkout intents + the Stripe webhook.
 *
 * - `POST /payments/bookings/:id/intent` is `@Public()` (traveller checkout, keyed on
 *   the unguessable booking id) and returns a client secret for Stripe.js.
 * - `POST /payments/webhook` is `@Public()` + `@SkipThrottle()` (master rule #15):
 *   Stripe signs it, we verify against the **raw** body, and it is idempotent.
 */
@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('bookings/:id/intent')
  @Public()
  @ApiCreateIntentDocs()
  createIntent(@Param('id') id: string) {
    return this.payments.createIntentForBooking(id);
  }

  @Post('webhook')
  @Public()
  @SkipThrottle()
  @ApiStripeWebhookDocs()
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    if (!signature) throw new BadRequestException('Missing Stripe-Signature header');
    if (!req.rawBody) throw new BadRequestException('Missing raw request body');
    await this.payments.handleWebhook(req.rawBody, signature);
    return { received: true };
  }
}
