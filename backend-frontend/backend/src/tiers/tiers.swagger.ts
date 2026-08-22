import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  BadRequestErrorDto,
  ConflictErrorDto,
  ForbiddenErrorDto,
  NotFoundErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';
import {
  SpotlightQueueDto,
  SpotlightRequestResponseDto,
  TierResponseDto,
  TourSpotlightHistoryDto,
} from './dto/tiers.dto';

const authErrors = () =>
  applyDecorators(
    ApiUnauthorizedResponse({ type: UnauthorizedErrorDto }),
    ApiForbiddenResponse({ type: ForbiddenErrorDto }),
    ApiBadRequestResponse({ type: BadRequestErrorDto }),
  );

// ── Spotlight (operator) ──────────────────────────────────────────────────────
export const ApiRequestSpotlightDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Request Destination Spotlight for a tour',
      description:
        'Eligibility-gated (>=10 reviews, rating >=4.5) → REQUESTED.',
    }),
    ApiOkResponse({ type: SpotlightRequestResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    authErrors(),
  );

export const ApiGetTourSpotlightDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get a tour’s current + historical Spotlight requests',
    }),
    ApiOkResponse({ type: TourSpotlightHistoryDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    authErrors(),
  );

// ── Spotlight (admin) ─────────────────────────────────────────────────────────
export const ApiListSpotlightQueueDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Admin Spotlight review queue + active count',
      description:
        'Filter by destinationId / status; activeCount is APPROVED+ACTIVE per destination.',
    }),
    ApiOkResponse({ type: SpotlightQueueDto }),
    authErrors(),
  );

export const ApiApproveSpotlightDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Approve a Spotlight request',
      description:
        'Sets the active window; re-checks eligibility and the max-3-per-destination cap.',
    }),
    ApiOkResponse({ type: SpotlightRequestResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiConflictResponse({ type: ConflictErrorDto }),
    authErrors(),
  );

export const ApiRejectSpotlightDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Reject a Spotlight request (sets rejectionReason)',
    }),
    ApiOkResponse({ type: SpotlightRequestResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiConflictResponse({ type: ConflictErrorDto }),
    authErrors(),
  );

// ── Tier change (operator) ──────────────────────────────────────────────────
export const ApiChangeTierDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Change a tour’s commission tier',
      description:
        'Denormalizes commissionTier + tierRank and sets a 30-day lock; rejected while locked.',
    }),
    ApiOkResponse({ type: TierResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiConflictResponse({ type: ConflictErrorDto }),
    authErrors(),
  );
