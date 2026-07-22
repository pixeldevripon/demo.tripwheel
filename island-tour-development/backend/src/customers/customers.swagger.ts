import { applyDecorators } from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import {
  ForbiddenErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';
import {
  CustomerEmailResultDto,
  PaginatedCustomersDto,
  SendReviewRequestResultDto,
} from './dto/customer.dto';

export const ApiListCustomersDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'List customers (scoped to the caller)',
      description:
        'ADMIN/STAFF/EDITOR see every operator; a TOUR_OPERATOR sees only its ' +
        'own customers, pinned after every other filter so no query can widen ' +
        'it. Each row carries `reviewsLeft` (history) and `awaitingReview` ' +
        '(completed bookings with no review yet - the actionable number).',
    }),
    ApiOkResponse({ type: PaginatedCustomersDto }),
    ApiUnauthorizedResponse({ type: UnauthorizedErrorDto }),
    ApiForbiddenResponse({ type: ForbiddenErrorDto }),
  );

export const ApiSendReviewRequestDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Send one customer a review request by hand',
      description:
        'The manual twin of the hourly job. Targets their OLDEST completed ' +
        "booking with no review, reusing that booking's existing invitation " +
        "rather than minting a second live link. Ignores the job's `enabled` " +
        'switch on purpose - that governs unattended bulk sending, and a person ' +
        'clicking send has already made the decision it protects. Returns ' +
        '`sent: false` with a reason when there is nothing to ask about.',
    }),
    ApiOkResponse({ type: SendReviewRequestResultDto }),
    ApiUnauthorizedResponse({ type: UnauthorizedErrorDto }),
    ApiForbiddenResponse({ type: ForbiddenErrorDto }),
  );

export const ApiEmailCustomersDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Email selected customers (MANAGE_USERS)',
      description:
        'Deduplicated by ADDRESS, not by row: one person who booked with three ' +
        'operators is three customer rows and must receive one email. ' +
        '`{firstName}` is substituted per recipient. Failures are counted, ' +
        'never thrown - one bad address must not abort the rest of the send.',
    }),
    ApiOkResponse({ type: CustomerEmailResultDto }),
    ApiUnauthorizedResponse({ type: UnauthorizedErrorDto }),
    ApiForbiddenResponse({ type: ForbiddenErrorDto }),
  );
