import {
  InternalServerErrorDto,
  NotFoundErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Locale } from '@prisma/client';
import {
  WishlistMutationResponseDto,
  WishlistTourDto,
} from './dto/wishlist.dto';

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
