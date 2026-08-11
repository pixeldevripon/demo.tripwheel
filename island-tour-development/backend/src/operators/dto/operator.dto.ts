import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OperatorVerificationStatus, PaymentProvider } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * The only two decisions the verification endpoint accepts: a PENDING
 * operator is approved or declined. PENDING/UNVERIFIED are states, not
 * decisions - `@IsIn` rejects them with a 400 before the service runs.
 */
export const VERIFICATION_DECISIONS = [
  OperatorVerificationStatus.VERIFIED,
  OperatorVerificationStatus.REJECTED,
] as const;

export type VerificationDecision = (typeof VERIFICATION_DECISIONS)[number];

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class OperatorUserSummaryDto {
  @ApiProperty({ example: 'user-uuid-string' })
  id!: string;

  @ApiProperty({ example: 'John Smith' })
  name!: string;

  @ApiProperty({ example: 'operator@company.com' })
  email!: string;
}

export class OperatorResponseDto {
  @ApiProperty({ example: 'uuid-string' })
  id!: string;

  @ApiProperty({ example: 'user-uuid-string' })
  userId!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ enum: OperatorVerificationStatus, example: 'UNVERIFIED' })
  verificationStatus!: OperatorVerificationStatus;

  @ApiPropertyOptional({ example: 'support@company.com', nullable: true })
  contactEmail?: string | null;

  @ApiPropertyOptional({ example: '+5999123456', nullable: true })
  contactPhone?: string | null;

  @ApiPropertyOptional({ type: OperatorUserSummaryDto })
  user?: OperatorUserSummaryDto;

  @ApiPropertyOptional({
    example: { companyName: 'Caribbean Adventures Ltd.' },
    nullable: true,
  })
  companyInfo?: { companyName: string | null } | null;

  @ApiPropertyOptional({
    example: '2026-08-11T14:00:00.000Z',
    nullable: true,
    description: 'When an admin approved/rejected verification',
  })
  verificationDecidedAt?: Date | null;

  @ApiPropertyOptional({
    example: '2026-08-14T09:30:00.000Z',
    nullable: true,
    description: 'When the operator’s first tour went live (stamped once)',
  })
  firstTourLiveAt?: Date | null;

  @ApiPropertyOptional({
    example: 2,
    description:
      'Derived count of tours ever submitted for review (list endpoint only)',
  })
  toursSubmitted?: number;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2024-06-01T08:00:00.000Z' })
  updatedAt!: Date;
}

export class OperatorCompanyInfoResponseDto {
  @ApiPropertyOptional({ example: 'Travel Co.' })
  companyName?: string;

  @ApiPropertyOptional({ example: 'hello@travelco.com' })
  companyEmail?: string;

  @ApiPropertyOptional({ example: 'USA' })
  companyCountry?: string;

  @ApiPropertyOptional({ example: 'New York' })
  companyCity?: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  companyPhone?: string;

  @ApiPropertyOptional({ example: 10 })
  plannedTripCount?: number;

  @ApiPropertyOptional({ example: 50000 })
  yearlySalesTarget?: number;
}

export class OperatorSocialMediaResponseDto {
  @ApiPropertyOptional({ example: 'https://facebook.com/travelco' })
  facebookUrl?: string;

  @ApiPropertyOptional({ example: 'https://instagram.com/travelco' })
  instagramUrl?: string;

  @ApiPropertyOptional({ example: 'https://twitter.com/travelco' })
  twitterUrl?: string;

  @ApiPropertyOptional({ example: 'https://linkedin.com/company/travelco' })
  linkedinUrl?: string;
}

export class OperatorStripeConfigResponseDto {
  @ApiProperty({ example: 'pk_test_...' })
  publishableKey!: string;

  @ApiPropertyOptional({ example: '••••••••1234', nullable: true })
  secretKey?: string | null;

  @ApiPropertyOptional({ example: '••••••••5678', nullable: true })
  webhookSecret?: string | null;

  @ApiProperty({ example: ['card', 'ideal'] })
  paymentMethods!: string[];

  @ApiProperty({ example: true })
  isActive!: boolean;
}

export class OperatorPaymentProviderResponseDto {
  @ApiProperty({ enum: PaymentProvider, example: PaymentProvider.STRIPE })
  activeProvider!: PaymentProvider;

  @ApiProperty({ example: '2026-07-25T12:00:00.000Z' })
  updatedAt!: Date;
}

export class OperatorMollieConfigResponseDto {
  @ApiPropertyOptional({ example: '••••••••1234', nullable: true })
  apiKey?: string | null;

  @ApiProperty({ example: ['ideal', 'creditcard'] })
  paymentMethods!: string[];

  @ApiProperty({ example: true })
  isActive!: boolean;
}

export class PaginatedOperatorsResponseDto {
  @ApiProperty({ example: 10 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ type: [OperatorResponseDto] })
  data!: OperatorResponseDto[];
}

// ── Query & Input DTOs ────────────────────────────────────────────────────────

export class OperatorQueryDto {
  @ApiPropertyOptional({
    example: 'island',
    description: 'Search by company name or user name/email',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiPropertyOptional({
    enum: OperatorVerificationStatus,
    description:
      'Filter by verification status (the dashboard queue asks for PENDING)',
  })
  @IsOptional()
  @IsEnum(OperatorVerificationStatus)
  verificationStatus?: OperatorVerificationStatus;

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

export class CreateOperatorDto {
  @ApiProperty({
    example: 'John Smith',
    description: 'Full name of the operator contact',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: 'operator@company.com',
    description:
      'Login email. A set-password invite link is sent to this address.',
  })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

/**
 * `verificationStatus` is deliberately ABSENT here: the blanket
 * `PATCH /operators/:id` write used to let any admin edit flip it silently.
 * The only sanctioned writer is `POST /operators/:id/verification`
 * ({@link DecideVerificationDto}), which guards the transition and stamps
 * `verificationDecidedAt`. The global ValidationPipe (forbidNonWhitelisted)
 * turns any PATCH still carrying the field into a 400.
 */
export class UpdateOperatorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'support@company.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  contactEmail?: string;

  @ApiPropertyOptional({ example: '+5999123456' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  contactPhone?: string;
}

export class DecideVerificationDto {
  @ApiProperty({
    enum: VERIFICATION_DECISIONS,
    example: OperatorVerificationStatus.VERIFIED,
    description:
      'The verification decision for a PENDING operator. VERIFIED fires the OB-2A approval email; REJECTED sends nothing.',
  })
  @IsIn(VERIFICATION_DECISIONS)
  decision!: VerificationDecision;
}

export class UpdateOperatorCompanyInfoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @ApiPropertyOptional({ example: 'hello@travelco.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  companyEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  companyCountry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  companyCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  companyPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  plannedTripCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  yearlySalesTarget?: number;
}

export class OnboardOperatorDto {
  @ApiProperty({ example: 'Travel Co.' })
  @IsString()
  companyName!: string;

  @ApiProperty({ example: 'USA' })
  @IsString()
  companyCountry!: string;

  @ApiProperty({ example: 'New York' })
  @IsString()
  companyCity!: string;

  @ApiProperty({ example: '+1234567890' })
  @IsString()
  companyPhone!: string;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(0)
  plannedTripCount!: number;

  @ApiProperty({ example: 50000 })
  @IsInt()
  @Min(0)
  yearlySalesTarget!: number;
}

export class UpdateOperatorSocialMediaDto {
  @ApiPropertyOptional({ example: 'https://facebook.com/travelco' })
  @IsOptional()
  @IsUrl()
  @MaxLength(255)
  facebookUrl?: string;

  @ApiPropertyOptional({ example: 'https://instagram.com/travelco' })
  @IsOptional()
  @IsUrl()
  @MaxLength(255)
  instagramUrl?: string;

  @ApiPropertyOptional({ example: 'https://x.com/travelco' })
  @IsOptional()
  @IsUrl()
  @MaxLength(255)
  twitterUrl?: string;

  @ApiPropertyOptional({ example: 'https://linkedin.com/company/travelco' })
  @IsOptional()
  @IsUrl()
  @MaxLength(255)
  linkedinUrl?: string;
}

export class UpdateOperatorStripeConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  publishableKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  secretKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  webhookSecret?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsString({ each: true })
  paymentMethods?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateOperatorPaymentProviderDto {
  @ApiProperty({ enum: PaymentProvider, example: PaymentProvider.MOLLIE })
  @IsEnum(PaymentProvider)
  activeProvider!: PaymentProvider;
}

export class UpdateOperatorMollieConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsString({ each: true })
  paymentMethods?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
