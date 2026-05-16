import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';

// ── Response DTOs ──────────────────────────────────────────────────────────────

export class AllowedCategoryItemDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) id!: string;
  @ApiProperty({ example: '7fa65f12-4b21-4e1a-9a3c-1d8e9a2b4c6d' }) categoryId!: string;
  @ApiProperty({
    example: { id: '7fa65f12-...', name: 'Boat Tours', slug: 'boat-tours' },
  })
  category!: { id: string; name: string; slug: string };
}

export class HubResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) id!: string;
  @ApiProperty({ example: 'a1b2c3d4-0000-0000-0000-000000000001' }) destinationId!: string;
  @ApiProperty({ example: 'Klein Curaçao' }) name!: string;
  @ApiProperty({ example: 'klein-curacao' }) slug!: string;
  @ApiPropertyOptional({ example: 'A small uninhabited island off the coast of Curaçao.' })
  description!: string | null;
  @ApiProperty({ example: true }) isSeeded!: boolean;
  @ApiProperty({ example: true }) isActive!: boolean;
  @ApiProperty({ example: '2024-06-01T08:00:00.000Z' }) createdAt!: Date;
  @ApiProperty({ example: '2024-06-01T08:00:00.000Z' }) updatedAt!: Date;
}

export class HubDetailResponseDto extends HubResponseDto {
  @ApiProperty({ type: [AllowedCategoryItemDto] }) allowedCategories!: AllowedCategoryItemDto[];
}

export class PaginatedHubsResponseDto {
  @ApiProperty({ example: 1 }) total!: number;
  @ApiProperty({ example: 1 }) page!: number;
  @ApiProperty({ example: 20 }) limit!: number;
  @ApiProperty({ type: [HubResponseDto] }) data!: HubResponseDto[];
}

export class AddAllowedCategoryResponseDto {
  @ApiProperty({ example: 'Allowed category added successfully' }) message!: string;
  @ApiProperty({ type: AllowedCategoryItemDto }) allowedCategory!: AllowedCategoryItemDto;
}

export class RemoveAllowedCategoryResponseDto {
  @ApiProperty({ example: 'Allowed category removed successfully' }) message!: string;
}

export class DeleteHubResponseDto {
  @ApiProperty({ example: 'Hub deactivated successfully' }) message!: string;
}

// ── Query DTOs ─────────────────────────────────────────────────────────────────

export class HubQueryDto {
  @ApiPropertyOptional({ description: 'Filter by destination UUID' })
  @IsOptional()
  @IsUUID()
  destinationId?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class ActiveHubsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by destination UUID' })
  @IsOptional()
  @IsUUID()
  destinationId?: string;
}

export class HubBySlugQueryDto {
  @ApiProperty({ example: 'curacao', description: 'Destination slug — required because hub slugs are unique per destination' })
  @IsString()
  destinationSlug!: string;
}

// ── Request DTOs ───────────────────────────────────────────────────────────────

export class CreateHubDto {
  @ApiProperty({ example: 'a1b2c3d4-0000-0000-0000-000000000001' })
  @IsUUID()
  destinationId!: string;

  @ApiProperty({ example: 'Klein Curaçao' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ example: 'A small uninhabited island off the coast of Curaçao.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['cat-id-1', 'cat-id-2'],
    description: 'Initial set of allowed category IDs (can also be managed later via sub-routes)',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  allowedCategoryIds?: string[];
}

export class UpdateHubDto {
  @ApiPropertyOptional({ example: 'Klein Curaçao' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AddAllowedCategoryDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  categoryId!: string;
}
