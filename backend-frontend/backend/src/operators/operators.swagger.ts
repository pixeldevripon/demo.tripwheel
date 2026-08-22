import {
  BadRequestErrorDto,
  ConflictErrorDto,
  ForbiddenErrorDto,
  InternalServerErrorDto,
  NotFoundErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { EmailSendDto } from '@/mail/dto/email-preferences.dto';
import {
  OperatorCompanyInfoResponseDto,
  OperatorMollieConfigResponseDto,
  OperatorPaymentProviderResponseDto,
  OperatorPublicTermsDto,
  OperatorResponseDto,
  OperatorSocialMediaResponseDto,
  OperatorStripeConfigResponseDto,
  PaginatedOperatorsResponseDto,
} from './dto/operator.dto';

const commonErrors = [
  ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input data',
    type: BadRequestErrorDto,
  }),
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

const adminErrors = [
  ...commonErrors,
  ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions (Admin only)',
    type: ForbiddenErrorDto,
  }),
];

export function ApiGetAllOperatorsDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'List all tour operators (Admin only)' }),
    ApiQuery({ name: 'isActive', type: Boolean, required: false }),
    ApiQuery({
      name: 'verificationStatus',
      required: false,
      enum: ['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED'],
      description: 'Filter for the verification queue / pipeline views',
    }),
    ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
    ApiQuery({ name: 'limit', required: false, type: Number, example: 20 }),
    ApiResponse({
      status: 200,
      description: 'Paginated list of tour operators retrieved successfully',
      type: PaginatedOperatorsResponseDto,
    }),
    ...adminErrors,
  );
}

export function ApiGetOperatorPublicTermsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Public operator conditions document (canonical page + reader)',
      description:
        'The canonical per-operator conditions text (Pastel #80 / MCK-20 §3) - ' +
        'one source behind /{locale}/operators/{slug}/conditions, the checkout ' +
        'reading layer and the confirmation email link. Sanitized HTML, ' +
        'locale-resolved with EN fallback. 404 when the operator has no ' +
        'document.',
    }),
    ApiParam({ name: 'slug', description: 'Public operator slug' }),
    ApiQuery({
      name: 'locale',
      required: false,
      description: 'Content locale - falls back to EN',
    }),
    ApiResponse({ status: 200, type: OperatorPublicTermsDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
  );
}

export function ApiGetOperatorByIdDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get operator by ID' }),
    ApiParam({ name: 'id', description: 'Operator UUID' }),
    ApiResponse({
      status: 200,
      description: 'Operator details retrieved successfully',
      type: OperatorResponseDto,
    }),
    ApiResponse({
      status: 404,
      description: 'Operator not found',
      type: NotFoundErrorDto,
    }),
    ...commonErrors,
  );
}

export function ApiCreateOperatorDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create a new operator (Admin only)',
      description:
        'Provisions a TOUR_OPERATOR account and emails a set-password invite link. ' +
        'The operator sets their own password via the link, then logs in to onboard.',
    }),
    ApiResponse({
      status: 201,
      description: 'Operator created and invite email sent',
      type: OperatorResponseDto,
    }),
    ApiResponse({
      status: 409,
      description: 'A user with this email already exists',
      type: ConflictErrorDto,
    }),
    ...adminErrors,
  );
}

export function ApiUpdateOperatorDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update operator status (Admin only)' }),
    ApiParam({ name: 'id', description: 'Operator UUID' }),
    ApiResponse({
      status: 200,
      description: 'Operator updated successfully',
      type: OperatorResponseDto,
    }),
    ...adminErrors,
  );
}

export function ApiDecideVerificationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Approve or reject a PENDING operator (Admin only)',
      description:
        'The only sanctioned writer of verificationStatus. Guarded transition: ' +
        'only PENDING operators can be decided; anything else returns 409 with ' +
        'the current status. VERIFIED fires the OB-2A approval email and stamps ' +
        'verificationDecidedAt; REJECTED stamps the timestamp and sends nothing.',
    }),
    ApiParam({ name: 'id', description: 'Operator UUID' }),
    ApiResponse({
      status: 201,
      description: 'Decision recorded; the operator with its new status',
      type: OperatorResponseDto,
    }),
    ApiResponse({
      status: 404,
      description: 'Operator not found',
      type: NotFoundErrorDto,
    }),
    ApiResponse({
      status: 409,
      description:
        'Operator is not PENDING (already decided, or never accepted)',
      type: ConflictErrorDto,
    }),
    ...adminErrors,
  );
}

export function ApiDeleteOperatorDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Delete operator (Admin only)' }),
    ApiParam({ name: 'id', description: 'Operator UUID' }),
    ApiResponse({
      status: 200,
      description: 'Operator deleted successfully',
    }),
    ...adminErrors,
  );
}

export function ApiOnboardOperatorDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Self-service onboarding for tour operators' }),
    ApiResponse({
      status: 201,
      description: 'Operator profile created successfully',
      type: OperatorResponseDto,
    }),
    ...commonErrors,
  );
}

export function ApiGetOperatorCompanyInfoDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get operator company information' }),
    ApiParam({ name: 'id', description: 'Operator UUID' }),
    ApiResponse({
      status: 200,
      description: 'Company info retrieved successfully',
      type: OperatorCompanyInfoResponseDto,
    }),
    ...commonErrors,
  );
}

export function ApiUpdateOperatorCompanyInfoDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update operator company information' }),
    ApiParam({ name: 'id', description: 'Operator UUID' }),
    ApiResponse({
      status: 200,
      description: 'Company info updated successfully',
      type: OperatorCompanyInfoResponseDto,
    }),
    ...commonErrors,
  );
}

export function ApiGetOperatorSocialMediaDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get operator social media links' }),
    ApiParam({ name: 'id', description: 'Operator UUID' }),
    ApiResponse({
      status: 200,
      description: 'Social media links retrieved successfully',
      type: OperatorSocialMediaResponseDto,
    }),
    ...commonErrors,
  );
}

export function ApiUpdateOperatorSocialMediaDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update operator social media links' }),
    ApiParam({ name: 'id', description: 'Operator UUID' }),
    ApiResponse({
      status: 200,
      description: 'Social media links updated successfully',
      type: OperatorSocialMediaResponseDto,
    }),
    ...commonErrors,
  );
}

export function ApiGetOperatorStripeConfigDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get operator Stripe configuration' }),
    ApiParam({ name: 'id', description: 'Operator UUID' }),
    ApiResponse({
      status: 200,
      description: 'Stripe config retrieved successfully',
      type: OperatorStripeConfigResponseDto,
    }),
    ...commonErrors,
  );
}

export function ApiUpdateOperatorStripeConfigDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update operator Stripe configuration' }),
    ApiParam({ name: 'id', description: 'Operator UUID' }),
    ApiResponse({
      status: 200,
      description: 'Stripe config updated successfully',
      type: OperatorStripeConfigResponseDto,
    }),
    ...commonErrors,
  );
}

export function ApiGetOperatorPaymentProviderDocs() {
  return applyDecorators(
    ApiOperation({ summary: "Get the operator's active payment provider" }),
    ApiParam({ name: 'id', description: 'Operator UUID' }),
    ApiResponse({
      status: 200,
      description: 'Active payment provider retrieved successfully',
      type: OperatorPaymentProviderResponseDto,
    }),
    ...commonErrors,
  );
}

export function ApiUpdateOperatorPaymentProviderDocs() {
  return applyDecorators(
    ApiOperation({
      summary: "Switch the operator's active payment provider",
      description:
        'Rejected with 400 when the target provider has no usable credentials configured.',
    }),
    ApiParam({ name: 'id', description: 'Operator UUID' }),
    ApiResponse({
      status: 200,
      description: 'Active payment provider updated successfully',
      type: OperatorPaymentProviderResponseDto,
    }),
    ...commonErrors,
  );
}

export function ApiGetOperatorMollieConfigDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get operator Mollie configuration' }),
    ApiParam({ name: 'id', description: 'Operator UUID' }),
    ApiResponse({
      status: 200,
      description: 'Mollie config retrieved successfully',
      type: OperatorMollieConfigResponseDto,
    }),
    ...commonErrors,
  );
}

export function ApiUpdateOperatorMollieConfigDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update operator Mollie configuration' }),
    ApiParam({ name: 'id', description: 'Operator UUID' }),
    ApiResponse({
      status: 200,
      description: 'Mollie config updated successfully',
      type: OperatorMollieConfigResponseDto,
    }),
    ...commonErrors,
  );
}

export function ApiListOperatorEmailsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: "Send-log timeline for an operator's emails",
      description:
        'EmailSend rows (sent / failed / suppressed, incl. admin resends) for this operator, newest first. Feeds the dashboard onboarding timeline.',
    }),
    ApiParam({ name: 'id', description: 'Operator UUID' }),
    ApiResponse({
      status: 200,
      description: 'Send-log rows, newest first',
      type: [EmailSendDto],
    }),
    ...commonErrors,
  );
}

export function ApiResendOperatorEmailDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Resend an onboarding email to an operator (Admin only)',
      description:
        'Onboarding set only (OB2…OB8 + OB2A) - anything else is a 400. ' +
        'Writes a new send-log row under `{operatorId}#resend-{n}` and returns ' +
        'it; suppression, send window and volume cap are deliberately not ' +
        're-checked for an explicit admin action.',
    }),
    ApiParam({ name: 'id', description: 'Operator UUID' }),
    ApiParam({
      name: 'templateKey',
      description: 'Resendable EmailTemplateKey',
      enum: [
        'OB2_WELCOME_AGREEMENT',
        'OB2A_APPROVED',
        'OB3_FIRST_TOUR_HOWTO',
        'OB4_BUILD_IT_WITH_YOU',
        'OB5_TOUR_LIVE',
        'OB6_CHECK_IN',
        'OB7_CONNECT_CALENDAR',
        'OB8_PAGE_STRONGER',
      ],
    }),
    ApiResponse({
      status: 201,
      description: 'The new `#resend-{n}` send-log row',
      type: EmailSendDto,
    }),
    ApiResponse({
      status: 404,
      description: 'Operator not found',
      type: NotFoundErrorDto,
    }),
    ...adminErrors,
  );
}
