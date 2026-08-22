import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { BadRequestErrorDto } from '@/common/dto/error-responses.dto';
import {
  PlatformReviewsConfigResponseDto,
  PublicPlatformReviewsResponseDto,
  RefreshPlatformReviewsResponseDto,
} from './dto/platform-reviews.dto';

export const ApiGetPlatformReviewsConfigDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Platform-reviews configuration (API key masked)',
      description:
        'Trustpilot / Google Reviews integration settings plus cache freshness and the last fetch error.',
    }),
    ApiOkResponse({ type: PlatformReviewsConfigResponseDto }),
  );

export const ApiUpdatePlatformReviewsConfigDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Update the platform-reviews configuration',
      description:
        'Partial update. A masked apiKey echo is ignored; empty string clears the key. Changing ' +
        'provider/key/ID drops the cached payload so the next read refetches.',
    }),
    ApiOkResponse({ type: PlatformReviewsConfigResponseDto }),
    ApiBadRequestResponse({ type: BadRequestErrorDto }),
  );

export const ApiRefreshPlatformReviewsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Fetch reviews from the provider now (test + cache fill)',
      description:
        'Runs the provider fetch immediately and stores the payload. Returns ok=false with the ' +
        'provider error rather than throwing, so the dashboard can surface it inline.',
    }),
    ApiOkResponse({ type: RefreshPlatformReviewsResponseDto }),
    ApiBadRequestResponse({ type: BadRequestErrorDto }),
  );

export const ApiPublicPlatformReviewsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Public third-party reviews payload (marketing site)',
      description:
        'Normalized Trustpilot/Google payload with the social-proof gate applied: `visible` is ' +
        'false when disabled, unconfigured, never fetched, or the platform review count is not ' +
        'above 100. Served from the DB cache (12h lazy refresh) - never blocks on the provider ' +
        'when a cache exists.',
    }),
    ApiOkResponse({ type: PublicPlatformReviewsResponseDto }),
  );
