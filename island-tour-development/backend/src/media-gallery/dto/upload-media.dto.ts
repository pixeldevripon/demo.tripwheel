import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

// ── Upload DTOs ───────────────────────────────────────────────────────────────

/**
 * Body DTO for POST /media-gallery/confirm
 * Used after a successful direct client-side Cloudinary upload.
 */
export class ConfirmUploadDto {
  @ApiProperty({
    description: 'Cloudinary public_id of the uploaded asset',
    example: 'users/abc-123/my_image',
  })
  @IsString()
  publicId!: string;

  @ApiProperty({
    description: 'Cloudinary secure_url of the uploaded asset',
    example: 'https://res.cloudinary.com/demo/image/upload/v1/users/abc-123/my_image.jpg',
  })
  @IsString()
  url!: string;

  @ApiProperty({
    description: 'Cloudinary resource type (image | video | raw)',
    example: 'image',
  })
  @IsString()
  resourceType!: string;
}

// ── Query DTOs ────────────────────────────────────────────────────────────────

export class MediaGalleryQueryDto {
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

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class MediaGalleryResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'https://res.cloudinary.com/demo/image/upload/v1/users/abc/img.jpg' })
  url!: string;

  @ApiProperty({ example: 'users/abc-123/img' })
  publicId!: string;

  @ApiProperty({ example: 'image' })
  resourceType!: string;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  uploadedAt!: Date;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  userId!: string;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  updatedAt!: Date;
}

export class PaginatedMediaGalleryResponseDto {
  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ type: [MediaGalleryResponseDto] })
  data!: MediaGalleryResponseDto[];
}

export class SignedUploadParamsResponseDto {
  @ApiProperty({ example: 'abc123def456...' })
  signature!: string;

  @ApiProperty({ example: 1720000000 })
  timestamp!: number;

  @ApiProperty({ example: 'djqinkh2c' })
  cloudName!: string;

  @ApiProperty({ example: '973223391745832' })
  apiKey!: string;

  @ApiProperty({ example: 'users/abc-123' })
  folder!: string;
}

export class AsyncUploadResponseDto {
  @ApiProperty({ example: 'Upload queued' })
  message!: string;

  @ApiProperty({ example: ['job-id-1', 'job-id-2'], type: [String] })
  jobIds!: string[];
}

export class DeleteMediaResponseDto {
  @ApiProperty({ example: 'Media deleted successfully' })
  message!: string;
}
