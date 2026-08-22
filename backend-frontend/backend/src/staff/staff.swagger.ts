import {
  BadRequestErrorDto,
  ConflictErrorDto,
  ForbiddenErrorDto,
  InternalServerErrorDto,
  NotFoundErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import {
  PaginatedStaffResponseDto,
  PermissionCatalogResponseDto,
  StaffDesignationResponseDto,
  StaffMemberResponseDto,
  StaffMessageResponseDto,
} from './dto/staff.dto';

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
    status: 403,
    description: 'Forbidden - Insufficient permissions',
    type: ForbiddenErrorDto,
  }),
  ApiResponse({
    status: 500,
    description: 'Internal Server Error',
    type: InternalServerErrorDto,
  }),
];

const notFound = ApiResponse({
  status: 404,
  description: 'Not Found',
  type: NotFoundErrorDto,
});

const conflict = ApiResponse({
  status: 409,
  description: 'Conflict - Duplicate or in-use resource',
  type: ConflictErrorDto,
});

const idParam = ApiParam({ name: 'id', description: 'Staff member id' });
const designationIdParam = ApiParam({
  name: 'id',
  description: 'Designation id',
});

// ── Catalog ───────────────────────────────────────────────────────────────────

export function ApiGetPermissionCatalogDocs() {
  return applyDecorators(
    ApiOperation({
      summary:
        'Grouped, labeled permission catalog for the matrix UI (per-scope ceiling applied)',
    }),
    ApiResponse({ status: 200, type: PermissionCatalogResponseDto }),
    ...commonErrors,
  );
}

// ── Platform staff ────────────────────────────────────────────────────────────

export function ApiListStaffDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'List platform staff members (Admin only)' }),
    ApiResponse({ status: 200, type: PaginatedStaffResponseDto }),
    ...commonErrors,
  );
}

export function ApiInviteStaffDocs() {
  return applyDecorators(
    ApiOperation({
      summary:
        'Invite a platform staff member (Admin only) - provisions the account and emails a set-password link',
    }),
    ApiResponse({ status: 201, type: StaffMemberResponseDto }),
    conflict,
    ...commonErrors,
  );
}

export function ApiGetStaffDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get one platform staff member (Admin only)' }),
    idParam,
    ApiResponse({ status: 200, type: StaffMemberResponseDto }),
    notFound,
    ...commonErrors,
  );
}

export function ApiUpdateStaffDocs() {
  return applyDecorators(
    ApiOperation({
      summary:
        'Update a platform staff member: designation and per-member permission overrides (Admin only)',
    }),
    idParam,
    ApiResponse({ status: 200, type: StaffMemberResponseDto }),
    notFound,
    ...commonErrors,
  );
}

export function ApiUpdateStaffStatusDocs() {
  return applyDecorators(
    ApiOperation({
      summary:
        'Activate or suspend a platform staff member - suspension revokes all sessions immediately (Admin only)',
    }),
    idParam,
    ApiResponse({ status: 200, type: StaffMemberResponseDto }),
    notFound,
    ...commonErrors,
  );
}

export function ApiDeleteStaffDocs() {
  return applyDecorators(
    ApiOperation({
      summary:
        'Remove a platform staff member and their login account (Admin only)',
    }),
    idParam,
    ApiResponse({ status: 200, type: StaffMessageResponseDto }),
    notFound,
    ...commonErrors,
  );
}

export function ApiResendStaffInviteDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Resend the set-password invite email (INVITED members only)',
    }),
    idParam,
    ApiResponse({ status: 200, type: StaffMessageResponseDto }),
    notFound,
    ...commonErrors,
  );
}

// ── Team seats ────────────────────────────────────────────────────────────────

export function ApiListTeamDocs() {
  return applyDecorators(
    ApiOperation({
      summary:
        "List the operator's team seats (owner; admins pass ?operatorId=)",
    }),
    ApiResponse({ status: 200, type: PaginatedStaffResponseDto }),
    ...commonErrors,
  );
}

export function ApiInviteTeamMemberDocs() {
  return applyDecorators(
    ApiOperation({
      summary:
        'Invite a team member seat (owner; admins pass operatorId in the body)',
    }),
    ApiResponse({ status: 201, type: StaffMemberResponseDto }),
    conflict,
    ...commonErrors,
  );
}

export function ApiGetTeamMemberDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get one team seat' }),
    idParam,
    ApiResponse({ status: 200, type: StaffMemberResponseDto }),
    notFound,
    ...commonErrors,
  );
}

export function ApiUpdateTeamMemberDocs() {
  return applyDecorators(
    ApiOperation({
      summary:
        'Update a team seat: seat label, designation and permission overrides (owner/admin). Owner seats are immutable here.',
    }),
    idParam,
    ApiResponse({ status: 200, type: StaffMemberResponseDto }),
    notFound,
    ...commonErrors,
  );
}

export function ApiUpdateTeamMemberStatusDocs() {
  return applyDecorators(
    ApiOperation({
      summary:
        'Activate or suspend a team seat - suspension revokes all sessions immediately (owner/admin)',
    }),
    idParam,
    ApiResponse({ status: 200, type: StaffMemberResponseDto }),
    notFound,
    ...commonErrors,
  );
}

export function ApiDeleteTeamMemberDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Remove a team seat and its login account (owner/admin)',
    }),
    idParam,
    ApiResponse({ status: 200, type: StaffMessageResponseDto }),
    notFound,
    ...commonErrors,
  );
}

export function ApiResendTeamInviteDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Resend the set-password invite email (INVITED seats only)',
    }),
    idParam,
    ApiResponse({ status: 200, type: StaffMessageResponseDto }),
    notFound,
    ...commonErrors,
  );
}

// ── Designations ──────────────────────────────────────────────────────────────

export function ApiListDesignationsDocs(scope: 'platform' | 'team') {
  return applyDecorators(
    ApiOperation({
      summary:
        scope === 'platform'
          ? 'List platform designations (Admin only)'
          : "List the operator's team designations (owner/admin)",
    }),
    ApiResponse({ status: 200, type: [StaffDesignationResponseDto] }),
    ...commonErrors,
  );
}

export function ApiCreateDesignationDocs(scope: 'platform' | 'team') {
  return applyDecorators(
    ApiOperation({
      summary:
        scope === 'platform'
          ? 'Create a platform designation (Admin only)'
          : 'Create a team designation (owner/admin)',
    }),
    ApiResponse({ status: 201, type: StaffDesignationResponseDto }),
    conflict,
    ...commonErrors,
  );
}

export function ApiUpdateDesignationDocs() {
  return applyDecorators(
    ApiOperation({
      summary:
        'Update a designation. System designations cannot be renamed; a permission edit re-computes every holder.',
    }),
    designationIdParam,
    ApiResponse({ status: 200, type: StaffDesignationResponseDto }),
    notFound,
    conflict,
    ...commonErrors,
  );
}

export function ApiDeleteDesignationDocs() {
  return applyDecorators(
    ApiOperation({
      summary:
        'Delete a designation (blocked while assigned to members or for system designations)',
    }),
    designationIdParam,
    ApiResponse({ status: 200, type: StaffMessageResponseDto }),
    notFound,
    conflict,
    ...commonErrors,
  );
}
