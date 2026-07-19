import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import {
  BadRequestErrorDto,
  ConflictErrorDto,
  NotFoundErrorDto,
} from '@/common/dto/error-responses.dto';
import {
  BookingLookupResponseDto,
  BookingQuoteResponseDto,
  BookingResponseDto,
  UpdateBookingResponseDto,
  ListBookingsResponseDto,
  RecoverReferenceResponseDto,
  RequestCancellationResponseDto,
  ResendConfirmationResponseDto,
  ThankYouResponseDto,
} from './dto/booking.dto';

export const ApiQuoteDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Quote a booking price (server-authoritative, no side effects)',
      description:
        'Computes totals, deposit/balance split, and the commission snapshot for a prospective ' +
        'booking without claiming seats or persisting anything. Priced in the tour default ' +
        'currency (multi-currency FX is a later phase).',
    }),
    ApiOkResponse({ type: BookingQuoteResponseDto }),
    ApiBadRequestResponse({ type: BadRequestErrorDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiUnprocessableEntityResponse({
      description: 'Invalid items/guests, party-size, or age restriction.',
    }),
  );

export const ApiReserveDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Reserve a booking (OCTO step 1)',
      description:
        'Atomic seat claim → ON_HOLD (or CONFIRMED for OPERATOR_FULL). Idempotent by id.',
    }),
    ApiCreatedResponse({ type: BookingResponseDto }),
    ApiBadRequestResponse({ type: BadRequestErrorDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiUnprocessableEntityResponse({
      description: 'Sold out / restriction / cutoff.',
    }),
  );

export const ApiConfirmDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Confirm a booking (OCTO step 2)' }),
    ApiOkResponse({ type: BookingResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiConflictResponse({ type: ConflictErrorDto }),
    ApiUnprocessableEntityResponse({ description: 'Hold expired.' }),
  );

export const ApiCancelDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Cancel a booking (releases seats, computes refund)',
    }),
    ApiOkResponse({ type: BookingResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiConflictResponse({ type: ConflictErrorDto }),
  );

export const ApiExtendDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Extend an on-hold reservation window' }),
    ApiOkResponse({ type: BookingResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiConflictResponse({ type: ConflictErrorDto }),
  );

export const ApiUpdateBookingDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Update booking contact / notes / pickup' }),
    ApiOkResponse({ type: UpdateBookingResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiConflictResponse({ type: ConflictErrorDto }),
  );

export const ApiLookupBookingDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Traveller booking lookup (email + booking reference)',
      description:
        'The `/bookings` login surface: verifies the email + display-reference pair and returns ' +
        'the TYP coordinates (`publicRef` + `destinationSlug`). Enumeration-proof - every failed ' +
        'pair returns the same generic 404. Throttled to a human pace.',
    }),
    ApiOkResponse({ type: BookingLookupResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiBadRequestResponse({ type: BadRequestErrorDto }),
  );

export const ApiRecoverReferenceDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "'Lost your reference?' recovery (email in, notice out)",
      description:
        'Always responds `{ sent: true }` whether or not the email has bookings (enumeration-proof). ' +
        'When it does, one branded notice lists the references of up to the five most recent ' +
        'bookings, sent to the stored contact address. Throttled to a human pace.',
    }),
    ApiOkResponse({ type: RecoverReferenceResponseDto }),
    ApiBadRequestResponse({ type: BadRequestErrorDto }),
  );

export const ApiThankYouDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Thank-you-page payload by publicRef (public TYP token)',
      description:
        'Drives the noindex TYP route. Returns the `booking_complete` conversion object only for a ' +
        'confirmed booking with a valid EUR commission (conversion value = commission_amount EUR).',
    }),
    ApiOkResponse({ type: ThankYouResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );

export const ApiResendConfirmationDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Resend the confirmation email (public TYP token)',
      description:
        'Backs the TYP "Don\'t see it? Check spam, or Resend email" link. Sends only to the ' +
        'contact email stored on the booking - the recipient is never accepted from the caller. ' +
        'Confirmed bookings only. Throttled to 1 per 10s / 3 per min / 10 per hour per IP.',
    }),
    ApiOkResponse({ type: ResendConfirmationResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiConflictResponse({
      type: ConflictErrorDto,
      description:
        'Booking is not CONFIRMED, so there is no confirmation to resend',
    }),
    ApiUnprocessableEntityResponse({
      description: 'Booking has no contact email on file.',
    }),
  );

export const ApiRequestCancellationDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Request cancellation of a booking (public TYP token)',
      description:
        'Backs the tokenized /cancel/{publicRef} form (master 6.4/C1). Never cancels on click: ' +
        'it emails the Island Tours admin, who processes the refund and confirms by email. ' +
        'Confirmed bookings only. Throttled to 1 per 10s / 3 per min / 10 per hour per IP.',
    }),
    ApiOkResponse({ type: RequestCancellationResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiConflictResponse({
      type: ConflictErrorDto,
      description: 'Booking is not CONFIRMED, so there is nothing to cancel',
    }),
  );

export const ApiCalendarDocs = () =>
  applyDecorators(
    ApiOperation({
      summary:
        'Download the booking as an .ics calendar file (public TYP token)',
      description:
        'Backs the confirmation email\'s "Add to calendar" link, so it is opened straight from ' +
        'a mail client with no session. Keyed on the unguessable publicRef and limited to the ' +
        'details the email already carries. Confirmed bookings only. Times are real UTC instants.',
    }),
    ApiOkResponse({
      description: 'RFC 5545 VCALENDAR with a single VEVENT.',
      content: { 'text/calendar': { schema: { type: 'string' } } },
    }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiConflictResponse({
      type: ConflictErrorDto,
      description: 'Booking is not CONFIRMED, so it has no calendar entry',
    }),
    ApiUnprocessableEntityResponse({
      description:
        'Booking has no resolvable start instant (no timezone snapshot).',
    }),
  );

export const ApiGetBookingDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Get a booking by uuid (auth-scoped)' }),
    ApiOkResponse({ type: BookingResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );

export const ApiListBookingsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary:
        'List bookings (admin: all · operator: their tours · user: their own)',
    }),
    ApiOkResponse({ type: ListBookingsResponseDto }),
  );
