import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** Sortable fields for GET /media-gallery. */
export const MEDIA_SORT_FIELDS = [
  'uploadedAt',
  'name',
  'size',
  'type',
] as const;
export type MediaSortField = (typeof MEDIA_SORT_FIELDS)[number];

export const MEDIA_SORT_ORDERS = ['asc', 'desc'] as const;
export type MediaSortOrder = (typeof MEDIA_SORT_ORDERS)[number];

/** Media-type filter for GET /media-gallery. */
export const MEDIA_TYPE_FILTERS = [
  'all',
  'image',
  'video',
  'audio',
  'svg',
] as const;
export type MediaTypeFilter = (typeof MEDIA_TYPE_FILTERS)[number];

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
    example:
      'https://res.cloudinary.com/demo/image/upload/v1/users/abc-123/my_image.jpg',
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

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: MEDIA_SORT_FIELDS,
    default: 'uploadedAt',
  })
  @IsOptional()
  @IsIn(MEDIA_SORT_FIELDS)
  sortBy?: MediaSortField = 'uploadedAt';

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: MEDIA_SORT_ORDERS,
    default: 'desc',
  })
  @IsOptional()
  @IsIn(MEDIA_SORT_ORDERS)
  sortOrder?: MediaSortOrder = 'desc';

  @ApiPropertyOptional({
    description: 'Filter by media type',
    enum: MEDIA_TYPE_FILTERS,
    default: 'all',
  })
  @IsOptional()
  @IsIn(MEDIA_TYPE_FILTERS)
  type?: MediaTypeFilter = 'all';
}

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class MediaGalleryResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({
    example:
      'https://res.cloudinary.com/demo/image/upload/v1/users/abc/img.jpg',
  })
  url!: string;

  @ApiProperty({ example: 'users/abc-123/img' })
  publicId!: string;

  @ApiProperty({ example: 'image' })
  resourceType!: string;

  @ApiPropertyOptional({ example: 'sunset-cruise.png', nullable: true })
  originalName?: string | null;

  @ApiPropertyOptional({ example: 'image/png', nullable: true })
  mimeType?: string | null;

  @ApiPropertyOptional({ example: 245760, nullable: true })
  bytes?: number | null;

  @ApiPropertyOptional({ example: 'png', nullable: true })
  format?: string | null;

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

export class BulkDeleteMediaDto {
  @ApiProperty({
    description: 'Array of media IDs to delete',
    example: ['uuid-1', 'uuid-2'],
    type: [String],
  })
  @IsString({ each: true })
  ids!: string[];
}
