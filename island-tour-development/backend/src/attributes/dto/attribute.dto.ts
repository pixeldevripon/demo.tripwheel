import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttributeDataType, FilterDisplayType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class AttributeDefinitionResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) id!: string;
  @ApiProperty({ example: 'boat_type' }) key!: string;
  @ApiProperty({ example: 'Boat Type' }) displayName!: string;
  @ApiProperty({ enum: AttributeDataType, example: AttributeDataType.ENUM }) dataType!: AttributeDataType;
  @ApiPropertyOptional({ example: ['catamaran', 'yacht', 'speedboat'], nullable: true })
  allowedValues!: unknown;
  @ApiProperty({ type: [String], example: ['boat-tours'], description: 'Category slugs; [] = global' })
  appliesToCategories!: string[];
  @ApiProperty({ example: true }) isFilterable!: boolean;
  @ApiProperty({ example: false }) isSortable!: boolean;
  @ApiPropertyOptional({ enum: FilterDisplayType, nullable: true }) filterDisplayType!: FilterDisplayType | null;
  @ApiProperty({ example: 0 }) sortOrder!: number;
  @ApiProperty({ example: true }) isActive!: boolean;
}

export class TourAttributeResponseDto {
  @ApiProperty({ example: 'boat_type' }) key!: string;
  @ApiProperty({ example: 'catamaran', description: 'Scalar string, or JSON array string for ENUM_MULTI' })
  value!: string;
  @ApiPropertyOptional({ example: 'Boat Type' }) displayName!: string | null;
  @ApiPropertyOptional({ enum: AttributeDataType }) dataType!: AttributeDataType | null;
}

export class DeleteMessageResponseDto {
  @ApiProperty({ example: 'Deleted successfully' }) message!: string;
}

// ── Filters endpoint ───────────────────────────────────────────────────────────

export class FilterValueCountDto {
  @ApiProperty({ example: 'catamaran' }) value!: string;
  @ApiProperty({ example: 12 }) count!: number;
}

export class FilterItemDto {
  @ApiProperty({ example: 'boat_type' }) key!: string;
  @ApiProperty({ example: 'Boat Type' }) displayName!: string;
  @ApiProperty({ enum: AttributeDataType }) dataType!: AttributeDataType;
  @ApiPropertyOptional({ enum: FilterDisplayType, nullable: true }) filterDisplayType!: FilterDisplayType | null;
  @ApiProperty({ example: false }) isSortable!: boolean;
  @ApiProperty({ example: 1 }) sortOrder!: number;
  @ApiProperty({ type: [FilterValueCountDto], description: 'Present values + counts (ENUM/ENUM_MULTI/BOOLEAN); [] for numeric/text' })
  values!: FilterValueCountDto[];
}

export class RangeDto {
  @ApiProperty({ example: 25 }) min!: number;
  @ApiProperty({ example: 200 }) max!: number;
}

export class FiltersResponseDto {
  @ApiProperty({ example: 'curacao' }) destination!: string;
  @ApiProperty({ example: 'boat-tours' }) category!: string;
  @ApiProperty({ example: 14 }) total!: number;
  @ApiPropertyOptional({ type: RangeDto, nullable: true }) priceRange!: RangeDto | null;
  @ApiPropertyOptional({ type: RangeDto, nullable: true }) durationRange!: RangeDto | null;
  @ApiProperty({ type: [FilterItemDto] }) filters!: FilterItemDto[];
}

// ── Query DTOs ────────────────────────────────────────────────────────────────

export class AttributeDefinitionQueryDto {
  @ApiPropertyOptional({ description: 'Filter by category slug (returns that category-specific set + global)' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Only globals (no category-specific attributes)' })
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  globalOnly?: boolean;

  @ApiPropertyOptional({ description: 'Only filterable attributes' })
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  filterableOnly?: boolean;
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

export class CreateAttributeDefinitionDto {
  @ApiProperty({ example: 'boat_type' })
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*$/, { message: 'key must be snake_case (lowercase letters, digits, underscores)' })
  key!: string;

  @ApiProperty({ example: 'Boat Type' })
  @IsString()
  @MinLength(2)
  displayName!: string;

  @ApiProperty({ enum: AttributeDataType, example: AttributeDataType.ENUM })
  @IsEnum(AttributeDataType)
  dataType!: AttributeDataType;

  @ApiPropertyOptional({ type: [String], example: ['catamaran', 'yacht'], description: 'Required for ENUM / ENUM_MULTI' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedValues?: string[];

  @ApiPropertyOptional({ type: [String], example: ['boat-tours'], description: 'Category slugs; omit/[] = global' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  appliesToCategories?: string[];

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional() @IsBoolean() isFilterable?: boolean;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional() @IsBoolean() isSortable?: boolean;

  @ApiPropertyOptional({ enum: FilterDisplayType })
  @IsOptional() @IsEnum(FilterDisplayType) filterDisplayType?: FilterDisplayType;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class UpdateAttributeDefinitionDto {
  @ApiPropertyOptional({ example: 'Boat Type' })
  @IsOptional() @IsString() @MinLength(2) displayName?: string;

  @ApiPropertyOptional({ type: [String], example: ['catamaran', 'yacht', 'glass_bottom'] })
  @IsOptional() @IsArray() @IsString({ each: true }) allowedValues?: string[];

  @ApiPropertyOptional({ type: [String], example: ['boat-tours'] })
  @IsOptional() @IsArray() @IsString({ each: true }) appliesToCategories?: string[];

  @ApiPropertyOptional({ example: true })
  @IsOptional() @IsBoolean() isFilterable?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional() @IsBoolean() isSortable?: boolean;

  @ApiPropertyOptional({ enum: FilterDisplayType })
  @IsOptional() @IsEnum(FilterDisplayType) filterDisplayType?: FilterDisplayType;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional() @IsBoolean() isActive?: boolean;
}

// Per-tour attribute assignment

export class AttributeValueItemDto {
  @ApiProperty({ example: 'boat_type' })
  @IsString()
  key!: string;

  @ApiProperty({
    example: 'catamaran',
    description: 'Scalar value as a string. For ENUM_MULTI use a comma-separated list, e.g. "turtles,coral".',
  })
  @IsString()
  value!: string;
}

export class SetTourAttributesDto {
  @ApiProperty({ type: [AttributeValueItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AttributeValueItemDto)
  attributes!: AttributeValueItemDto[];
}
