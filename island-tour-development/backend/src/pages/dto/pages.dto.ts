import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Locale, PageStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * Same ceilings as every other entity's media/meta fields: media URLs are
 * rendered by `next/image` (throws at render on a malformed src), and search
 * engines truncate rather than reject long meta, so these only stop absurd
 * input — soft caps live in the editor as character counters.
 */
const URL_MAX_LENGTH = 2048;
const URL_RULES = { protocols: ['https'], require_protocol: true };
const SEO_TITLE_MAX_LENGTH = 200;
const SEO_DESCRIPTION_MAX_LENGTH = 500;
const TITLE_MAX_LENGTH = 200;

/**
 * The whole legal handover corpus is ~40KB of HTML per page; half a megabyte is
 * "someone pasted a PDF" territory, not a longer policy.
 */
const BODY_MAX_LENGTH = 500_000;

/**
 * Permalink path: one or more lowercase-kebab segments separated by `/`
 * (WordPress-style nesting — `terms`, `legal/terms`, `help/faq/payments`).
 */
const SLUG_PATTERN =
  /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

// ── Response DTOs ─────────────────────────────────────────────────────────────

/**
 * The public payload for one published page, resolved for one locale.
 *
 * `isEnglishFallback` carries the "available in English only" rule: when the
 * requested locale has no translation the ENGLISH row is served (legal source
 * text, never machine-translated), and the frontend shows its existing notice.
 */
export class PublicPageResponseDto {
  @ApiProperty({ example: 'terms' })
  slug!: string;

  @ApiProperty({ enum: Locale, example: Locale.en })
  locale!: Locale;

  @ApiProperty({ example: 'Terms of Service' })
  title!: string;

  @ApiProperty({
    example: '<h2>1. Who we are</h2><p>…</p>',
    description:
      'Sanitized HTML, safe to render directly — sanitised at write time ' +
      '(h2/h3/p/lists/strong/a/tables; no scripts, styles or event handlers).',
  })
  body!: string;

  @ApiPropertyOptional({ nullable: true })
  metaTitle!: string | null;

  @ApiPropertyOptional({ nullable: true })
  metaDescription!: string | null;

  @ApiPropertyOptional({ nullable: true })
  ogImage!: string | null;

  @ApiProperty({
    example: true,
    description:
      'True when the requested locale has no translation and the English row ' +
      'is being served instead — the frontend shows its "available in English ' +
      'only" notice.',
  })
  isEnglishFallback!: boolean;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description:
      'Set (and every other field null) when the slug is a renamed ' +
      'permalink: the frontend must 301 to this page slug instead of ' +
      'rendering. Chains collapse to one hop because redirects point at the ' +
      'page, not the next slug.',
  })
  redirectToSlug!: string | null;
}

/** One locale's stored content, as returned to the dashboard. */
export class PageTranslationEntryDto {
  @ApiProperty({ enum: Locale, example: Locale.en })
  locale!: Locale;

  @ApiProperty({ example: 'Terms of Service' })
  title!: string;

  @ApiProperty({ example: '<h2>1. Who we are</h2><p>…</p>' })
  body!: string;

  @ApiPropertyOptional({ nullable: true })
  metaTitle!: string | null;

  @ApiPropertyOptional({ nullable: true })
  metaDescription!: string | null;

  @ApiProperty({ example: false })
  isMachineTranslated!: boolean;

  @ApiProperty({ example: '2026-07-26T10:00:00.000Z' })
  updatedAt!: Date;
}

/** One row in the dashboard's Pages list. */
export class PageListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'terms' })
  slug!: string;

  @ApiProperty({ enum: PageStatus, example: PageStatus.PUBLISHED })
  status!: PageStatus;

  @ApiPropertyOptional({ nullable: true })
  publishedAt!: Date | null;

  @ApiProperty({ example: '2026-07-26T10:00:00.000Z' })
  updatedAt!: Date;

  @ApiPropertyOptional({
    example: 'Terms of Service',
    nullable: true,
    description: "The ENGLISH title (the base locale's), for the list column.",
  })
  title!: string | null;
}

