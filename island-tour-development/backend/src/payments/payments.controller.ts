import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Permission } from '@prisma/client';
import { Public } from '@/auth/decorators/public.decorator';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { AuthenticatedUser } from '@/auth/decorators/authenticated-user.decorator';
import type { TypedAuthUser } from '@/auth/auth.types';
import { PaymentsService } from './payments.service';
import {
  CreatePaymentIntentDto,
  ListPaymentsQueryDto,
  MollieWebhookDto,
} from './dto/payment.dto';
import {
  ApiCreateIntentDocs,
  ApiListPaymentsDocs,
  ApiMollieWebhookDocs,
  ApiSettleBookingDocs,
  ApiStripeWebhookDocs,
} from './payments.swagger';

/**
 * PaymentsController - checkout intents + the Stripe webhook.
 *
 * - `POST /payments/bookings/:id/intent` is `@Public()` (traveller checkout, keyed on
 *   the unguessable booking id). Returns a Stripe.js client secret OR a Mollie
 *   hosted-checkout URL, depending on the admin-selected active provider.
 * - `POST /payments/webhook` is `@Public()` + `@SkipThrottle()` (master rule #15):
 *   Stripe signs it, we verify against the **raw** body, and it is idempotent.
 * - `POST /payments/typ/:publicRef/settle` is `@Public()` (keyed on publicRef):
 *   the synchronous "confirm on return" fast path; re-verifies the intent with
 *   Stripe and is idempotent with the webhook (both funnel through the same
 *   atomically-guarded `confirmFromPayment`).
 */
@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  // Conflict #7: this surface is money by nature, so it requires
  // VIEW_BOOKING_FINANCIALS ON TOP of its own permission. Without the pairing a
  // "field guide" designation granted only 'View payments' would read back exactly
  // the amounts the manifest projection hides on /bookings.
  @RequirePermissions(
    Permission.VIEW_PAYMENTS,
    Permission.VIEW_BOOKING_FINANCIALS,
  )
  @ApiListPaymentsDocs()
  list(
    @AuthenticatedUser() user: TypedAuthUser,
    @Query() query: ListPaymentsQueryDto,
  ) {
    return this.payments.list(query, { id: user.id, role: user.role });
  }

  @Post('bookings/:id/intent')
  @Public()
  @ApiCreateIntentDocs()
  createIntent(@Param('id') id: string, @Body() dto: CreatePaymentIntentDto) {
    return this.payments.createIntentForBooking(id, dto);
  }

  /**
   * POST /payments/typ/:publicRef/settle
   *
   * Synchronous "confirm on return" (traveller checkout, keyed on the
   * unguessable publicRef - same capability the TYP URL rides on, so nothing
   * new is exposed). The browser calls this the instant Stripe.js reports the
   * payment succeeded, so the booking confirms without waiting for the async
   * webhook. The service re-verifies the PaymentIntent with Stripe (never
   * trusts the client) and is idempotent with the webhook. Human-pace throttle
   * - the processing page calls it once or twice, never in a loop.
   */
  @Throttle({
    short: { limit: 3, ttl: 10_000 },
    medium: { limit: 10, ttl: 60_000 },
    // Explicit hourly ceiling like the sibling publicRef routes - this is the
    // one that costs a live Stripe API call per hit, so it must not silently
    // inherit the loose global tier (3000/hr, sized for dashboard loads).
    long: { limit: 20, ttl: 3_600_000 },
  })
  @Post('typ/:publicRef/settle')
  @Public()
  @ApiSettleBookingDocs()
  settle(@Param('publicRef') publicRef: string) {
    return this.payments.settleFromReturn(publicRef);
  }

  @Post('webhook')
  @Public()
  @SkipThrottle()
  @ApiStripeWebhookDocs()
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    if (!signature)
      throw new BadRequestException('Missing Stripe-Signature header');
    if (!req.rawBody) throw new BadRequestException('Missing raw request body');
    await this.payments.handleWebhook(req.rawBody, signature);
    return { received: true };
  }

  @Post('webhook/mollie')
  @Public()
  @SkipThrottle()
  @ApiMollieWebhookDocs()
  async mollieWebhook(@Body() body: MollieWebhookDto) {
    if (!body?.id) throw new BadRequestException('Missing Mollie payment id');
    await this.payments.handleMollieWebhook(body.id);
    return { received: true };
  }
}
