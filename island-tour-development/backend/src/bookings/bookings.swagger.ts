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
import { BookingResponseDto, ThankYouResponseDto } from './dto/booking.dto';

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
    ApiOkResponse({ type: BookingResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiConflictResponse({ type: ConflictErrorDto }),
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
    ApiOkResponse({ type: BookingResponseDto, isArray: true }),
  );
