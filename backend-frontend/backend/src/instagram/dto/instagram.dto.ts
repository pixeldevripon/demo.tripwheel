import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  InstagramLayout,
  InstagramMediaType,
  InstagramSource,
  InstagramSyncStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Allowed automatic-sync cadences, in minutes (every 3h / 6h / 12h / daily). */
export const INSTAGRAM_SYNC_INTERVALS = [180, 360, 720, 1440] as const;

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class InstagramAccountResponseDto {
  @ApiProperty({ example: 'default' })
  id!: string;

  @ApiProperty({
    example: 'island.tours_',
    nullable: true,
    description: "Handle without the leading '@'",
  })
  username!: string | null;

  @ApiProperty({
    example: 'https://www.instagram.com/island.tours_',
    nullable: true,
    description:
      'Explicit override. Null when unset - the public payload derives one ' +
      'from the username instead.',
  })
  profileUrl!: string | null;

  @ApiProperty({
    enum: InstagramLayout,
    example: InstagramLayout.GRID,
    description: 'Which public layout renders the tiles.',
  })
  layout!: InstagramLayout;

  @ApiProperty({
    example: 24,
    description: 'How many recent posts each sync pulls (1..25).',
  })
  syncFetchLimit!: number;

  @ApiProperty({
    example: 1440,
    enum: INSTAGRAM_SYNC_INTERVALS,
    description:
      'Minutes between automatic syncs (180 = every 3h, 1440 = daily).',
  })
  syncIntervalMinutes!: number;
}

/** One curated tile, as the dashboard sees it. */
export class InstagramPostResponseDto {
  @ApiProperty({ example: '4f0c1e6a-6f3b-4a1e-9a2b-2f0f4b6d0a11' })
  id!: string;

  @ApiProperty({ enum: InstagramSource, example: InstagramSource.MANUAL })
  source!: InstagramSource;

  @ApiProperty({
    enum: InstagramMediaType,
    example: InstagramMediaType.IMAGE,
  })
  mediaType!: InstagramMediaType;

  @ApiProperty({
    example: 'https://www.instagram.com/p/C8xYzAbCdEf/',
    nullable: true,
  })
  permalink!: string | null;

  @ApiProperty({
    example: 'https://res.cloudinary.com/demo/image/upload/v1/reef.jpg',
    description: 'On a video tile this is the poster.',
  })
  imageUrl!: string;

  @ApiProperty({
    example: null,
    nullable: true,
    description: 'Null on a photo tile.',
  })
  videoUrl!: string | null;

  @ApiProperty({ example: 'Sunset sail off Willemstad', nullable: true })
  caption!: string | null;

  @ApiProperty({ example: 'Catamaran at sunset', nullable: true })
  altText!: string | null;

  @ApiProperty({ example: 1080, nullable: true })
  width!: number | null;

  @ApiProperty({ example: 1080, nullable: true })
  height!: number | null;

  @ApiProperty({ example: 0 })
  displayOrder!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({
    example: false,
    description: 'Badge only - pinning never reorders the grid.',
  })
  isPinned!: boolean;

  @ApiProperty({
    example: null,
    nullable: true,
    description: 'null = brand-wide (shown on every destination page)',
  })
  destinationId!: string | null;

  @ApiProperty({ example: null, nullable: true })
  destinationName!: string | null;

  @ApiProperty({ example: null, nullable: true })
  postedAt!: Date | null;

  @ApiProperty({ example: null, nullable: true })
  syncedAt!: Date | null;
}

/** One tile, as the public site renders it - no admin-only bookkeeping. */
export class PublicInstagramPostDto {
  @ApiProperty({ example: '4f0c1e6a-6f3b-4a1e-9a2b-2f0f4b6d0a11' })
  id!: string;

  @ApiProperty({
    example: 'https://res.cloudinary.com/demo/image/upload/v1/reef.jpg',
    description:
      'Always a URL we control. Instagram CDN links expire, so they are never ' +
      'served here. Doubles as the poster on a video tile, so the grid always ' +
      'has something to paint.',
  })
  imageUrl!: string;

