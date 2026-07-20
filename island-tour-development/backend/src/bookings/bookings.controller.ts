import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Ip,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthenticatedUser } from '@/auth/decorators/authenticated-user.decorator';
import { Public } from '@/auth/decorators/public.decorator';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { Permission } from '@prisma/client';
import type { TypedAuthUser } from '@/auth/auth.types';
import { BookingsService } from './bookings.service';
import { TRAVELER_SESSION_HEADER } from './traveler-session.util';
import {
  CancelBookingDto,
  ConfirmBookingDto,
  ExtendBookingDto,
  ListBookingsQueryDto,
  LookupBookingDto,
  QuoteBookingDto,
  RecoverReferenceDto,
  RequestCancellationDto,
  ReserveBookingDto,
  UpdateBookingDto,
} from './dto/booking.dto';
import {
  ApiCalendarDocs,
  ApiCancelDocs,
  ApiConfirmDocs,
  ApiCustomerCancellationRequestDocs,
  ApiCustomerSummaryDocs,
  ApiExtendDocs,
  ApiGetBookingDocs,
  ApiListBookingsDocs,
  ApiLookupBookingDocs,
  ApiQuoteDocs,
  ApiRecoverReferenceDocs,
  ApiRequestCancellationDocs,
  ApiReserveDocs,
  ApiResendConfirmationDocs,
  ApiThankYouDocs,
  ApiUpdateBookingDocs,
} from './bookings.swagger';

/**
 * BookingsController - OCTO reserve → confirm lifecycle (native source of truth).
 *
 * ## Access
 * - Reserve / confirm / cancel / extend / update are `@Public()` - keyed on the
 *   unguessable booking `id` (travellers + guests, no account required). When a
 *   session is present it's used for attribution (userId) and `cancelledBy`.
 * - Reads (`GET`) require auth and are scoped in the service: admin → all,
 *   operator → their tours, user → their own bookings.
 *
 * OCTO `/octo/bookings` is a thin adapter over this service (later phase).
 */
