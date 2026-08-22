import {
  InternalServerErrorDto,
  NotFoundErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Locale } from '@prisma/client';
import {
  EmailWishlistResponseDto,
  WishlistMutationResponseDto,
  WishlistTourDto,
} from './dto/wishlist.dto';
import { BadRequestErrorDto } from '@/common/dto/error-responses.dto';

const authErrors = [
  ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid authentication',
    type: UnauthorizedErrorDto,
  }),
  ApiResponse({
    status: 500,
    description: 'Internal Server Error',
    type: InternalServerErrorDto,
  }),
];

export function ApiGetWishlistDocs() {
  return applyDecorators(
    ApiOperation({ summary: "List the current user's saved tours" }),
    ApiQuery({ name: 'locale', enum: Locale, required: false }),
    ApiResponse({
      status: 200,
      description: 'Saved tours, newest first',
      type: [WishlistTourDto],
    }),
    ...authErrors,
  );
}

export function ApiEmailWishlistDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Email a saved list back to the traveller',
      description:
        'Sends one email containing a link that restores the list on any device. The address is used for this send and not stored - there is no subscriber list to join. Ids that are no longer bookable are left out; if none survive, this is a 400 rather than an empty email.',
    }),
    ApiResponse({
      status: 201,
      description: 'Email queued',
      type: EmailWishlistResponseDto,
    }),
    ApiResponse({
      status: 400,
      description: 'No ids, or none of them can be booked',
      type: BadRequestErrorDto,
    }),
    ApiResponse({
      status: 500,
      description: 'Internal Server Error',
      type: InternalServerErrorDto,
    }),
  );
}

export function ApiResolveWishlistDocs() {
  return applyDecorators(
    ApiOperation({
      summary:
        'PUBLIC: resolve cookie-wishlist tour ids into card-ready tours (order preserved; stale ids dropped)',
    }),
    ApiResponse({
      status: 200,
      description: 'Card-shaped tours for the given ids',
      type: [WishlistTourDto],
    }),
    ApiResponse({
      status: 500,
      description: 'Internal Server Error',
      type: InternalServerErrorDto,
    }),
  );
}

export function ApiGetWishlistIdsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'List saved tour ids (for hydrating heart states)',
    }),
    ApiResponse({ status: 200, description: 'Saved tour ids', type: [String] }),
    ...authErrors,
  );
}

export function ApiAddWishlistDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Save a tour to the wishlist (idempotent)' }),
    ApiParam({ name: 'tourId', description: 'Tour id to save' }),
    ApiResponse({
      status: 201,
      description: 'Tour saved',
      type: WishlistMutationResponseDto,
    }),
    ApiResponse({
      status: 404,
      description: 'Tour not found',
      type: NotFoundErrorDto,
    }),
    ...authErrors,
  );
}

export function ApiRemoveWishlistDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Remove a tour from the wishlist (idempotent)' }),
    ApiParam({ name: 'tourId', description: 'Tour id to remove' }),
    ApiResponse({
      status: 200,
      description: 'Tour removed',
      type: WishlistMutationResponseDto,
    }),
    ...authErrors,
  );
}