  @ApiProperty({
    example: null,
    nullable: true,
    description:
      'Set on a video/reel tile. The grid plays it muted and looped over the ' +
      'poster, and falls back to the poster alone under reduced motion.',
  })
  videoUrl!: string | null;

  @ApiProperty({
    example: 'https://www.instagram.com/p/C8xYzAbCdEf/',
    description:
      'Never empty: falls back to the account profile so a tile is never a dead link.',
  })
  href!: string;

  @ApiProperty({
    example: 'Catamaran at sunset',
    description: 'altText, else a cleaned caption, else a generic label.',
  })
  alt!: string;

  @ApiProperty({
    enum: InstagramMediaType,
    example: InstagramMediaType.IMAGE,
    description:
      'Drives the corner badge: reel for VIDEO, stacked squares for ' +
      'CAROUSEL_ALBUM, nothing for a single IMAGE (same as Instagram).',
  })
  mediaType!: InstagramMediaType;

  @ApiProperty({ example: false, description: 'Renders the pin badge.' })
  isPinned!: boolean;

  @ApiProperty({ example: 1080, nullable: true })
  width!: number | null;

  @ApiProperty({ example: 1080, nullable: true })
  height!: number | null;
}

/**
 * Everything the grid needs in one call: the header row (handle + outbound
 * link), the kill switch, and the tiles.
 *
 * `enabled` is the single gate the frontend obeys. It is false when the admin
 * switched the section off, when no access token is configured, OR when there is
 * nothing to show - so the frontend never has to decide what an empty feed
 * means, or go looking for a credential it must never be shown.
 */
export class PublicInstagramFeedResponseDto {
  @ApiProperty({ example: true })
  enabled!: boolean;

  @ApiProperty({ example: 'island.tours_', nullable: true })
  username!: string | null;

  @ApiProperty({
    example: 'https://www.instagram.com/island.tours_',
    nullable: true,
  })
  profileUrl!: string | null;

  @ApiProperty({
    enum: InstagramLayout,
    example: InstagramLayout.GRID,
    description: 'Which layout the public site renders these tiles with.',
  })
  layout!: InstagramLayout;

  @ApiProperty({ type: [PublicInstagramPostDto] })
  posts!: PublicInstagramPostDto[];
}

/** The connection panel's view: status, never the token. */
export class InstagramConnectionResponseDto {
  @ApiProperty({
    example: true,
    description: 'True once an access token is configured (dashboard or env).',
  })
  connected!: boolean;

  @ApiProperty({ example: '17841400000000000', nullable: true })
  igUserId!: string | null;

  @ApiProperty({
    example: '2026-09-26T00:00:00.000Z',
    nullable: true,
    description: 'When the long-lived token expires.',
  })
  tokenExpiresAt!: Date | null;

  @ApiProperty({ example: '2026-07-28T03:00:00.000Z', nullable: true })
  lastSyncedAt!: Date | null;

  @ApiProperty({
    enum: InstagramSyncStatus,
    nullable: true,
    example: InstagramSyncStatus.OK,
  })
  lastSyncStatus!: InstagramSyncStatus | null;

  @ApiProperty({ nullable: true, example: null })
  lastSyncError!: string | null;
}

/** Non-secret view of the access token credential for the dashboard form. */
export class InstagramCredentialStatusResponseDto {
  @ApiProperty({
    example: true,
    description: 'An access token is stored in the database.',
  })
  hasAccessToken!: boolean;

  @ApiProperty({
    example: true,
    description: 'A token is set, so a sync can run.',
  })
  isConfigured!: boolean;

  @ApiProperty({
    example: '••••••••WQZD',
    nullable: true,
    description:
      'Bullets + the last 4 characters, so an admin can tell WHICH token is ' +
      'stored without it being usable (same masking as the Stripe keys). Null ' +
      'when none is stored, or when the stored value no longer decrypts.',
  })
  maskedAccessToken!: string | null;
}

/** One sync run's tally. */
export class InstagramSyncResultResponseDto {
  @ApiProperty({ example: true, description: 'False = nothing connected.' })
  ran!: boolean;

  @ApiProperty({ example: 3 })
  created!: number;

  @ApiProperty({ example: 12 })
  updated!: number;

  @ApiProperty({ example: 1 })
  removed!: number;

  @ApiProperty({ example: 0 })
  failed!: number;

  @ApiProperty({ enum: InstagramSyncStatus, example: InstagramSyncStatus.OK })
  status!: InstagramSyncStatus;

  @ApiProperty({ nullable: true, example: null })
  error!: string | null;
}

// ── Query DTOs ────────────────────────────────────────────────────────────────

export class PublicInstagramFeedQueryDto {
  @ApiPropertyOptional({
    example: 'curacao',
    description:
      'Destination slug. Returns brand-wide tiles plus tiles pinned to it; ' +
      'omit for brand-wide only.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  destination?: string;

  @ApiPropertyOptional({
    example: 6,
    minimum: 1,
    maximum: 24,
    description:
      'Omit to let the layout decide: 6 fills the curated 2 x 3 grid, 18 fills ' +
      'three rows of the Instagram gallery. More than 24 is never a real ask.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  limit?: number;
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

/**
 * Save the Instagram access token from the dashboard (stored in the database,
 * DB-only - there is no env fallback). Optional: an omitted `accessToken` is left
 * unchanged, an empty string CLEARS it (the feed then has no token). The token is
 * write-only - it is never returned by any GET. Saving one re-seeds the
 * connection (see the config service), so the next sync resolves the account.
 */
export class SaveInstagramCredentialsDto {
  @ApiPropertyOptional({
    description: 'Long-lived access token (write-only, stored encrypted).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  accessToken?: string;
}

export class UpdateInstagramAccountDto {
  @ApiPropertyOptional({
    enum: InstagramLayout,
    description:
      'GRID = the curated band (rounded cards, generous gaps). GALLERY = the ' +
      'Instagram profile look (4:5 portraits, hairline gaps, corner badges).',
  })
  @IsOptional()
  @IsEnum(InstagramLayout)
  layout?: InstagramLayout;

  @ApiPropertyOptional({
    example: 24,
    minimum: 1,
    maximum: 50,
    description:
      'Posts pulled per sync (1..50). Instagram serves ~25 per page, so the ' +
      'sync paginates to reach larger counts.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  syncFetchLimit?: number;

  @ApiPropertyOptional({
    enum: INSTAGRAM_SYNC_INTERVALS,
    description:
      'Auto-sync cadence in minutes. One of 180 (3h), 360 (6h), 720 (12h), ' +
      '1440 (daily). Applied to the scheduler live.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsIn(INSTAGRAM_SYNC_INTERVALS)
  syncIntervalMinutes?: number;
}

/**
 * Curation of a SYNCED tile. The sync owns the media, caption and permalink, so
 * they are not here - the only edits an admin makes are visibility (hide/show),
 * alt text (captions make poor alt text), and the pinned destination. Reorder is
 * its own endpoint. There is deliberately no create DTO: tiles come only from
 * the sync now.
 */
export class UpdateInstagramPostDto {
  @ApiPropertyOptional({
    example: 'Catamaran at sunset off Willemstad',
    description: 'Overrides the caption-derived alt text.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  altText?: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Pin the tile to one destination (shown only on that island page). ' +
      'null moves it back to brand-wide.',
  })
  @IsOptional()
  @IsUUID()
  destinationId?: string | null;

  @ApiPropertyOptional({
    example: true,
    description: 'Hide a tile from the public grid without deleting it.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ReorderInstagramPostItemDto {
  @ApiProperty({ example: '4f0c1e6a-6f3b-4a1e-9a2b-2f0f4b6d0a11' })
  @IsUUID()
  id!: string;

  @ApiProperty({ example: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder!: number;
}

export class ReorderInstagramPostsDto {
  @ApiProperty({ type: [ReorderInstagramPostItemDto] })
  @ValidateNested({ each: true })
  @Type(() => ReorderInstagramPostItemDto)
  items!: ReorderInstagramPostItemDto[];
}
