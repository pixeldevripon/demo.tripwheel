import { Locale } from '@/common/constants/locales';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddOnUnit, AgeBandType, ScheduleStatus } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsDecimal,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// ── Image DTOs ────────────────────────────────────────────────────────────────

export class TourImageResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() tripId!: string;
  @ApiProperty({ example: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/tour-img' }) url!: string;
  @ApiProperty() isHero!: boolean;
  @ApiPropertyOptional({ example: 0.5 }) focalX!: number;
  @ApiPropertyOptional({ example: 0.5 }) focalY!: number;
  @ApiPropertyOptional() altText!: string | null;
  @ApiProperty() displayOrder!: number;
  @ApiProperty({ example: 1920 }) width!: number;
  @ApiProperty({ example: 1080 }) height!: number;
}

export class AddTourImageDto {
  @ApiProperty({ example: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/tour-img' })
  @IsString()
  @IsUrl()
  url!: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isHero?: boolean;

  @ApiPropertyOptional({ example: 0.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  focalX?: number;

  @ApiPropertyOptional({ example: 0.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  focalY?: number;

  @ApiPropertyOptional({ example: 'Sunset view from the catamaran' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  altText?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiProperty({ example: 1920 })
  @IsInt()
  @Min(1)
  width!: number;

  @ApiProperty({ example: 1080 })
  @IsInt()
  @Min(1)
  height!: number;
}

export class UpdateTourImageDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isHero?: boolean;

  @ApiPropertyOptional({ example: 0.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  focalX?: number;

  @ApiPropertyOptional({ example: 0.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  focalY?: number;

  @ApiPropertyOptional({ example: 'Sunset view from the catamaran' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  altText?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

// ── Age Band DTOs ─────────────────────────────────────────────────────────────

export class TourAgeBandResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() tripId!: string;
  @ApiProperty({ enum: AgeBandType }) bandType!: AgeBandType;
  @ApiProperty() label!: string;
  @ApiPropertyOptional() minAge!: number | null;
  @ApiPropertyOptional() maxAge!: number | null;
  @ApiProperty() price!: string;
  @ApiProperty() minCount!: number;
  @ApiPropertyOptional() maxCount!: number | null;
  @ApiProperty() displayOrder!: number;
}

export class CreateTourAgeBandDto {
  @ApiProperty({ enum: AgeBandType })
  @IsEnum(AgeBandType)
  bandType!: AgeBandType;

  @ApiProperty({ example: 'Adults (13+)' })
  @IsString()
  @MaxLength(60)
  label!: string;

  @ApiPropertyOptional({ example: 13 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minAge?: number;

  @ApiPropertyOptional({ example: 99 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxAge?: number;

  @ApiProperty({ example: '75.00' })
  @IsDecimal({}, { message: 'price must be a valid decimal number' })
  price!: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minCount?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxCount?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class UpdateTourAgeBandDto {
  @ApiPropertyOptional({ example: 'Adults (13+)' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  label?: string;

  @ApiPropertyOptional({ example: 13 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minAge?: number;

  @ApiPropertyOptional({ example: 99 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxAge?: number;

  @ApiPropertyOptional({ example: '75.00' })
  @IsOptional()
  @IsDecimal({}, { message: 'price must be a valid decimal number' })
  price?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minCount?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxCount?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

// ── Add-On DTOs ───────────────────────────────────────────────────────────────

export class TourAddOnResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() tripId!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() description!: string | null;
  @ApiProperty() price!: string;
  @ApiProperty({ enum: AddOnUnit }) unit!: AddOnUnit;
  @ApiProperty() maxQuantity!: number;
  @ApiProperty() displayOrder!: number;
  @ApiProperty() isActive!: boolean;
}

export class CreateTourAddOnDto {
  @ApiProperty({ example: 'Hotel pickup' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'We pick you up from your hotel' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: '15.00' })
  @IsDecimal({}, { message: 'price must be a valid decimal number' })
  price!: string;

  @ApiPropertyOptional({ enum: AddOnUnit, default: AddOnUnit.PER_PERSON })
  @IsOptional()
  @IsEnum(AddOnUnit)
  unit?: AddOnUnit;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxQuantity?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class UpdateTourAddOnDto {
  @ApiPropertyOptional({ example: 'Hotel pickup' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'We pick you up from your hotel' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: '15.00' })
  @IsOptional()
  @IsDecimal({}, { message: 'price must be a valid decimal number' })
  price?: string;

  @ApiPropertyOptional({ enum: AddOnUnit })
  @IsOptional()
  @IsEnum(AddOnUnit)
  unit?: AddOnUnit;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxQuantity?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ── Language DTOs ─────────────────────────────────────────────────────────────

export class TourLanguageResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() tripId!: string;
  @ApiProperty({ example: 'en' }) language!: string;
}

export class AddTourLanguageDto {
  @ApiProperty({ example: 'nl' })
  @IsString()
  @Matches(/^[a-z]{2}$/, { message: 'language must be a valid ISO 639-1 code (2 lowercase letters)' })
  language!: string;
}

// ── Highlight DTOs ────────────────────────────────────────────────────────────

export class TourHighlightTranslationDto {
  @ApiProperty({ example: 'en' }) locale!: string;
  @ApiProperty() text!: string;
  @ApiProperty() isMachineTranslated!: boolean;
}

export class TourHighlightResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() tripId!: string;
  @ApiProperty() displayOrder!: number;
  @ApiPropertyOptional() imageUrl?: string | null;
  @ApiProperty({ type: [TourHighlightTranslationDto] }) translations!: TourHighlightTranslationDto[];
}

export class CreateTourHighlightDto {
  @ApiProperty({ example: 'Watch the sunset from the water with cocktails in hand' })
  @IsString()
  @MinLength(5)
  @MaxLength(100)
  text!: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ example: 'https://example.com/image.jpg' })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;
}

export class UpdateTourHighlightDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ example: 'https://example.com/image.jpg' })
  @IsOptional()
  @IsUrl()
  imageUrl?: string | null;
}

export class UpsertHighlightTranslationDto {
  @ApiProperty({ example: 'Zie de zonsondergang vanaf het water' })
  @IsString()
  @MinLength(5)
  @MaxLength(100)
  text!: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isMachineTranslated?: boolean;
}

// ── Inclusion DTOs ────────────────────────────────────────────────────────────

export class TourInclusionTranslationDto {
  @ApiProperty({ example: 'en' }) locale!: string;
  @ApiProperty() label!: string;
  @ApiProperty() isMachineTranslated!: boolean;
}

export class TourInclusionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() tripId!: string;
  @ApiProperty() icon!: string;
  @ApiProperty() displayOrder!: number;
  @ApiPropertyOptional() imageUrl?: string | null;
  @ApiProperty({ type: [TourInclusionTranslationDto] }) translations!: TourInclusionTranslationDto[];
}

export class CreateTourInclusionDto {
  @ApiProperty({ example: 'Open bar' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  label!: string;

  @ApiPropertyOptional({ example: 'check' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ example: 'https://example.com/image.jpg' })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;
}

export class UpdateTourInclusionDto {
  @ApiPropertyOptional({ example: 'drink' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ example: 'https://example.com/image.jpg' })
  @IsOptional()
  @IsUrl()
  imageUrl?: string | null;
}

export class UpsertInclusionTranslationDto {
  @ApiProperty({ example: 'Open bar' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  label!: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isMachineTranslated?: boolean;
}

// ── Exclusion DTOs ────────────────────────────────────────────────────────────

export class TourExclusionTranslationDto {
  @ApiProperty({ example: 'en' }) locale!: string;
  @ApiProperty() label!: string;
  @ApiProperty() isMachineTranslated!: boolean;
}

export class TourExclusionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() tripId!: string;
  @ApiProperty() icon!: string;
  @ApiProperty() displayOrder!: number;
  @ApiPropertyOptional() imageUrl?: string | null;
  @ApiProperty({ type: [TourExclusionTranslationDto] }) translations!: TourExclusionTranslationDto[];
}

export class CreateTourExclusionDto {
  @ApiProperty({ example: 'Gratuities' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  label!: string;

  @ApiPropertyOptional({ example: 'x' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ example: 'https://example.com/image.jpg' })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;
}

export class UpdateTourExclusionDto {
  @ApiPropertyOptional({ example: 'x' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ example: 'https://example.com/image.jpg' })
  @IsOptional()
  @IsUrl()
  imageUrl?: string | null;
}

export class UpsertExclusionTranslationDto {
  @ApiProperty({ example: 'Gratuities' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  label!: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isMachineTranslated?: boolean;
}

// ── Trip Translation DTOs ─────────────────────────────────────────────────────

export class TripTranslationResponseDto {
  @ApiProperty({ example: 'en' }) locale!: string;
  @ApiPropertyOptional() title!: string | null;
  @ApiPropertyOptional() overview!: string | null;
  @ApiPropertyOptional() description!: string | null;
  @ApiProperty() isMachineTranslated!: boolean;
  @ApiProperty() updatedAt!: Date;
}

export class UpsertTripTranslationDto {
  @ApiPropertyOptional({ example: 'Sunset Catamaran Cruise' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ example: 'Join us for a breathtaking sunset cruise...' })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  overview?: string;

  @ApiPropertyOptional({ example: 'A full detailed description of the tour...' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isMachineTranslated?: boolean;
}

// ── Schedule DTOs ─────────────────────────────────────────────────────────────

export class TourScheduleResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() tripId!: string;
  @ApiProperty({ example: '2026-07-15' }) startDate!: Date;
  @ApiPropertyOptional({ example: '2026-07-16' }) endDate!: Date | null;
  @ApiProperty({ example: '09:00' }) startTime!: string;
  @ApiProperty({ example: 20 }) totalSpots!: number;
  @ApiProperty({ example: 20 }) availableSpots!: number;
  @ApiProperty({ enum: ScheduleStatus }) status!: ScheduleStatus;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class CreateTourScheduleDto {
  @ApiProperty({ example: '2026-07-15' })
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional({ example: '2026-07-16' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ example: '09:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime must be in HH:MM format' })
  startTime!: string;

  @ApiProperty({ example: 20 })
  @IsInt()
  @Min(1)
  totalSpots!: number;
}

export class UpdateTourScheduleDto {
  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @IsInt()
  @Min(1)
  totalSpots?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsInt()
  @Min(0)
  availableSpots?: number;

  @ApiPropertyOptional({ enum: ScheduleStatus })
  @IsOptional()
  @IsEnum(ScheduleStatus)
  status?: ScheduleStatus;
}

// ── Shared message response ───────────────────────────────────────────────────

export class DeleteMessageResponseDto {
  @ApiProperty({ example: 'Deleted successfully' }) message!: string;
}
