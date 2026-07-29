import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CustomScriptPosition } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { CUSTOM_SCRIPTS_MAX_LENGTH } from '@/common/utils/custom-scripts.util';
import { IsSafeCustomScript } from '@/common/validators/is-safe-custom-script.validator';

// ── Response DTOs ─────────────────────────────────────────────────────────────

/** One snippet, as the dashboard list sees it. */
export class CustomScriptResponseDto {
  @ApiProperty({ example: '9d1f0a2c-4b7e-4f0a-9c31-1b2c3d4e5f60' })
  id!: string;

  @ApiProperty({ example: 'Hotjar' })
  name!: string;

  @ApiProperty({
    example: 'Session recording. Owned by marketing; review Q1.',
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({
    enum: CustomScriptPosition,
    example: CustomScriptPosition.BODY_END,
    description: 'HEAD renders inside <head>; BODY_END renders last in <body>.',
  })
  position!: CustomScriptPosition;

  @ApiProperty({
    example: '<script>/* ... */</script>',
    description: 'The raw markup, exactly as the admin pasted it.',
  })
  code!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: 0 })
  displayOrder!: number;

  @ApiProperty({ example: '2026-07-28T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-07-28T10:00:00.000Z' })
  updatedAt!: Date;
}

/** One top-level element of a snippet, ready to render. */
export class PublicCustomScriptNodeDto {
  @ApiProperty({
    example: 'script',
    enum: ['script', 'style', 'link', 'meta', 'noscript'],
  })
  tag!: string;

  @ApiProperty({
    example: { async: '', src: 'https://cdn.example.com/widget.js' },
    description: 'Attributes as authored, already allowlist-checked.',
  })
  attributes!: Record<string, string>;

  @ApiProperty({
    example: 'console.log(1)',
    nullable: true,
    description: 'Inner content; null for void elements (<link>, <meta>).',
  })
  html!: string | null;
}

/**
 * One snippet as the public site renders it: structure, not a blob.
 *
 * The raw string is deliberately NOT sent. A `<head>` has nowhere to put the
 * wrapper element that raw interpolation needs, and handing the frontend a
 * closed set of parsed tags means the render path can only ever emit tags this
 * allowlist knows - a stronger guarantee than trusting a string. The admin still
 * edits, and the row still stores, the code verbatim.
 *
 * The admin-only bookkeeping (name, description, isActive, timestamps) is
 * absent. `isActive` in particular: an inactive snippet must not appear in this
 * payload AT ALL - shipping it with a false flag and trusting the frontend to
 * skip it would put a switched-off vendor's code in the HTML of every page,
 * which is exactly what the switch is for.
 */
export class PublicCustomScriptDto {
  @ApiProperty({ example: '9d1f0a2c-4b7e-4f0a-9c31-1b2c3d4e5f60' })
  id!: string;

  @ApiProperty({ type: [PublicCustomScriptNodeDto] })
  nodes!: PublicCustomScriptNodeDto[];
}

/** Everything the public page needs, already split by injection point. */
export class PublicCustomScriptsResponseDto {
  @ApiProperty({
    type: [PublicCustomScriptDto],
    description: 'Rendered inside <head>, in order.',
  })
  head!: PublicCustomScriptDto[];

  @ApiProperty({
    type: [PublicCustomScriptDto],
    description: 'Rendered as the last thing in <body>, in order.',
  })
  bodyEnd!: PublicCustomScriptDto[];
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

export class CreateCustomScriptDto {
  @ApiProperty({
    example: 'Hotjar',
    description:
      'What this snippet is. Required - an unnamed <script> is unmaintainable ' +
      'the moment a second one exists.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    example: 'Session recording. Owned by marketing; review Q1.',
    description: 'Why it was added / who owns the account.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    enum: CustomScriptPosition,
    default: CustomScriptPosition.BODY_END,
    description:
      'HEAD only for snippets that MUST run before first paint - everything ' +
      'there delays the page for every visitor. Defaults to BODY_END.',
  })
  @IsOptional()
  @IsEnum(CustomScriptPosition)
  position?: CustomScriptPosition;

  @ApiProperty({
    example: '<script async src="https://cdn.example.com/widget.js"></script>',
    maxLength: CUSTOM_SCRIPTS_MAX_LENGTH,
    description:
      'The vendor snippet, stored verbatim. Structurally validated: only ' +
      '<script>/<style>/<link>/<meta>/<noscript> at the top level, no <base>, ' +
      'no inline event handlers, no javascript: URLs, nothing left unclosed.',
  })
  @IsString()
  @MinLength(1)
  @IsSafeCustomScript()
  code!: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * Every field optional - the dashboard sends only what changed. `code` keeps the
 * same validator, so a snippet can never be edited INTO an unsafe shape.
 */
export class UpdateCustomScriptDto {
  @ApiPropertyOptional({ example: 'Hotjar' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'Session recording.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: CustomScriptPosition })
  @IsOptional()
  @IsEnum(CustomScriptPosition)
  position?: CustomScriptPosition;

  @ApiPropertyOptional({ maxLength: CUSTOM_SCRIPTS_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @IsSafeCustomScript()
  code?: string;

  @ApiPropertyOptional({
    example: false,
    description:
      'Off removes it from every page without deleting it - the first thing ' +
      'to reach for when isolating which tool broke something.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ReorderCustomScriptItemDto {
  @ApiProperty({ example: '9d1f0a2c-4b7e-4f0a-9c31-1b2c3d4e5f60' })
  @IsUUID()
  id!: string;

  @ApiProperty({ example: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder!: number;
}

/**
 * The whole list in one call. Order is not cosmetic here: a consent manager has
 * to execute before the tags it gates, so a half-applied reorder is a real
 * defect, not a visual one - hence one transactional payload rather than a
 * PATCH per row.
 */
export class ReorderCustomScriptsDto {
  @ApiProperty({ type: [ReorderCustomScriptItemDto] })
  @ValidateNested({ each: true })
  @Type(() => ReorderCustomScriptItemDto)
  items!: ReorderCustomScriptItemDto[];
}