/** The full admin view: base row plus every stored locale. */
export class PageResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'terms' })
  slug!: string;

  @ApiProperty({ enum: PageStatus, example: PageStatus.DRAFT })
  status!: PageStatus;

  @ApiPropertyOptional({ nullable: true })
  publishedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  ogImage!: string | null;

  @ApiProperty({ example: '2026-07-26T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-07-26T10:00:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({ type: [PageTranslationEntryDto] })
  translations!: PageTranslationEntryDto[];

  @ApiProperty({
    type: [String],
    example: ['terms-of-service'],
    description:
      'Old permalinks that 301 to this page (fromSlug of each redirect row).',
  })
  redirectFromSlugs!: string[];
}

// ── Query DTOs ────────────────────────────────────────────────────────────────

export class PageLocaleQueryDto {
  @ApiPropertyOptional({ enum: Locale, default: Locale.en })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

export class CreatePageDto {
  @ApiProperty({ example: 'Terms of Service', maxLength: TITLE_MAX_LENGTH })
  @IsString()
  @MinLength(1)
  @MaxLength(TITLE_MAX_LENGTH)
  title!: string;

  @ApiPropertyOptional({
    example: 'terms',
    description:
      'Permalink path - one or more segments (`terms`, `legal/terms`). ' +
      'Omitted = generated from the title. Always normalised per segment.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(TITLE_MAX_LENGTH)
  slug?: string;

  @ApiPropertyOptional({
    example: '<h2>1. Who we are</h2><p>…</p>',
    description: 'HTML body — sanitized server-side before storage.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(BODY_MAX_LENGTH)
  body?: string;

  @ApiPropertyOptional({ maxLength: SEO_TITLE_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(SEO_TITLE_MAX_LENGTH)
  metaTitle?: string | null;

  @ApiPropertyOptional({ maxLength: SEO_DESCRIPTION_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(SEO_DESCRIPTION_MAX_LENGTH)
  metaDescription?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUrl(URL_RULES)
  @MaxLength(URL_MAX_LENGTH)
  ogImage?: string | null;
}

/**
 * Locale-agnostic page fields. Every property optional so a PATCH only touches
 * what it names. Content lives on the translation routes; STATUS has its own
 * route because publishing is a lifecycle action, not a field edit.
 */
export class UpdatePageDto {
  @ApiPropertyOptional({
    example: 'terms-of-service',
    description:
      'Renaming a PUBLISHED page automatically 301s the old permalink.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(TITLE_MAX_LENGTH)
  @Matches(SLUG_PATTERN, {
    message:
      'slug must be lowercase letters/numbers separated by single hyphens',
  })
  slug?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUrl(URL_RULES)
  @MaxLength(URL_MAX_LENGTH)
  ogImage?: string | null;
}

export class UpdatePageStatusDto {
  @ApiProperty({ enum: PageStatus, example: PageStatus.PUBLISHED })
  @IsEnum(PageStatus)
  status!: PageStatus;
}

/** Per-locale content. Mirrors the `fields` wrapper every other entity uses. */
export class PageTranslationFieldsDto {
  @ApiPropertyOptional({ example: 'Terms of Service' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional({
    example: '<h2>1. Who we are</h2><p>…</p>',
    description: 'HTML body — sanitized server-side before storage.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(BODY_MAX_LENGTH)
  body?: string;

  @ApiPropertyOptional({ maxLength: SEO_TITLE_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(SEO_TITLE_MAX_LENGTH)
  metaTitle?: string | null;

  @ApiPropertyOptional({ maxLength: SEO_DESCRIPTION_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(SEO_DESCRIPTION_MAX_LENGTH)
  metaDescription?: string | null;
}

export class UpsertPageTranslationDto {
  @ApiProperty({ type: PageTranslationFieldsDto })
  @ValidateNested()
  @Type(() => PageTranslationFieldsDto)
  fields!: PageTranslationFieldsDto;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isMachineTranslated?: boolean = false;
}
