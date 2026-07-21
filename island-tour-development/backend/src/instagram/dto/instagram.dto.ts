import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  InstagramLayout,
  InstagramMediaType,
  InstagramSource,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

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
 * switched the section off OR when there is nothing to show, so the frontend
 * never has to decide what an empty feed means.
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

export class UpdateInstagramAccountDto {
  @ApiPropertyOptional({
    example: 'island.tours_',
    description: "Handle. A leading '@' is stripped by the service.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  username?: string;

  @ApiPropertyOptional({
    example: 'https://www.instagram.com/island.tours_',
    description: 'Empty string clears it, and the username derives the link.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  profileUrl?: string;

  @ApiPropertyOptional({
    enum: InstagramLayout,
    description:
      'GRID = the curated band (rounded cards, generous gaps). GALLERY = the ' +
      'Instagram profile look (4:5 portraits, hairline gaps, corner badges).',
  })
  @IsOptional()
  @IsEnum(InstagramLayout)
  layout?: InstagramLayout;
}

export class CreateInstagramPostDto {
  @ApiProperty({
    example: 'https://res.cloudinary.com/demo/image/upload/v1/reef.jpg',
    description:
      'Media-library asset URL. Required even for a video tile, where it is ' +
      'the poster.',
  })
  @IsString()
  @MaxLength(600)
  imageUrl!: string;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/demo/video/upload/v1/reel.mp4',
    description:
      'Media-library video. Present means this is a video tile - mediaType is ' +
      'derived from it, never sent.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(600)
  videoUrl?: string;

  @ApiPropertyOptional({ example: 'reef-sunset-01' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  imagePublicId?: string;

  @ApiPropertyOptional({
    enum: [InstagramMediaType.IMAGE, InstagramMediaType.CAROUSEL_ALBUM],
    description:
      'What the linked post is, for the corner badge. VIDEO is not accepted ' +
      'here - attaching a video is what makes a tile a reel.',
  })
  @IsOptional()
  @IsEnum(InstagramMediaType)
  mediaType?: InstagramMediaType;

  @ApiPropertyOptional({
    example: false,
    description: 'Shows the pin badge. Never affects ordering.',
  })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiPropertyOptional({
    example: 'https://www.instagram.com/p/C8xYzAbCdEf/',
    description: 'Omit to link the tile at the account profile instead.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(600)
  permalink?: string;

  @ApiPropertyOptional({ example: 'Sunset sail off Willemstad' })
  @IsOptional()
  @IsString()
  @MaxLength(2200)
  caption?: string;

  @ApiPropertyOptional({ example: 'Catamaran at sunset' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  altText?: string;

  @ApiPropertyOptional({ example: 1080 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  width?: number;

  @ApiPropertyOptional({ example: 1080 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  height?: number;

  @ApiPropertyOptional({
    example: null,
    description: 'null / omitted = brand-wide',
  })
  @IsOptional()
  @IsUUID()
  destinationId?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateInstagramPostDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(600)
  imageUrl?: string;

  @ApiPropertyOptional({
    description:
      'Empty string clears the video and turns the tile back into a photo. ' +
      'Omit to leave it as it is.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(600)
  videoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  imagePublicId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(600)
  permalink?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2200)
  caption?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  altText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  width?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  height?: number;

  @ApiPropertyOptional({
    nullable: true,
    description: 'null moves the tile back to brand-wide',
  })
  @IsOptional()
  @IsUUID()
  destinationId?: string | null;

  @ApiPropertyOptional({
    enum: [InstagramMediaType.IMAGE, InstagramMediaType.CAROUSEL_ALBUM],
    description:
      'Badge only. VIDEO is rejected - attach or clear a video instead.',
  })
  @IsOptional()
  @IsEnum(InstagramMediaType)
  mediaType?: InstagramMediaType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiPropertyOptional()
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
