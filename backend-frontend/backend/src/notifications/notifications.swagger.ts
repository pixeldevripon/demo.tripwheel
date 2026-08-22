import { applyDecorators } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  ForbiddenErrorDto,
  NotFoundErrorDto,
} from '@/common/dto/error-responses.dto';
import {
  NotificationDeliveryResponseDto,
  NotificationSubscriptionResponseDto,
  NotificationSubscriptionWithSecretDto,
} from './dto/notification.dto';

export const ApiNotificationsTag = () => ApiTags('OCTO Notifications');

export const ApiCreateSubscriptionDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Create a notification subscription (OCTO §5.4)',
      description:
        'Subscribe a webhook URL to change events. The signing `secret` is returned ' +
        'ONCE in this response (stored encrypted, never echoed again). Operators are ' +
        'scoped to their own tours; admins create platform-level subscriptions.',
    }),
    ApiCreatedResponse({ type: NotificationSubscriptionWithSecretDto }),
    ApiForbiddenResponse({ type: ForbiddenErrorDto }),
  );

export const ApiListSubscriptionsDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'List notification subscriptions (owner-scoped)' }),
    ApiOkResponse({ type: NotificationSubscriptionResponseDto, isArray: true }),
  );

export const ApiGetSubscriptionDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Get a notification subscription' }),
    ApiOkResponse({ type: NotificationSubscriptionResponseDto }),
    ApiForbiddenResponse({ type: ForbiddenErrorDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );

export const ApiUpdateSubscriptionDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Update a notification subscription' }),
    ApiOkResponse({ type: NotificationSubscriptionResponseDto }),
    ApiForbiddenResponse({ type: ForbiddenErrorDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );

export const ApiDeleteSubscriptionDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Delete a notification subscription' }),
    ApiOkResponse({ description: 'Subscription deleted.' }),
    ApiForbiddenResponse({ type: ForbiddenErrorDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );

export const ApiListDeliveriesDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'List delivery attempts for a subscription (paginated)',
    }),
    ApiOkResponse({ type: NotificationDeliveryResponseDto, isArray: true }),
    ApiForbiddenResponse({ type: ForbiddenErrorDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );
