import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class OperatorResponseDto {
  @ApiProperty({ example: 'uuid-string' })
  id!: string;

  @ApiProperty({ example: 'user-uuid-string' })
  userId!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2024-06-01T08:00:00.000Z' })
  updatedAt!: Date;
}

export class OperatorCompanyInfoResponseDto {
  @ApiPropertyOptional({ example: 'Travel Co.' })
  companyName?: string;

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

  @ApiProperty({ example: 'sk_test_...' })
  secretKey!: string;

  @ApiProperty({ example: 'whsec_...' })
  webhookSecret!: string;

  @ApiProperty({ example: ['card', 'ideal'] })
  paymentMethods!: string[];

  @ApiProperty({ example: true })
  isActive!: boolean;
}

export class OperatorMollieConfigResponseDto {
  @ApiProperty({ example: 'live_...' })
  apiKey!: string;

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
  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

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
  @ApiProperty({ description: 'User UUID to link as operator' })
  @IsString()
  userId!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class UpdateOperatorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateOperatorCompanyInfoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyCountry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
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
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  facebookUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instagramUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  twitterUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
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
