import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Locale } from '@/common/constants/locales';

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

/**
 * Body DTO for PATCH /media-gallery/:id - editable attachment metadata
 * (dashboard single-media panel). All fields optional; empty strings are
 * normalized to null in the service.
 */
export class UpdateMediaDto {
  @ApiPropertyOptional({ example: 'Klein Curaçao beach' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ example: 'Aerial view of the west shore.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 'Boats anchored off a white-sand beach' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  altText?: string;

  @ApiPropertyOptional({ example: 'klein-curacao-beach.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  excludeFromIndexing?: boolean;
}

/**
 * Body DTO for PATCH /media-gallery/:id/translations/:locale - one locale's copy.
 *
 * Mirrors the translatable subset of `UpdateMediaDto` and nothing else: a
 * filename and an indexing flag are properties of the asset, not copy that
 * differs by language.
 *
 * There is deliberately NO `isMachineTranslated` here. Every write through this
 * endpoint is a human write and the service hardcodes the flag to false; letting
 * a caller pass it would let the dashboard mark its own edit machine-made and
 * have the AI overwrite it later. (It would also 400 on the global whitelist.)
 *
 * No `@MinLength` anywhere: an empty string is a meaningful value here - it
 * clears the field so the public page falls back to English.
 */
export class UpsertMediaTranslationDto {
  @ApiPropertyOptional({ example: 'Playa Klein Curaçao' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ example: 'Vista aérea de la costa oeste.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    example: 'Barcos fondeados en una playa de arena blanca',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  altText?: string;
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

  @ApiPropertyOptional({
    enum: Locale,
    description:
      'Keep only assets that still need alt text in this locale: they have English alt text but no alt text of their own here. Assets whose locale row was deliberately cleared are excluded - a clear means "show English", not "unfinished". `en` is meaningless and returns everything.',
  })
  @IsOptional()
  @IsEnum(Locale)
  untranslated?: Locale;
}

/**
 * How many image URLs one `GET /media-gallery/seo` call may ask about.
 *
 * A public page asks about the images it is actually rendering - a tour gallery
 * tops out around a dozen. 50 leaves generous headroom while keeping the request
 * line well short of Node's 16 KB header limit (a Cloudinary URL runs ~150
 * chars, so 50 is ~7.5 KB) and bounding the `OR` list the query builds.
 */
export const MEDIA_SEO_MAX_URLS = 50;

/**
 * Query DTO for the public `GET /media-gallery/seo`.
 *
 * URLs arrive as a REPEATED param (`?url=a&url=b`), not CSV: Cloudinary bakes
 * commas into transformation segments (`c_scale,w_2.0`), so splitting on comma
 * would shred them.
 */
export class MediaSeoQueryDto {
  @ApiPropertyOptional({
    enum: Locale,
    default: Locale.en,
    description:
      'Locale for the returned copy. Each field falls back to English independently when the translation is missing or was deliberately cleared.',
  })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;

  @ApiProperty({
    isArray: true,
    type: String,
    maxItems: MEDIA_SEO_MAX_URLS,
    description:
      'Image URLs to look up, repeated (`?url=…&url=…`). Query strings are ignored when matching, so the caller may pass the URL exactly as stored on the entity.',
    example: [
      'https://res.cloudinary.com/demo/image/upload/v1/islandtours/hero-bg',
    ],
  })
  // `?url=a&url=b` arrives as an array, `?url=a` as a bare string. Coerce the
  // single case so callers never have to care.
  @Transform(({ value }) =>
    value === undefined || Array.isArray(value) ? value : [value],
  )
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MEDIA_SEO_MAX_URLS)
  @IsString({ each: true })
  url!: string[];
}

// ── Response DTOs ─────────────────────────────────────────────────────────────

/** One stored locale's copy, as returned to the dashboard's locale switcher. */
export class MediaTranslationResponseDto {
  @ApiProperty({ enum: Locale, example: Locale.nl })
  locale!: Locale;

  @ApiPropertyOptional({ example: 'Strand Klein Curaçao', nullable: true })
  title!: string | null;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  altText!: string | null;

  @ApiProperty({
    example: false,
    description:
      'True when the AI wrote this row. A human save always resets it to false, which is what stops the AI overwriting the edit.',
  })
  isMachineTranslated!: boolean;

  @ApiProperty({ example: '2026-07-31T12:00:00.000Z' })
  updatedAt!: Date;
}

/**
 * One asset's localized SEO copy, as served to the public site.
 *
 * `url` is the QUERY-STRIPPED form, which is the key the caller must look up by:
 * every stored Cloudinary URL carries an `?_a=` analytics param, and the copy on
 * the entity row and the copy in the media library are not guaranteed to carry
 * the same one. Matching on the full string silently misses.
 */
export class MediaSeoResponseDto {
  @ApiProperty({
    description: 'The matched URL with any query string removed.',
    example:
      'https://res.cloudinary.com/demo/image/upload/v1/islandtours/hero-bg',
  })
  url!: string;

  @ApiPropertyOptional({ example: 'Klein Curaçao beach', nullable: true })
  title!: string | null;

  @ApiPropertyOptional({
    example: 'Aerial view of the west shore.',
    nullable: true,
  })
  description!: string | null;

  @ApiPropertyOptional({
    example: 'Boats anchored off a white-sand beach',
    nullable: true,
  })
  altText!: string | null;
}

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

  @ApiPropertyOptional({ example: 1920, nullable: true })
  width?: number | null;

  @ApiPropertyOptional({ example: 1080, nullable: true })
  height?: number | null;

  @ApiPropertyOptional({ example: 'Klein Curaçao beach', nullable: true })
  title?: string | null;

  @ApiPropertyOptional({ example: 'Aerial view.', nullable: true })
  description?: string | null;

  @ApiPropertyOptional({ example: 'Boats off a beach', nullable: true })
  altText?: string | null;

  @ApiPropertyOptional({ example: 'klein-curacao.jpg', nullable: true })
  fileName?: string | null;

  @ApiProperty({ example: false })
  excludeFromIndexing!: boolean;

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
