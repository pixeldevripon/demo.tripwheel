import {
  BadRequestErrorDto,
  ForbiddenErrorDto,
  InternalServerErrorDto,
  NotFoundErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Role, UserStatus } from '@prisma/client';
import {
  DeleteUserResponseDto,
  PaginatedUsersResponseDto,
  ConfirmPasswordChangeResponseDto,
  RequestPasswordChangeResponseDto,
  SetPasswordResponseDto,
  UserPermissionsResponseDto,
  UserResponseDto,
  UserSummaryResponseDto,
} from './dto/user.dto';

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

export function ApiGetAllUsersDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'List all users with optional filters (Admin only)',
    }),
    ApiQuery({ name: 'role', enum: Role, required: false }),
    ApiQuery({ name: 'status', enum: UserStatus, required: false }),
    ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
    ApiQuery({ name: 'limit', required: false, type: Number, example: 20 }),
    ApiResponse({
      status: 200,
      description: 'Paginated list of users retrieved successfully',
      type: PaginatedUsersResponseDto,
    }),
    ...adminErrors,
  );
}

export function ApiGetAllOperatorsDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'List all tour operators (Admin only)' }),
    ApiQuery({ name: 'status', enum: UserStatus, required: false }),
    ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
    ApiQuery({ name: 'limit', required: false, type: Number, example: 20 }),
    ApiResponse({
      status: 200,
      description: 'Paginated list of tour operators retrieved successfully',
      type: PaginatedUsersResponseDto,
    }),
    ...adminErrors,
  );
}

export function ApiGetCurrentUserDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get the currently authenticated user profile' }),
    ApiResponse({
      status: 200,
      description: 'Current user profile retrieved successfully',
      type: UserResponseDto,
    }),
    ...commonErrors,
  );
}

export function ApiGetUserByIdDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get user by ID (Admin only)' }),
    ApiParam({ name: 'id', description: 'User UUID' }),
    ApiResponse({
      status: 200,
      description: 'User details retrieved successfully',
      type: UserResponseDto,
    }),
    ApiResponse({
      status: 404,
      description: 'User not found',
      type: NotFoundErrorDto,
    }),
    ...adminErrors,
  );
}

export function ApiUpdateUserProfileDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update the authenticated user own profile' }),
    ApiResponse({
      status: 200,
      description: 'Profile updated successfully',
      type: UserResponseDto,
    }),
    ...commonErrors,
  );
}

export function ApiUpdateUserByAdminDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update user details (Admin only)' }),
    ApiParam({ name: 'id', description: 'User UUID' }),
    ApiResponse({
      status: 200,
      description: 'User updated successfully',
      type: UserResponseDto,
    }),
    ApiResponse({
      status: 404,
      description: 'User not found',
      type: NotFoundErrorDto,
    }),
    ...adminErrors,
  );
}

export function ApiUpdateUserRoleDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update user role (Admin only)' }),
    ApiParam({ name: 'id', description: 'User UUID' }),
    ApiResponse({
      status: 200,
      description: 'User role updated successfully',
      type: UserSummaryResponseDto,
    }),
    ApiResponse({
      status: 404,
      description: 'User not found',
      type: NotFoundErrorDto,
    }),
    ...adminErrors,
  );
}

export function ApiUpdateUserStatusDocs() {
  return applyDecorators(
    ApiOperation({
      summary:
        'Update user status - approve, suspend, or deactivate (Admin only)',
    }),
    ApiParam({ name: 'id', description: 'User UUID' }),
    ApiResponse({
      status: 200,
      description: 'User status updated successfully',
      type: UserSummaryResponseDto,
    }),
    ApiResponse({
      status: 404,
      description: 'User not found',
      type: NotFoundErrorDto,
    }),
    ...adminErrors,
  );
}

export function ApiDeleteUserDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Delete user (Admin only)' }),
    ApiParam({ name: 'id', description: 'User UUID' }),
    ApiResponse({
      status: 200,
      description: 'User deleted successfully',
      type: DeleteUserResponseDto,
    }),
    ApiResponse({
      status: 404,
      description: 'User not found',
      type: NotFoundErrorDto,
    }),
    ...adminErrors,
  );
}

export function ApiGetUserPermissionsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get permissions of a specific user (Admin only)',
    }),
    ApiParam({ name: 'id', description: 'User UUID' }),
    ApiResponse({
      status: 200,
      description: 'User permissions retrieved successfully',
      type: UserPermissionsResponseDto,
    }),
    ApiResponse({
      status: 404,
      description: 'User not found',
      type: NotFoundErrorDto,
    }),
    ...adminErrors,
  );
}

export function ApiSetPasswordDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Set password for OAuth-registered users (no existing password)',
    }),
    ApiResponse({
      status: 201,
      description: 'Password set successfully',
      type: SetPasswordResponseDto,
    }),
    ...commonErrors,
  );
}

export function ApiRequestPasswordChangeDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Request a password change (step 1 of 2 - verify + email)',
      description:
        'Verifies the CURRENT password and, only if it is correct, emails a ' +
        'single-use confirmation link to the account address. The password is ' +
        'NOT changed here - it is parked (already hashed) until the link is ' +
        'confirmed, so knowing the password alone cannot take an account over. ' +
        'A wrong current password returns 401 and sends nothing. Re-requesting ' +
        'replaces the pending change and invalidates the previous link. ' +
        'Rate-limited to 5 successful requests per hour per account.',
    }),
    ApiResponse({
      status: 201,
      description: 'Confirmation email sent; password unchanged so far',
      type: RequestPasswordChangeResponseDto,
    }),
    ApiResponse({
      status: 401,
      description: 'The current password is incorrect',
      type: UnauthorizedErrorDto,
    }),
    ...commonErrors,
  );
}

export function ApiConfirmPasswordChangeDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Confirm a password change (step 2 of 2 - apply)',
      description:
        'Applies the parked password. Authorised by the emailed token alone, ' +
        'because the link is usually opened on a different device with no ' +
        'session; the token is single-use and expires in 1 hour. Every session ' +
        'is revoked on success, including the one that requested the change. ' +
        'Unknown, used and expired tokens all return the same 400 so the ' +
        'endpoint cannot confirm a guessed token.',
    }),
    ApiResponse({
      status: 201,
      description: 'Password updated and all sessions revoked',
      type: ConfirmPasswordChangeResponseDto,
    }),
    ApiResponse({
      status: 400,
      description: 'Token unknown, already used, or expired',
      type: BadRequestErrorDto,
    }),
  );
}

export function ApiGetCurrentUserPermissionsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get permissions of the currently authenticated user',
    }),
    ApiResponse({
      status: 200,
      description: 'Current user permissions retrieved successfully',
      type: UserPermissionsResponseDto,
    }),
    ...commonErrors,
  );
}
