import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Permission,
  StaffSeatRole,
  StaffStatus,
  UserStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class StaffUserSummaryDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'Jane Smith' })
  name!: string;

  @ApiProperty({ example: 'jane@islandtours.com' })
  email!: string;

  @ApiProperty({ example: null, nullable: true })
  image!: string | null;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status!: UserStatus;
}

export class StaffDesignationSummaryDto {
  @ApiProperty({ example: '0d4c0a52-9f6a-4d67-9df5-1c9a1f0f6b21' })
  id!: string;

  @ApiProperty({ example: 'Operations Manager' })
  name!: string;
}

export class StaffMemberResponseDto {
  @ApiProperty({ example: '9a2b6c3d-1e4f-4a5b-8c7d-2f3e4a5b6c7d' })
  id!: string;

  @ApiProperty({
    example: null,
    nullable: true,
    description: 'NULL = platform (admin-side) staff; set = operator team seat',
  })
  operatorId!: string | null;

  @ApiProperty({ enum: StaffSeatRole, example: StaffSeatRole.STAFF })
  seatRole!: StaffSeatRole;

  @ApiProperty({ enum: StaffStatus, example: StaffStatus.ACTIVE })
  status!: StaffStatus;

  @ApiProperty({ type: StaffUserSummaryDto })
  user!: StaffUserSummaryDto;

  @ApiProperty({ type: StaffDesignationSummaryDto, nullable: true })
  designation!: StaffDesignationSummaryDto | null;

  @ApiProperty({ enum: Permission, isArray: true })
  extraPermissions!: Permission[];

  @ApiProperty({ enum: Permission, isArray: true })
  revokedPermissions!: Permission[];

  @ApiProperty({
    enum: Permission,
    isArray: true,
    description:
      'The computed set actually enforced by the guards: (designation + extra − revoked) ∩ ceiling + base floor',
  })
  effectivePermissions!: Permission[];

  @ApiProperty({
    example: false,
    description:
      'True for the platform ADMIN account, which is listed for visibility but has no staff_members row. Such a row is read-only: edit, suspend, resend-invite and remove are all rejected with 403.',
  })
  isSystemAdmin!: boolean;

  @ApiProperty({ type: StaffUserSummaryDto, nullable: true })
  invitedBy!: Pick<StaffUserSummaryDto, 'id' | 'name'> | null;

  @ApiProperty({ example: '2026-07-19T10:00:00.000Z' })
  invitedAt!: Date;

  @ApiProperty({ example: null, nullable: true })
  activatedAt!: Date | null;

  @ApiProperty({ example: null, nullable: true })
  lastLoginAt!: Date | null;

  @ApiProperty({ example: '2026-07-19T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-07-19T10:00:00.000Z' })
  updatedAt!: Date;
}

export class PaginatedStaffResponseDto {
  @ApiProperty({ example: 12 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ type: [StaffMemberResponseDto] })
  data!: StaffMemberResponseDto[];
}

export class StaffDesignationResponseDto {
  @ApiProperty({ example: '0d4c0a52-9f6a-4d67-9df5-1c9a1f0f6b21' })
  id!: string;

  @ApiProperty({ example: null, nullable: true })
  operatorId!: string | null;

  @ApiProperty({ example: 'Operations Manager' })
  name!: string;

  @ApiProperty({ example: 'Runs day-to-day operations.', nullable: true })
  description!: string | null;

  @ApiProperty({ enum: Permission, isArray: true })
  permissions!: Permission[];

  @ApiProperty({
    example: false,
    description: 'Seeded system designations cannot be renamed or deleted',
  })
  isSystem!: boolean;

  @ApiProperty({ example: 3, description: 'Members currently assigned' })
  memberCount!: number;

  @ApiProperty({ example: '2026-07-19T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-07-19T10:00:00.000Z' })
  updatedAt!: Date;
}

export class PermissionCatalogEntryDto {
  @ApiProperty({ enum: Permission, example: Permission.VIEW_BOOKINGS })
  key!: Permission;

  @ApiProperty({ example: 'View bookings' })
  label!: string;
}

export class PermissionCatalogGroupDto {
  @ApiProperty({ example: 'Bookings & Payments' })
  group!: string;

  @ApiProperty({ type: [PermissionCatalogEntryDto] })
  permissions!: PermissionCatalogEntryDto[];
}

export class PermissionCatalogResponseDto {
  @ApiProperty({
    type: [PermissionCatalogGroupDto],
    description:
      'Grouped grantable permissions, already intersected with the ceiling of the requested scope',
  })
  groups!: PermissionCatalogGroupDto[];

  @ApiProperty({
    enum: Permission,
    isArray: true,
    description: 'The flat grant ceiling for the requested scope',
  })
  ceiling!: Permission[];

  @ApiProperty({
    enum: Permission,
    isArray: true,
    description: 'Always granted to an active member; not revocable',
  })
  base!: Permission[];
}

export class StaffMessageResponseDto {
  @ApiProperty({ example: 'Staff member removed successfully' })
  message!: string;
}

// ── Query DTOs ────────────────────────────────────────────────────────────────

