import { Locale } from '@/common/constants/locales';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddOnUnit, ExclusionType } from '@prisma/client';
import {
  IsBoolean,
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
  @ApiProperty() tourId!: string;
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

// ── Add-On DTOs ───────────────────────────────────────────────────────────────

export class TourAddOnResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() tourId!: string;
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

// ── Age Band DTOs ───────────────────────────────────────────────────────────────

export class TourAgeBandResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() tourId!: string;
  @ApiProperty({ example: 'Adult' }) label!: string;
  @ApiPropertyOptional({ example: 13 }) minAge!: number | null;
  @ApiPropertyOptional({ example: null }) maxAge!: number | null;
  @ApiProperty({ example: '79.00' }) price!: string;
  @ApiPropertyOptional({ example: '99.00' }) priceOriginal!: string | null;
  @ApiPropertyOptional({ example: '60.00' }) priceNet!: string | null;
  @ApiProperty() isDefault!: boolean;
  @ApiProperty() displayOrder!: number;
}

export class CreateTourAgeBandDto {
  @ApiProperty({ example: 'Adult' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  label!: string;

  @ApiPropertyOptional({ example: 13, description: 'Inclusive lower age bound (null = no lower bound)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  minAge?: number;

  @ApiPropertyOptional({ example: null, description: 'Inclusive upper age bound (null = no upper bound)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  maxAge?: number;

  @ApiProperty({ example: '79.00', description: 'Retail price per traveler' })
  @IsDecimal({}, { message: 'price must be a valid decimal number' })
  price!: string;

  @ApiPropertyOptional({ example: '99.00', description: 'Optional pre-discount/strikethrough price' })
  @IsOptional()
  @IsDecimal({}, { message: 'priceOriginal must be a valid decimal number' })
  priceOriginal?: string;

  @ApiPropertyOptional({ example: '60.00', description: 'Optional operator net price' })
  @IsOptional()
  @IsDecimal({}, { message: 'priceNet must be a valid decimal number' })
  priceNet?: string;

  @ApiPropertyOptional({ example: true, description: 'Marks the band the UI/booking defaults to (e.g. Adult)' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class UpdateTourAgeBandDto {
  @ApiPropertyOptional({ example: 'Adult' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  label?: string;

  @ApiPropertyOptional({ example: 13, description: 'Inclusive lower age bound (null = no lower bound)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  minAge?: number;

  @ApiPropertyOptional({ example: null, description: 'Inclusive upper age bound (null = no upper bound)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  maxAge?: number;

  @ApiPropertyOptional({ example: '79.00' })
  @IsOptional()
  @IsDecimal({}, { message: 'price must be a valid decimal number' })
  price?: string;

  @ApiPropertyOptional({ example: '99.00' })
  @IsOptional()
  @IsDecimal({}, { message: 'priceOriginal must be a valid decimal number' })
  priceOriginal?: string;

  @ApiPropertyOptional({ example: '60.00' })
  @IsOptional()
  @IsDecimal({}, { message: 'priceNet must be a valid decimal number' })
  priceNet?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

// ── Language DTOs ─────────────────────────────────────────────────────────────

export class TourLanguageResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() tourId!: string;
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
  @ApiProperty() tourId!: string;
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
  @ApiProperty() tourId!: string;
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
  @ApiProperty() tourId!: string;
  @ApiProperty() icon!: string;
  @ApiPropertyOptional({ enum: ExclusionType, description: 'LD18 - paid_advance | paid_onsite | unavailable | not_permitted' })
  type?: ExclusionType | null;
  @ApiPropertyOptional({ example: '$15 per person' }) priceText?: string | null;
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

  @ApiPropertyOptional({ enum: ExclusionType, description: 'LD18 - how the excluded item is handled' })
  @IsOptional()
  @IsEnum(ExclusionType)
  type?: ExclusionType;

  @ApiPropertyOptional({ example: '$15 per person', description: 'Shown when type is PAID_*' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  priceText?: string;

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

  @ApiPropertyOptional({ enum: ExclusionType, description: 'LD18 - how the excluded item is handled' })
  @IsOptional()
  @IsEnum(ExclusionType)
  type?: ExclusionType;

  @ApiPropertyOptional({ example: '$15 per person', description: 'Shown when type is PAID_*' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  priceText?: string | null;

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

// ── Tour Translation DTOs ─────────────────────────────────────────────────────

export class TourTranslationResponseDto {
  @ApiProperty({ example: 'en' }) locale!: string;
  @ApiPropertyOptional() title!: string | null;
  @ApiPropertyOptional() overview!: string | null;
  @ApiPropertyOptional() description!: string | null;
  // Marketing / info content (master E.3, LD19/LD22/LD23)
  @ApiPropertyOptional() shortDescription!: string | null;
  @ApiPropertyOptional() whatToBring!: string | null;
  @ApiPropertyOptional() knowBeforeYouGo!: string | null;
  @ApiPropertyOptional() notSuitableFor!: string | null;
  @ApiPropertyOptional() localTip!: string | null;
  @ApiPropertyOptional() meetingPointText!: string | null;
  @ApiProperty() isMachineTranslated!: boolean;
  @ApiProperty() updatedAt!: Date;
}

export class UpsertTourTranslationDto {
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

  @ApiPropertyOptional({ example: 'Sunset sailing with open bar and snorkelling.', description: 'One-line teaser for cards (LD19)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  shortDescription?: string;

  @ApiPropertyOptional({ example: 'Swimwear, towel, sunscreen, a light jacket.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  whatToBring?: string;

  @ApiPropertyOptional({ example: 'Bring a valid photo ID. Tour runs rain or shine.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  knowBeforeYouGo?: string;

  @ApiPropertyOptional({ example: 'Travellers with back problems or who are pregnant.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notSuitableFor?: string;

  @ApiPropertyOptional({ example: 'Ask the crew about the hidden cove on the west side.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  localTip?: string;

  @ApiPropertyOptional({ example: 'Meet at the main dock, Pier 3, 15 minutes before departure.', description: 'Localized meeting-point text (geo lives on the Tour)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  meetingPointText?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isMachineTranslated?: boolean;
}

// ── Shared message response ───────────────────────────────────────────────────

export class DeleteMessageResponseDto {
  @ApiProperty({ example: 'Deleted successfully' }) message!: string;
}
