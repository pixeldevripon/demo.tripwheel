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
    ApiOperation({ summary: 'List all users with optional filters (Admin only)' }),
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
      summary: 'Update user status — approve, suspend, or deactivate (Admin only)',
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
    ApiOperation({ summary: 'Get permissions of a specific user (Admin only)' }),
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