export class StaffQueryDto {
  @ApiPropertyOptional({ description: 'Search by name or email' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: StaffStatus })
  @IsOptional()
  @IsEnum(StaffStatus)
  status?: StaffStatus;

  @ApiPropertyOptional({ description: 'Filter by designation id' })
  @IsOptional()
  @IsUUID()
  designationId?: string;

  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class TeamQueryDto extends StaffQueryDto {
  @ApiPropertyOptional({
    description: 'Operator to act on - ADMIN ONLY (owners are auto-resolved)',
  })
  @IsOptional()
  @IsUUID()
  operatorId?: string;
}

/** Shared `?operatorId=` for admin-scoped team routes without list params. */
export class TeamScopeQueryDto {
  @ApiPropertyOptional({
    description: 'Operator to act on - ADMIN ONLY (owners are auto-resolved)',
  })
  @IsOptional()
  @IsUUID()
  operatorId?: string;
}

export class CatalogQueryDto {
  @ApiPropertyOptional({
    enum: ['platform', 'team'],
    default: 'platform',
    description: 'Which grant ceiling to apply to the catalog',
  })
  @IsOptional()
  @IsIn(['platform', 'team'])
  scope?: 'platform' | 'team' = 'platform';
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

export class InviteStaffDto {
  @ApiProperty({ example: 'jane@islandtours.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Jane Smith' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({ description: 'Designation (permission template) id' })
  @IsOptional()
  @IsUUID()
  designationId?: string;

  @ApiPropertyOptional({
    enum: Permission,
    isArray: true,
    description: 'Per-member grants on top of the designation',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsEnum(Permission, { each: true })
  extraPermissions?: Permission[];
}

export class InviteTeamMemberDto extends InviteStaffDto {
  @ApiPropertyOptional({
    enum: [StaffSeatRole.MANAGER, StaffSeatRole.STAFF],
    default: StaffSeatRole.STAFF,
    description:
      'Seat label shown on the team list. Permissions always come from the designation/overrides; OWNER seats can never be created via this API.',
  })
  @IsOptional()
  @IsIn([StaffSeatRole.MANAGER, StaffSeatRole.STAFF])
  seatRole?: StaffSeatRole;

  @ApiPropertyOptional({
    description: 'Operator to act on - ADMIN ONLY (owners are auto-resolved)',
  })
  @IsOptional()
  @IsUUID()
  operatorId?: string;
}

export class UpdateStaffDto {
  @ApiPropertyOptional({
    description: 'Designation id, or null to clear the designation',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  designationId?: string | null;

  @ApiPropertyOptional({ enum: Permission, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsEnum(Permission, { each: true })
  extraPermissions?: Permission[];

  @ApiPropertyOptional({ enum: Permission, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsEnum(Permission, { each: true })
  revokedPermissions?: Permission[];
}

export class UpdateTeamMemberDto extends UpdateStaffDto {
  @ApiPropertyOptional({ enum: [StaffSeatRole.MANAGER, StaffSeatRole.STAFF] })
  @IsOptional()
  @IsIn([StaffSeatRole.MANAGER, StaffSeatRole.STAFF])
  seatRole?: StaffSeatRole;

  @ApiPropertyOptional({
    description: 'Operator to act on - ADMIN ONLY (owners are auto-resolved)',
  })
  @IsOptional()
  @IsUUID()
  operatorId?: string;
}

export class UpdateStaffStatusDto {
  @ApiProperty({
    enum: [StaffStatus.ACTIVE, StaffStatus.SUSPENDED],
    description:
      'Suspending revokes every session immediately; INVITED cannot be set manually',
  })
  @IsIn([StaffStatus.ACTIVE, StaffStatus.SUSPENDED])
  status!: StaffStatus;
}

export class UpdateTeamMemberStatusDto extends UpdateStaffStatusDto {
  @ApiPropertyOptional({
    description: 'Operator to act on - ADMIN ONLY (owners are auto-resolved)',
  })
  @IsOptional()
  @IsUUID()
  operatorId?: string;
}

export class CreateDesignationDto {
  @ApiProperty({ example: 'Reservations Desk' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name!: string;

  @ApiPropertyOptional({ example: 'Handles booking changes and refunds.' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @ApiProperty({ enum: Permission, isArray: true })
  @IsArray()
  @ArrayMaxSize(100)
  @IsEnum(Permission, { each: true })
  permissions!: Permission[];
}

export class CreateTeamDesignationDto extends CreateDesignationDto {
  @ApiPropertyOptional({
    description: 'Operator to act on - ADMIN ONLY (owners are auto-resolved)',
  })
  @IsOptional()
  @IsUUID()
  operatorId?: string;
}

export class UpdateDesignationDto {
  @ApiPropertyOptional({ example: 'Reservations Desk' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name?: string;

  @ApiPropertyOptional({ example: 'Handles booking changes and refunds.' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @ApiPropertyOptional({ enum: Permission, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsEnum(Permission, { each: true })
  permissions?: Permission[];
}

export class UpdateTeamDesignationDto extends UpdateDesignationDto {
  @ApiPropertyOptional({
    description: 'Operator to act on - ADMIN ONLY (owners are auto-resolved)',
  })
  @IsOptional()
  @IsUUID()
  operatorId?: string;
}