@ApiTags('Bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  // Static routes BEFORE dynamic (:id) routes - NestJS matches top-to-bottom.
  @Post('quote')
  @Public()
  @ApiQuoteDocs()
  quote(@Body() dto: QuoteBookingDto) {
    return this.bookings.quote(dto);
  }

  @Post()
  @Public()
  @ApiReserveDocs()
  reserve(
    @Body() dto: ReserveBookingDto,
    @AuthenticatedUser() user?: TypedAuthUser,
  ) {
    return this.bookings.reserve(dto, user?.id);
  }

  @Post(':id/confirm')
  @Public()
  @ApiConfirmDocs()
  confirm(@Param('id') id: string, @Body() dto: ConfirmBookingDto) {
    return this.bookings.confirm(id, dto);
  }

  @Post(':id/cancel')
  @Public()
  @ApiCancelDocs()
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
    @AuthenticatedUser() user?: TypedAuthUser,
  ) {
    const actor = user ? { id: user.id, role: user.role } : undefined;
    return this.bookings.cancel(id, dto, actor);
  }

  @Post(':id/extend')
  @Public()
  @ApiExtendDocs()
  extend(@Param('id') id: string, @Body() dto: ExtendBookingDto) {
    return this.bookings.extend(id, dto);
  }

  @Patch(':id')
  @Public()
  @ApiUpdateBookingDocs()
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBookingDto,
    @Headers(TRAVELER_SESSION_HEADER) sessionToken?: string,
  ) {
    // The session is only REQUIRED when changing contact on a CONFIRMED
    // booking (the service enforces it); checkout's pre-payment contact PATCH
    // runs on ON_HOLD and needs none.
    return this.bookings.update(id, dto, sessionToken);
  }

  /**
   * POST /bookings/lookup
   *
   * The traveller `/bookings` login surface: email + display reference in, TYP
   * coordinates out. Effectively a credential check, so it gets the same
   * human-pace throttle as the other public TYP actions (the global tiers are
   * far too loose for guessing pairs) - and like them it MUST be called from
   * the browser, never SSR (`skipIf: isTrustedInternalOrigin` would bypass
   * every limit below).
   */
  @Throttle({
    short: { limit: 2, ttl: 10_000 },
    medium: { limit: 6, ttl: 60_000 },
    long: { limit: 30, ttl: 3_600_000 },
  })
  @Post('lookup')
  @Public()
  @ApiLookupBookingDocs()
  lookup(@Body() dto: LookupBookingDto, @Ip() ip?: string) {
    return this.bookings.lookupBooking(dto, ip);
  }

  /**
   * POST /bookings/lookup/recover-reference
   *
   * "Lost your reference?" on the `/bookings` surface. Always acks with
   * `{ sent: true }` (enumeration-proof); when the email has bookings, the
   * service mails the references to the STORED contact address - the recipient
   * is never accepted from the caller. Sends mail, so it gets the same
   * human-pace throttle as resend (and the same browser-only rule: the SSR
   * internal-key bypass would skip every limit below).
   */
  @Throttle({
    short: { limit: 1, ttl: 10_000 },
    medium: { limit: 3, ttl: 60_000 },
    long: { limit: 10, ttl: 3_600_000 },
  })
  @Post('lookup/recover-reference')
  @Public()
  @ApiRecoverReferenceDocs()
  recoverReference(@Body() dto: RecoverReferenceDto) {
    return this.bookings.recoverReference(dto);
  }

  @Get('typ/:publicRef')
  @Public()
  @ApiThankYouDocs()
  thankYou(
    @Param('publicRef') publicRef: string,
    @Headers(TRAVELER_SESSION_HEADER) sessionToken?: string,
  ) {
    return this.bookings.getThankYou(publicRef, sessionToken);
  }

  /**
   * POST /bookings/typ/:publicRef/resend
   *
   * Re-sends the confirmation email from the thank-you page ("Don't see it?
   * Check spam, or Resend email").
   *
   * Security: @Public and keyed on the unguessable `publicRef`, matching the TYP
   * read above. The recipient is NOT accepted from the caller - the service
   * sends only to the address stored on the booking, so this can never be used
   * to mail an arbitrary inbox.
   *
   * The global tiers (60/s, 300/min, 3000/hr) are sized for dashboard page loads
   * and are far too loose for a route that sends mail, so this one is throttled
   * to a human's pace: 1 per 10s (double-click), 3/min, 10/hr. Must be called
   * from the BROWSER, never SSR - `skipIf: isTrustedInternalOrigin` in
   * AuthModule exempts the internal API secret, which would bypass every limit
   * below.
   */
  @Throttle({
    short: { limit: 1, ttl: 10_000 },
    medium: { limit: 3, ttl: 60_000 },
    long: { limit: 10, ttl: 3_600_000 },
  })
  @Post('typ/:publicRef/resend')
  @Public()
  @ApiResendConfirmationDocs()
  resendConfirmation(@Param('publicRef') publicRef: string) {
    return this.bookings.resendConfirmation(publicRef);
  }

  /**
   * POST /bookings/typ/:publicRef/cancellation-request
   *
   * The tokenized cancel form (master 6.4/C1). Never cancels on click - it
   * emails the admin, who processes the refund and confirms by email. Unlike
   * resend, this is a MUTATION, so link possession is not enough: the service
   * requires a traveler session (X-Traveler-Session) owning the booking's
   * contact email - a leaked TYP URL can't cancel someone's trip. Still
   * @Public (no Better Auth), throttled to a human pace, and MUST be called
   * from the browser (the internal-key SSR bypass would skip every limit).
   */
  @Throttle({
    short: { limit: 1, ttl: 10_000 },
    medium: { limit: 3, ttl: 60_000 },
    long: { limit: 10, ttl: 3_600_000 },
  })
  @Post('typ/:publicRef/cancellation-request')
  @Public()
  @ApiRequestCancellationDocs()
  requestCancellation(
    @Param('publicRef') publicRef: string,
    @Body() dto: RequestCancellationDto,
    @Headers(TRAVELER_SESSION_HEADER) sessionToken?: string,
  ) {
    return this.bookings.requestCancellation(
      publicRef,
      dto.reason,
      sessionToken,
    );
  }

  /**
   * GET /bookings/typ/:publicRef/calendar.ics
   *
   * The confirmation email's "Add to calendar" link. `@Public` and keyed on the
   * unguessable `publicRef` because it is opened straight from an email client,
   * which carries no session.
   *
   * Returns `text/calendar` as an attachment so mail clients and browsers hand it
   * to the OS calendar rather than rendering it as text.
   */
  @Get('typ/:publicRef/calendar.ics')
  @Public()
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="island-tours-booking.ics"',
  )
  @ApiCalendarDocs()
  calendar(@Param('publicRef') publicRef: string) {
    return this.bookings.getCalendar(publicRef);
  }

  // Dashboard reads. VIEW_BOOKINGS gates WHO may look at bookings at all
  // (admins, operators, staff/seats granted it, and USER customers); the
  // service then scopes WHICH rows (operators to their own tours; platform
  // staff see all; customers only their own bookings via userId).
  @Get()
  @RequirePermissions(Permission.VIEW_BOOKINGS)
  @ApiListBookingsDocs()
  list(
    @AuthenticatedUser() user: TypedAuthUser,
    @Query() query: ListBookingsQueryDto,
  ) {
    return this.bookings.list(query, { id: user.id, role: user.role });
  }

  /**
   * GET /bookings/me/summary - the customer dashboard's stat row: booking
   * counts + net spend per currency, computed live from the payment ledger
   * for the caller's OWN bookings. Static route: MUST stay above `:id`.
   */
  @Get('me/summary')
  @RequirePermissions(Permission.VIEW_BOOKINGS)
  @ApiCustomerSummaryDocs()
  customerSummary(@AuthenticatedUser() user: TypedAuthUser) {
    return this.bookings.getCustomerSummary({ id: user.id });
  }

  /**
   * POST /bookings/:id/cancellation-request - cancellation request from a
   * logged-in customer (dashboard /account surface). Ownership = the booking's
   * userId; foreign ids 404. Same downstream flow (admin email + notices) as
   * the public TYP route above.
   */
  @Throttle({
    short: { limit: 1, ttl: 10_000 },
    medium: { limit: 3, ttl: 60_000 },
    long: { limit: 10, ttl: 3_600_000 },
  })
  @Post(':id/cancellation-request')
  @RequirePermissions(Permission.VIEW_BOOKINGS)
  @ApiCustomerCancellationRequestDocs()
  requestCancellationAsCustomer(
    @Param('id') id: string,
    @AuthenticatedUser() user: TypedAuthUser,
    @Body() dto: RequestCancellationDto,
  ) {
    return this.bookings.requestCancellationAsCustomer(
      id,
      { id: user.id },
      dto.reason,
    );
  }

  @Get(':id')
  @RequirePermissions(Permission.VIEW_BOOKINGS)
  @ApiGetBookingDocs()
  get(@Param('id') id: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.bookings.getById(id, { id: user.id, role: user.role });
  }
}
