import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IsLocalDate } from '@/common/validators/is-local-date.validator';
import { BookingStatus, CancelledBy, CancellationRefund } from '@prisma/client';

// ════════════════════════════════════════════════════════════════════════════
// Response DTOs
// ════════════════════════════════════════════════════════════════════════════

export class BookingUnitItemResponseDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Null for UNIT-priced tours (no age bands).',
  })
  ageBandId!: string | null;
  @ApiProperty({ enum: BookingStatus }) status!: BookingStatus;
  @ApiProperty({ example: '79.99' }) priceRetail!: string;
}

/** Conversion payload for the browser Pixel (master booking_complete contract). */
export class BookingConversionDto {
  @ApiProperty({ example: 'Purchase' }) event!: string;
  @ApiProperty({
    example: 'b1a2…',
    description: 'Dedupe id shared with the server CAPI event.',
  })
  eventId!: string;
  @ApiProperty({
    example: 'EUR',
    description: 'Conversion value is always EUR (rule #22).',
  })
  currency!: string;
  @ApiProperty({
    example: '57.74',
    description: 'Conversion value = commission_amount in EUR.',
  })
  value!: string;
  @ApiProperty() contentId!: string;
  @ApiPropertyOptional({ nullable: true }) contentName!: string | null;
}

/** Thank-you-page payload (TYP route - noindex, no locale prefix). */
export class ThankYouResponseDto {
  @ApiProperty() publicRef!: string;
  @ApiProperty({ example: 'IT-2026-0A1B2C' }) displayRef!: string;
  @ApiProperty({ enum: BookingStatus }) status!: BookingStatus;
  @ApiProperty() tourId!: string;
  @ApiProperty({ example: 'Sunset Catamaran Cruise' }) tourName!: string;
  @ApiPropertyOptional({ nullable: true, example: 'curacao' }) island!:
    | string
    | null;
  // The tour experience time is destination-LOCAL wall-clock. Render it from
  // localDate + startTime/endTime against timeZone. startsAtUtc/endsAtUtc are the
  // only real UTC instants here - use them for ICS/reminders/integrations, never
  // for display. (The old fake-`Z` tourStartDateTime/tourEndDateTime are gone.)
  @ApiProperty({ example: '2026-07-01' }) localDate!: string;
  @ApiPropertyOptional({ nullable: true, example: '09:00' }) startTime!:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true, example: '13:00' }) endTime!:
    | string
    | null;
  @ApiPropertyOptional({
    nullable: true,
    description:
      'IANA zone localDate/startTime/endTime are expressed in. Render against this; do not parse the local fields as UTC.',
    example: 'America/Curacao',
  })
  timeZone!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Real UTC instant of the local start (integrations/ICS only).',
    example: '2026-07-01T13:00:00.000Z',
  })
  startsAtUtc!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Real UTC instant of the local end (integrations/ICS only).',
    example: '2026-07-01T17:00:00.000Z',
  })
  endsAtUtc!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    example: 'Marriott Beach Resort — main lobby',
  })
  pickupAddress!: string | null;
  @ApiProperty({ example: 2 }) partySize!: number;
  @ApiProperty({ example: 'EUR' }) currency!: string;
  @ApiProperty({ example: '209.97' }) totalRetail!: string;
  @ApiPropertyOptional({ nullable: true, example: 'ada@x.io' }) contactEmail!:
    | string
    | null;
  @ApiPropertyOptional({
    type: BookingConversionDto,
    nullable: true,
    description:
      'Present only for a confirmed booking with a valid EUR commission; null otherwise.',
  })
  conversion!: BookingConversionDto | null;
}

export class BookingResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'IT-2026-0A1B2C' }) displayRef!: string;
  @ApiProperty() publicRef!: string;
  @ApiProperty() tourId!: string;
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
  @ApiProperty({
    enum: ['OPERATOR_LINK', 'ON_ARRIVAL', 'PAID_IN_FULL', 'OPERATOR_FULL'],
  })
  paymentModel!: string;
  @ApiPropertyOptional({ nullable: true })
  cancellationRefund!: CancellationRefund | null;
  @ApiProperty({ type: [BookingUnitItemResponseDto] })
  unitItems!: BookingUnitItemResponseDto[];
}

// ════════════════════════════════════════════════════════════════════════════
// Shared sub-DTOs
// ════════════════════════════════════════════════════════════════════════════

export class ReserveItemDto {
  @ApiProperty({ example: 'age-band-uuid' })
  @IsString()
  ageBandId!: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({
    example: 8,
    description:
      'Traveler age (master child ages); enforced against the tour minimum age.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  travelerAge?: number;
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
    description: 'Client-supplied id - idempotency key. Generated if omitted.',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ example: 'tour-uuid' })
  @IsString()
  tourId!: string;

  @ApiProperty({ example: 'departure-uuid' })
  @IsString()
  departureId!: string;

  @ApiPropertyOptional({
    type: [ReserveItemDto],
    description:
      'PER_PERSON tours: one line per age band (required). Omit for UNIT tours - send `guests` instead.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReserveItemDto)
  items?: ReserveItemDto[];

  @ApiPropertyOptional({
    example: 6,
    description:
      'UNIT (whole-unit / charter) tours: total guest headcount (required for UNIT, rejected for PER_PERSON). Drives the charter surcharge and capacity.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  guests?: number;

  @ApiPropertyOptional({
    example: [34, 30, 8],
    description:
      'UNIT tours: optional per-guest ages (enforced against the tour minimum age).',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  travelerAges?: number[];

  @ApiPropertyOptional({ type: [ReserveAddOnDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReserveAddOnDto)
  addOns?: ReserveAddOnDto[];

  @ApiPropertyOptional({
    example: 30,
    description: 'Hold window (default 30, max 60).',
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(60)
  expirationMinutes?: number;

  @ApiPropertyOptional({ example: 'Honeymoon trip', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  pickupRequested?: boolean;

  @ApiPropertyOptional({ example: 'pickup-uuid' })
  @IsOptional()
  @IsString()
  pickupLocationId?: string;

  @ApiPropertyOptional({
    example: false,
    description:
      'Figma checkout marketing opt-in ("Send me the good stuff...").',
  })
  @IsOptional()
  @IsBoolean()
  newsletterOptIn?: boolean;

  @ApiPropertyOptional({
    example: 'SUMMER10',
    description: 'Promo code entered at checkout.',
  })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({
    example: '10.00',
    description:
      'Discount amount applied at checkout (currency = booking currency).',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;
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

  @ApiPropertyOptional({ example: 'Please seat us together', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CancelBookingDto {
  @ApiPropertyOptional({ example: 'Customer requested' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    example: false,
    description:
      'Override the cancellation-window refund policy (admin/operator).',
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @ApiPropertyOptional({
    example: '2026-06-28T14:03:00.000Z',
    description:
      'UTC instant the traveler requested cancellation. Refund eligibility is judged at this instant, not the (possibly later) admin action time. Defaults to any prior request stamp, else now.',
  })
  @IsOptional()
  @IsDateString()
  requestedAt?: string;
}

export class ExtendBookingDto {
  @ApiPropertyOptional({
    example: 30,
    description: 'New hold window (default 30, max 60).',
  })
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

  @ApiPropertyOptional({ example: 'Updated note', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
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
  @IsLocalDate()
  from?: string;

  @ApiPropertyOptional({ example: '2026-07-31' })
  @IsOptional()
  @IsLocalDate()
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
