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
  ReportCancellationDto,
  ChangeBookingDateDto,
  RequestCancellationDto,
  RequestTravellerCodeDto,
  ReserveBookingDto,
  TravellerListQueryDto,
  UpdateBookingDto,
  VerifyTravellerCodeDto,
} from './dto/booking.dto';
import {
  ApiCalendarDocs,
  ApiCancelDocs,
  ApiConfirmForfeitDocs,
  ApiDismissCancellationReportDocs,
  ApiDismissNonPaymentDocs,
  ApiReportCancellationDocs,
  ApiReportNonPaymentDocs,
  ApiClaimConversionDocs,
  ApiConfirmDocs,
  ApiAcceptOperatorTermsDocs,
  ApiExtendDocs,
  ApiGetBookingDocs,
  ApiListBookingsDocs,
  ApiLookupBookingDocs,
  ApiQuoteDocs,
  ApiRecoverReferenceDocs,
  ApiChangeBookingDateDocs,
  ApiDateChangeOptionsDocs,
  ApiRequestCancellationDocs,
  ApiRequestTravellerCodeDocs,
  ApiReserveDocs,
  ApiResendConfirmationDocs,
  ApiRestoreDocs,
  ApiWithdrawCancellationDocs,
  ApiThankYouDocs,
  ApiTravellerBookingsDocs,
  ApiTravellerContactDocs,
  ApiTravellerPaymentsDocs,
  ApiTravellerReceiptDocs,
  ApiTravellerSummaryDocs,
  ApiUpdateBookingDocs,
  ApiVerifyTravellerCodeDocs,
  ApiListBookingEmailsDocs,
} from './bookings.swagger';
import { EmailLogService } from '@/mail/email-log.service';

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
  constructor(
    private readonly bookings: BookingsService,
    private readonly emailLog: EmailLogService,
  ) {}

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
    return this.bookings.reserve(dto, user);
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

  /**
   * POST /bookings/:id/restore - reverse a mistaken cancellation (QA report
   * 2026-08-01). Admin-only twice over: MANAGE_BOOKINGS is admin-ceilinged,
   * and the service re-checks the role so a second entry point can never skip
   * the conflict-#2 boundary (restoring un-reverses real money obligations).
   */
  @Post(':id/restore')
  @RequirePermissions(Permission.MANAGE_BOOKINGS)
  @ApiRestoreDocs()
  restore(@Param('id') id: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.bookings.restore(id, { id: user.id, role: user.role });
  }

  // ── Non-payment forfeit (guide s15) - authenticated ops actions ──────────

  @Post(':id/report-non-payment')
  @RequirePermissions(Permission.EDIT_BOOKING)
  @ApiReportNonPaymentDocs()
  reportNonPayment(
    @Param('id') id: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.bookings.reportNonPayment(id, {
      id: user.id,
      role: user.role,
    });
  }

  @Post(':id/forfeit')
  @RequirePermissions(Permission.MANAGE_BOOKINGS)
  @ApiConfirmForfeitDocs()
  confirmForfeit(
    @Param('id') id: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.bookings.confirmForfeit(id, { id: user.id, role: user.role });
  }

  @Post(':id/dismiss-non-payment')
  @RequirePermissions(Permission.MANAGE_BOOKINGS)
  @ApiDismissNonPaymentDocs()
  dismissNonPayment(
    @Param('id') id: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.bookings.dismissNonPaymentReport(id, {
      id: user.id,
      role: user.role,
    });
  }

  // ── Operator cancellation report (conflict #2) - report, never execute ───

  @Post(':id/report-cancellation')
  @RequirePermissions(Permission.EDIT_BOOKING)
  @ApiReportCancellationDocs()
  reportCancellation(
    @Param('id') id: string,
    @Body() dto: ReportCancellationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.bookings.reportCancellation(id, dto, {
      id: user.id,
      role: user.role,
    });
  }

  @Post(':id/dismiss-cancellation-report')
  @RequirePermissions(Permission.MANAGE_BOOKINGS)
  @ApiDismissCancellationReportDocs()
  dismissCancellationReport(
    @Param('id') id: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.bookings.dismissCancellationReport(id, {
      id: user.id,
      role: user.role,
    });
  }

  @Post(':id/extend')
  @Public()
  @ApiExtendDocs()
  extend(@Param('id') id: string, @Body() dto: ExtendBookingDto) {
    return this.bookings.extend(id, dto);
  }

  /**
   * POST /bookings/:id/accept-operator-terms
   *
   * The checkout's required operator-conditions checkbox (Pastel #80 /
   * MCK-20): tick = accept. Public like every checkout action, keyed on the
   * booking uuid; the payment-intent endpoint is the enforcing half - a
   * flagged tour's booking takes no intent without this stamp.
   */
  @Post(':id/accept-operator-terms')
  @Public()
  @ApiAcceptOperatorTermsDocs()
  acceptOperatorTerms(@Param('id') id: string) {
    return this.bookings.acceptOperatorTerms(id);
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

  // ── Traveller account area (/{locale}/traveller) ────────────────────────
  //
  // A separate, stronger login from `/bookings`: the pair lookup proves
  // possession of ONE (forwardable) confirmation email, which is the wrong
  // credential for a person's whole booking + payment history. These routes
  // require a HISTORY-scoped session, minted only by the OTP exchange below.
  // Static routes - MUST stay above the `:id` routes further down.

  /**
   * POST /bookings/traveller/request-code
   *
   * Step 1 of the account login. Sends mail, so it gets the same human-pace
   * throttle as resend/recover-reference, and the same browser-only rule:
   * `skipIf: isTrustedInternalOrigin` would bypass every limit below if this
   * were ever called from SSR.
   */
  // Loose enough that a double-click or a reload-and-retry re-RUNS the
  // handler (an unknown email must answer "no account" CONSISTENTLY - a 1/10s
  // tier turned the second click into a generic 429 the card could not
  // interpret). Actual sends stay bounded by the per-EMAIL caps in the
  // service (1/min, 5/day per inbox); these per-IP tiers only bound
  // enumeration probing, which the founder-accepted `sent:false` response
  // already concedes is possible.
  @Throttle({
    short: { limit: 3, ttl: 10_000 },
    medium: { limit: 6, ttl: 60_000 },
    long: { limit: 15, ttl: 3_600_000 },
  })
  @Post('traveller/request-code')
  @Public()
  @ApiRequestTravellerCodeDocs()
  requestTravellerCode(@Body() dto: RequestTravellerCodeDto) {
    return this.bookings.requestTravellerLoginCode(dto);
  }

  /**
   * POST /bookings/traveller/verify-code
   *
   * Step 2: a credential check, so it carries the lookup throttle (tighter
   * than the global tiers, which are sized for page loads and far too loose
   * for guessing codes). Browser-only for the same reason. The service also
   * caps attempts per code, so the throttle is the outer of two limits.
   */
  @Throttle({
    short: { limit: 2, ttl: 10_000 },
    medium: { limit: 6, ttl: 60_000 },
    long: { limit: 30, ttl: 3_600_000 },
  })
  @Post('traveller/verify-code')
  @Public()
  @ApiVerifyTravellerCodeDocs()
  verifyTravellerCode(@Body() dto: VerifyTravellerCodeDto) {
    return this.bookings.verifyTravellerLoginCode(dto);
  }

  /**
   * GET /bookings/traveller/bookings - the account area's booking list.
   * `@Public` (no Better Auth on the public site); the gate is the
   * HISTORY-scoped X-Traveler-Session, enforced in the service. Read-only
   * and session-authed, so SSR calls are fine here.
   */
  @Get('traveller/bookings')
  @Public()
  @ApiTravellerBookingsDocs()
  travellerBookings(
    @Query() query: TravellerListQueryDto,
    @Headers(TRAVELER_SESSION_HEADER) sessionToken?: string,
  ) {
    return this.bookings.listTravellerBookings(query, sessionToken);
  }

  /**
   * GET /bookings/traveller/contact - checkout prefill for a signed-in
   * traveller. Same HISTORY-scoped session gate as the rest of the account
   * area, enforced in the service.
   */
  @Get('traveller/contact')
  @Public()
  @ApiTravellerContactDocs()
  travellerContact(@Headers(TRAVELER_SESSION_HEADER) sessionToken?: string) {
    return this.bookings.getTravellerContact(sessionToken);
  }

  /** GET /bookings/traveller/summary - the account area's stat row. */
  @Get('traveller/summary')
  @Public()
  @ApiTravellerSummaryDocs()
  travellerSummary(@Headers(TRAVELER_SESSION_HEADER) sessionToken?: string) {
    return this.bookings.getTravellerSummary(sessionToken);
  }

  /** GET /bookings/traveller/payments - the account area's payment history. */
  @Get('traveller/payments')
  @Public()
  @ApiTravellerPaymentsDocs()
  travellerPayments(
    @Query() query: TravellerListQueryDto,
    @Headers(TRAVELER_SESSION_HEADER) sessionToken?: string,
  ) {
    return this.bookings.listTravellerPayments(query, sessionToken);
  }

  /**
   * GET /bookings/traveller/payments/:id - one payment as a printable
   * receipt (review 9a). Same HISTORY-session gate as the list above.
   */
  @Get('traveller/payments/:id')
  @Public()
  @ApiTravellerReceiptDocs()
  travellerReceipt(
    @Param('id') id: string,
    @Headers(TRAVELER_SESSION_HEADER) sessionToken?: string,
  ) {
    return this.bookings.getTravellerReceipt(id, sessionToken);
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
   * POST /bookings/typ/:publicRef/conversion
   *
   * Serves the one-time `booking_complete` push payload, mark-first (master 8.2):
   * the first verified TYP render wins the payload, every later call returns
   * `{ conversion: null }`. A dedicated endpoint - NOT the plain GET above, which
   * the /payment/processing poller also hits - so the poll can never consume the
   * single push. Requires the traveler session (business-sensitive commission
   * value); browser-only, throttled to a human pace per publicRef.
   */
  @Throttle({
    short: { limit: 3, ttl: 10_000 },
    medium: { limit: 5, ttl: 60_000 },
    long: { limit: 20, ttl: 3_600_000 },
  })
  @Post('typ/:publicRef/conversion')
  @Public()
  @ApiClaimConversionDocs()
  claimConversion(
    @Param('publicRef') publicRef: string,
    @Headers(TRAVELER_SESSION_HEADER) sessionToken?: string,
  ) {
    return this.bookings.claimConversionPush(publicRef, sessionToken);
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
   * POST /bookings/typ/:publicRef/cancellation-request/withdraw
   *
   * Undo of the request above while it is still pending (QA report
   * 2026-08-01: a traveller who requested by mistake had no way back).
   * Same session-ownership gate and the same human-pace throttle - it is a
   * mutation reached from the same tokenized surfaces.
   */
  @Throttle({
    short: { limit: 1, ttl: 10_000 },
    medium: { limit: 3, ttl: 60_000 },
    long: { limit: 10, ttl: 3_600_000 },
  })
  @Post('typ/:publicRef/cancellation-request/withdraw')
  @Public()
  @ApiWithdrawCancellationDocs()
  withdrawCancellation(
    @Param('publicRef') publicRef: string,
    @Headers(TRAVELER_SESSION_HEADER) sessionToken?: string,
  ) {
    return this.bookings.withdrawCancellationRequest(publicRef, sessionToken);
  }

  /**
   * GET /bookings/typ/:publicRef/date-change-options - departures the
   * traveller can move to (review 10.4). Session-owned like the cancellation
   * request; read-only, so the global throttle tiers suffice.
   */
  @Get('typ/:publicRef/date-change-options')
  @Public()
  @ApiDateChangeOptionsDocs()
  dateChangeOptions(
    @Param('publicRef') publicRef: string,
    @Headers(TRAVELER_SESSION_HEADER) sessionToken?: string,
  ) {
    return this.bookings.getDateChangeOptions(publicRef, sessionToken);
  }

  /**
   * POST /bookings/typ/:publicRef/date-change - the atomic self-service
   * move. Same human-pace throttle as the cancellation request (it mutates
   * inventory), plus a per-booking cap in the service.
   */
  @Throttle({
    short: { limit: 1, ttl: 10_000 },
    medium: { limit: 3, ttl: 60_000 },
    long: { limit: 10, ttl: 3_600_000 },
  })
  @Post('typ/:publicRef/date-change')
  @Public()
  @ApiChangeBookingDateDocs()
  changeBookingDate(
    @Param('publicRef') publicRef: string,
    @Body() dto: ChangeBookingDateDto,
    @Headers(TRAVELER_SESSION_HEADER) sessionToken?: string,
  ) {
    return this.bookings.changeDate(publicRef, dto.departureId, sessionToken);
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

  // GET /bookings/me/summary and POST /bookings/:id/cancellation-request
  // lived here until 2026-07-28. Both served the dashboard's /account
  // customer surface, which is deleted: they required a Better Auth session,
  // and no traveller can mint one any more (no password is ever set for a
  // Role.USER account). The traveller equivalents are the @Public,
  // HMAC-session routes above - `traveller/summary` and the tokenized
  // `typ/:publicRef/cancellation-request`.

  @Get(':id')
  @RequirePermissions(Permission.VIEW_BOOKINGS)
  @ApiGetBookingDocs()
  get(@Param('id') id: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.bookings.getById(id, { id: user.id, role: user.role });
  }

  // Email timeline (send-log rows, WP-A). Same gate and the same WHOSE-rows
  // scope as GET :id; the rows come from the global send log (MailModule),
  // not from BookingsService.
  @Get(':id/emails')
  @RequirePermissions(Permission.VIEW_BOOKINGS)
  @ApiListBookingEmailsDocs()
  listEmails(
    @Param('id') id: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.emailLog.listForBooking(id, { id: user.id, role: user.role });
  }
}
