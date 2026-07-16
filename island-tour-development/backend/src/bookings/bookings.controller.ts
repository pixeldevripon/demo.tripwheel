import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthenticatedUser } from '@/auth/decorators/authenticated-user.decorator';
import { Public } from '@/auth/decorators/public.decorator';
import type { TypedAuthUser } from '@/auth/auth.types';
import { BookingsService } from './bookings.service';
import {
  CancelBookingDto,
  ConfirmBookingDto,
  ExtendBookingDto,
  ListBookingsQueryDto,
  QuoteBookingDto,
  ReserveBookingDto,
  UpdateBookingDto,
} from './dto/booking.dto';
import {
  ApiCalendarDocs,
  ApiCancelDocs,
  ApiConfirmDocs,
  ApiExtendDocs,
  ApiGetBookingDocs,
  ApiListBookingsDocs,
  ApiQuoteDocs,
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
  update(@Param('id') id: string, @Body() dto: UpdateBookingDto) {
    return this.bookings.update(id, dto);
  }

  @Get('typ/:publicRef')
  @Public()
  @ApiThankYouDocs()
  thankYou(@Param('publicRef') publicRef: string) {
    return this.bookings.getThankYou(publicRef);
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

  @Get()
  @ApiListBookingsDocs()
  list(
    @AuthenticatedUser() user: TypedAuthUser,
    @Query() query: ListBookingsQueryDto,
  ) {
    return this.bookings.list(query, { id: user.id, role: user.role });
  }

  @Get(':id')
  @ApiGetBookingDocs()
  get(@Param('id') id: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.bookings.getById(id, { id: user.id, role: user.role });
  }
}
