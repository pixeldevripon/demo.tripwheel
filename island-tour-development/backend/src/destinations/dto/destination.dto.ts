import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

// ── Response DTOs ──────────────────────────────────────────────────────────────

export class DestinationResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) id!: string;
  @ApiProperty({ example: 'Curaçao' }) name!: string;
  @ApiProperty({ example: 'curacao' }) slug!: string;
  @ApiPropertyOptional({ example: 'https://cdn.example.com/curacao-hero.jpg' })
  heroImage!: string | null;
  @ApiProperty({ example: true }) isSeeded!: boolean;
  @ApiProperty({ example: true }) isActive!: boolean;
  @ApiProperty({ example: '2024-06-01T08:00:00.000Z' }) createdAt!: Date;
  @ApiProperty({ example: '2024-06-01T08:00:00.000Z' }) updatedAt!: Date;
}

export class PaginatedDestinationsResponseDto {
  @ApiProperty({ example: 4 }) total!: number;
  @ApiProperty({ example: 1 }) page!: number;
  @ApiProperty({ example: 20 }) limit!: number;
  @ApiProperty({ type: [DestinationResponseDto] }) data!: DestinationResponseDto[];
}

export class DeleteDestinationResponseDto {
  @ApiProperty({ example: 'Destination deactivated successfully' }) message!: string;
}

// ── Query DTOs ─────────────────────────────────────────────────────────────────

export class DestinationQueryDto {
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

// ── Request DTOs ───────────────────────────────────────────────────────────────

export class CreateDestinationDto {
  @ApiProperty({
    example: 'Aruba',
    description: 'Destination display name. Slug is auto-generated from the name.',
  })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/aruba-hero.jpg',
    description: 'Hero image URL — set after upload via the media module.',
  })
  @IsOptional()
  @IsString()
  heroImage?: string;
}

export class UpdateDestinationDto {
  @ApiPropertyOptional({ example: 'Aruba' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/aruba-hero.jpg' })
  @IsOptional()
  @IsString()
  heroImage?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
