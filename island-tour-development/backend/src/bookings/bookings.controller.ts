import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
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
  ApiCancelDocs,
  ApiConfirmDocs,
  ApiExtendDocs,
  ApiGetBookingDocs,
  ApiListBookingsDocs,
  ApiQuoteDocs,
  ApiReserveDocs,
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
