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
import {
  OperatorCompanyInfoResponseDto,
  OperatorMollieConfigResponseDto,
  OperatorPaymentProviderResponseDto,
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
