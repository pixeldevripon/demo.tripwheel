import { ApiProperty } from '@nestjs/swagger';
import { SlugEntityType } from '@prisma/client';
import { IsNotEmpty, IsString } from 'class-validator';

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class SlugResolveResponseDto {
  @ApiProperty({ example: 'curacao' })
  destinationSlug!: string;

  @ApiProperty({ example: 'boat-tours' })
  slug!: string;

  @ApiProperty({ enum: SlugEntityType, example: SlugEntityType.CATEGORY })
  entityType!: SlugEntityType;

  @ApiProperty({ example: 'dcb12be5-fa5b-4613-bd5b-45a4a211acdc', nullable: true })
  entityId!: string | null;
}

// ── Query DTOs ────────────────────────────────────────────────────────────────

export class ResolveSlugQueryDto {
  @ApiProperty({ example: 'curacao', description: 'Destination slug (e.g. curacao, aruba)' })
  @IsString()
  @IsNotEmpty()
  destinationSlug!: string;

  @ApiProperty({ example: 'boat-tours', description: 'Entity slug to resolve' })
  @IsString()
  @IsNotEmpty()
  slug!: string;
}
