import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import {
  BadRequestErrorDto,
  ConflictErrorDto,
  ForbiddenErrorDto,
  NotFoundErrorDto,
} from '@/common/dto/error-responses.dto';
import { ReviewResponseDto, ReviewSummaryDto } from './dto/review.dto';

export const ApiCreateReviewDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Create a review (booking-gated, one per booking)',
      description:
        'The caller must own a confirmed/redeemed booking whose experience date has passed. ' +
        'Starts in PENDING moderation.',
    }),
    ApiCreatedResponse({ type: ReviewResponseDto }),
    ApiBadRequestResponse({ type: BadRequestErrorDto }),
    ApiForbiddenResponse({ type: ForbiddenErrorDto }),
    ApiConflictResponse({ type: ConflictErrorDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );

export const ApiListReviewsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'List approved reviews for a tour (public, paginated)',
    }),
    ApiOkResponse({ type: ReviewResponseDto, isArray: true }),
  );

export const ApiReviewSummaryDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Rating summary + star distribution (LD11 cold-start)',
      description:
        "Returns the tour's own rating at ≥3 approved reviews; otherwise the operator's rating " +
        '(only if operator has ≥10 reviews and ≥4.0 avg); otherwise none.',
    }),
    ApiOkResponse({ type: ReviewSummaryDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );

export const ApiMyReviewsDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'List the caller’s own reviews' }),
    ApiOkResponse({ type: ReviewResponseDto, isArray: true }),
  );

export const ApiModerationQueueDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Moderation queue (oldest-first, default PENDING)',
    }),
    ApiOkResponse({ type: ReviewResponseDto, isArray: true }),
  );

export const ApiGetReviewDocs = () =>
  applyDecorators(
    ApiOperation({
      summary:
        'Get a review (approved is public; otherwise owner/operator/admin)',
    }),
    ApiOkResponse({ type: ReviewResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );

export const ApiModerateReviewDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Approve or reject a review (recomputes aggregates)',
    }),
    ApiOkResponse({ type: ReviewResponseDto }),
    ApiBadRequestResponse({ type: BadRequestErrorDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );

export const ApiRespondReviewDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Operator response to a review (tour owner or admin)',
    }),
    ApiOkResponse({ type: ReviewResponseDto }),
    ApiBadRequestResponse({ type: BadRequestErrorDto }),
    ApiForbiddenResponse({ type: ForbiddenErrorDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );

export const ApiHelpfulReviewDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Mark a review helpful (+1, public)' }),
    ApiOkResponse({ description: '{ id, helpfulCount }' }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );

export const ApiDeleteReviewDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Delete a review (author or admin)' }),
    ApiOkResponse({ description: '{ id, deleted: true }' }),
    ApiForbiddenResponse({ type: ForbiddenErrorDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );
