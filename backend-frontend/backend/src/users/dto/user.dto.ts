import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Permission, Role, UserStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class UserResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'Jane Smith' })
  name!: string;

  @ApiProperty({ example: 'jane@example.com' })
  email!: string;

  @ApiProperty({ example: true })
  emailVerified!: boolean;

  @ApiProperty({
    example: 'https://cdn.example.com/avatar.jpg',
    nullable: true,
  })
  image!: string | null;

  @ApiProperty({ enum: Role, example: Role.TOUR_OPERATOR })
  role!: Role;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status!: UserStatus;

  @ApiProperty({ example: '2024-06-01T08:00:00.000Z' })
  updatedAt!: Date;

  @ApiPropertyOptional({ example: 'UTC+06:00' })
  timezone?: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  phone?: string;

  @ApiPropertyOptional({ example: 'New York, USA' })
  location?: string;
}

export class UserPermissionsResponseDto {
  @ApiProperty({ enum: Permission, isArray: true })
  permissions!: Permission[];
}

export class UserSummaryResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'Jane Smith' })
  name!: string;

  @ApiProperty({ example: 'jane@example.com' })
  email!: string;

  @ApiProperty({ enum: Role, example: Role.TOUR_OPERATOR })
  role!: Role;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status!: UserStatus;

  @ApiProperty({ example: '2024-06-01T08:00:00.000Z' })
  updatedAt!: Date;
}

export class PaginatedUsersResponseDto {
  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ type: [UserResponseDto] })
  data!: UserResponseDto[];
}

export class DeleteUserResponseDto {
  @ApiProperty({ example: 'User deleted successfully' })
  message!: string;
}

// ── Query DTOs ────────────────────────────────────────────────────────────────

export class UserQueryDto {
  @ApiPropertyOptional({ enum: Role, description: 'Filter users by role' })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({
    enum: UserStatus,
    description: 'Filter users by status',
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

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

export class UpdateUserProfileDto {
  // MaxLength is defense-in-depth: the name lands in transactional email
  // greetings (escaped there, but unbounded input has no business reaching
  // a template at all).
  @ApiPropertyOptional({ description: 'Display name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Profile image URL' })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ description: 'User timezone' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ description: 'User phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'User location' })
  @IsOptional()
  @IsString()
  location?: string;
}

export class UpdateUserByAdminDto {
  @ApiPropertyOptional({ description: 'Display name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  // NOTE: no `email` field on purpose. Emails change ONLY through the
  // verified Better Auth change-email flow (auth.instance.ts) - a raw admin
  // write would bypass uniqueness/verification and revoke nothing.

  @ApiPropertyOptional({ description: 'Profile image URL' })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ description: 'User timezone' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ description: 'User phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'User location' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus, {
    message: `Status must be one of: ${Object.values(UserStatus).join(', ')}`,
  })
  status?: UserStatus;
}

export class UpdateUserRoleDto {
  @ApiProperty({
    enum: Role,
    description: 'New role to assign. ADMIN can only be set via seed script.',
  })
  @IsEnum(Role, {
    message: `Role must be one of: ${Object.values(Role).join(', ')}`,
  })
  role!: Role;
}

export class UpdateUserStatusDto {
  @ApiProperty({ enum: UserStatus })
  @IsEnum(UserStatus, {
    message: `Status must be one of: ${Object.values(UserStatus).join(', ')}`,
  })
  status!: UserStatus;
}

// ── Set Password ──────────────────────────────────────────────────────────────

export class SetPasswordDto {
  @ApiProperty({
    description: 'New password for OAuth-registered users (min 12 characters)',
    example: 'MySecurePassword123!',
  })
  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters' })
  @MaxLength(32, { message: 'Password cannot exceed 32 characters' })
  newPassword!: string;
}

export class SetPasswordResponseDto {
  @ApiProperty({ example: true })
  status!: boolean;
}

export class RequestPasswordChangeDto {
  @ApiProperty({
    description:
      'The password currently on the account. Verified before anything is sent.',
    example: 'MyCurrentPassword123!',
  })
  @IsString()
  @MinLength(1, { message: 'Enter your current password' })
  currentPassword!: string;

  @ApiProperty({
    description:
      'The password to switch to. Parked (hashed) until the emailed link is confirmed.',
    example: 'MyNewSecurePassword123!',
  })
  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters' })
  @MaxLength(32, { message: 'Password cannot exceed 32 characters' })
  newPassword!: string;
}

export class RequestPasswordChangeResponseDto {
  @ApiProperty({
    example: true,
    description:
      'The confirmation email is on its way. The password has NOT changed yet.',
  })
  sent!: boolean;
}

export class ConfirmPasswordChangeDto {
  @ApiProperty({
    description: 'The single-use token from the confirmation email.',
    example: '9f2c...',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  token!: string;
}

export class ConfirmPasswordChangeResponseDto {
  @ApiProperty({
    example: true,
    description:
      'The password is now live and every session (including this one) was revoked.',
  })
  changed!: boolean;

  @ApiProperty({
    enum: Role,
    example: Role.ADMIN,
    description:
      "The account's role, so the caller can offer the right sign-in door. " +
      'Every session was just revoked, so the client has no session left to ' +
      'read this from; without it the confirmation screen can only guess, and ' +
      'guessing sends an admin to the operator login. Safe to return: the ' +
      'caller has already redeemed a single-use token bound to this user, so ' +
      'it discloses nothing they did not just prove they held.',
  })
  role!: Role;
}
