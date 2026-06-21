import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { BookingStatus, CancelledBy, CancellationRefund } from '@prisma/client';

// ════════════════════════════════════════════════════════════════════════════
// Response DTOs
// ════════════════════════════════════════════════════════════════════════════

export class BookingUnitItemResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() unitId!: string;
  @ApiProperty({ enum: BookingStatus }) status!: BookingStatus;
  @ApiProperty({ example: '79.99' }) priceRetail!: string;
}

export class BookingResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'IT-2026-0A1B2C' }) displayRef!: string;
  @ApiProperty() publicRef!: string;
  @ApiProperty() tourId!: string;
  @ApiProperty() optionId!: string;
  @ApiPropertyOptional({ nullable: true }) departureId!: string | null;
  @ApiProperty({ enum: BookingStatus }) status!: BookingStatus;
  @ApiProperty({ example: false }) freesale!: boolean;
  @ApiPropertyOptional({ nullable: true }) utcExpiresAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) utcConfirmedAt!: string | null;
  @ApiProperty({ example: '2026-07-04' }) localDate!: string;
  @ApiPropertyOptional({ nullable: true }) startTime!: string | null;
  @ApiProperty({ enum: ['USD', 'EUR'] }) currency!: string;
  @ApiProperty({ example: '239.97' }) totalRetail!: string;
  @ApiProperty({ example: '47.99' }) depositAmount!: string;
  @ApiProperty({ example: '191.98' }) balanceAmount!: string;
  @ApiPropertyOptional({ example: '0.2000', nullable: true })
  commissionRate!: string | null;
  @ApiPropertyOptional({ example: '47.99', nullable: true })
  commissionAmount!: string | null;
  @ApiProperty({ enum: ['OPERATOR_LINK', 'ON_ARRIVAL', 'PAID_IN_FULL', 'OPERATOR_FULL'] })
  paymentModel!: string;
  @ApiPropertyOptional({ nullable: true }) cancellationRefund!: CancellationRefund | null;
  @ApiProperty({ type: [BookingUnitItemResponseDto] })
  unitItems!: BookingUnitItemResponseDto[];
}

// ════════════════════════════════════════════════════════════════════════════
// Shared sub-DTOs
// ════════════════════════════════════════════════════════════════════════════

export class ReserveItemDto {
  @ApiProperty({ example: 'unit-uuid' })
  @IsString()
  unitId!: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class ReserveAddOnDto {
  @ApiProperty({ example: 'addon-uuid' })
  @IsString()
  addOnId!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class ContactDto {
  @ApiProperty({ example: 'Ada' })
  @IsString()
  @MinLength(1)
  firstName!: string;

  @ApiProperty({ example: 'Byron' })
  @IsString()
  @MinLength(1)
  lastName!: string;

  @ApiProperty({ example: 'ada@example.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '+12125550100' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: '1011' })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({ example: 'CW' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: ['en'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  locales?: string[];
}

// ════════════════════════════════════════════════════════════════════════════
// Request DTOs
// ════════════════════════════════════════════════════════════════════════════

export class ReserveBookingDto {
  @ApiPropertyOptional({
    example: 'f8c3de3d-1fea-4d7c-a8b0-29f63c4c3454',
    description: 'Client-supplied id — idempotency key. Generated if omitted.',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ example: 'tour-uuid' })
  @IsString()
  tourId!: string;

  @ApiProperty({ example: 'opt-uuid' })
  @IsString()
  optionId!: string;

  @ApiProperty({ example: 'departure-uuid' })
  @IsString()
  departureId!: string;

  @ApiProperty({ type: [ReserveItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReserveItemDto)
  items!: ReserveItemDto[];

  @ApiPropertyOptional({ type: [ReserveAddOnDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReserveAddOnDto)
  addOns?: ReserveAddOnDto[];

  @ApiPropertyOptional({ example: 30, description: 'Hold window (default 30, max 60).' })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(60)
  expirationMinutes?: number;

  @ApiPropertyOptional({ example: 'Honeymoon trip' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  pickupRequested?: boolean;

  @ApiPropertyOptional({ example: 'pickup-uuid' })
  @IsOptional()
  @IsString()
  pickupLocationId?: string;
}

export class ConfirmBookingDto {
  @ApiProperty({ type: ContactDto })
  @ValidateNested()
  @Type(() => ContactDto)
  contact!: ContactDto;

  @ApiPropertyOptional({ example: 'IT-RES-0042' })
  @IsOptional()
  @IsString()
  resellerReference?: string;

  @ApiPropertyOptional({ example: 'Please seat us together' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CancelBookingDto {
  @ApiPropertyOptional({ example: 'Customer requested' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Override the cancellation-window refund policy (admin/operator).',
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class ExtendBookingDto {
  @ApiPropertyOptional({ example: 30, description: 'New hold window (default 30, max 60).' })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(60)
  expirationMinutes?: number;
}

export class UpdateBookingDto {
  @ApiPropertyOptional({ type: ContactDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ContactDto)
  contact?: ContactDto;

  @ApiPropertyOptional({ example: 'Updated note' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  pickupRequested?: boolean;

  @ApiPropertyOptional({ example: 'pickup-uuid' })
  @IsOptional()
  @IsString()
  pickupLocationId?: string;
}

// ════════════════════════════════════════════════════════════════════════════
// Query DTOs
// ════════════════════════════════════════════════════════════════════════════

export class ListBookingsQueryDto {
  @ApiPropertyOptional({ example: 'tour-uuid' })
  @IsOptional()
  @IsString()
  tourId?: string;

  @ApiPropertyOptional({ enum: BookingStatus })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-07-31' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

// Re-export for service typing convenience.
export type { CancelledBy };
