import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Locale } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/**
 * Media URLs are rendered by `next/image`, which THROWS at render time on a
 * malformed src - and this row is the singleton behind every locale's homepage,
 * so one bad save takes out the site's front door rather than one entity page.
 * Require a real https URL and cap the length.
 *
 * Host allow-listing is NOT duplicated here: the frontend owns that list
 * (`remotePatterns`), and a second copy would be a second thing to drift. It
 * enforces it at render time via `lib/images/remote-hosts.ts`.
 */
const URL_MAX_LENGTH = 2048;
const URL_RULES = { protocols: ['https'], require_protocol: true };

// ── Response DTOs ─────────────────────────────────────────────────────────────

/** One published FAQ, already resolved to the requested locale. */
export class HomePageFaqDto {
  @ApiProperty({ example: 'Can I cancel my booking?' })
  question!: string;

  @ApiProperty({ example: 'Yes - free cancellation on every tour.' })
  answer!: string;
}

/**
 * The public homepage payload for one locale: the locale-agnostic base row
 * flattened together with that locale's copy.
 *
 * EVERY field is nullable and null means "the frontend keeps its built-in
 * dictionary default". That contract is what lets the homepage go dynamic
 * without a content-entry milestone - an empty table renders the pre-CMS page.
 */
export class PublicHomePageResponseDto {
  @ApiProperty({ enum: Locale, example: Locale.en })
  locale!: Locale;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/demo/image/upload/hero.jpg',
    nullable: true,
  })
  heroImage!: string | null;

  @ApiProperty({
    type: [String],
    example: ['https://res.cloudinary.com/demo/image/upload/buggy.jpg'],
    description:
      'The fanned editorial CTA cards, in fan order. Fewer than three entries ' +
      'leaves the remaining cards on their bundled defaults.',
  })
  editorialImages!: string[];

  @ApiPropertyOptional({
    example: 'curacao',
    nullable: true,
    description:
      'Slug of the destination the editorial CTA links to. Null means the ' +
      'frontend falls back to its own resolution (launch island, else first ' +
      'active destination, else search).',
  })
  editorialDestinationSlug!: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  ogImage!: string | null;

  @ApiPropertyOptional({
    example: "We didn't discover the Caribbean. We grew up in it.",
    nullable: true,
  })
  heroTitle!: string | null;

  @ApiPropertyOptional({
    example: 'Chosen by locals. Made for travelers.',
    nullable: true,
  })
  heroSubtitle!: string | null;

  @ApiPropertyOptional({ example: 'Top island experiences', nullable: true })
  experiencesTitle!: string | null;

  @ApiPropertyOptional({ example: 'One island', nullable: true })
  editorialTitleLine1!: string | null;

  @ApiPropertyOptional({ example: 'Endless adventures', nullable: true })
  editorialTitleLine2!: string | null;

  @ApiPropertyOptional({
    example: "We grew up on this island. These are the tours we'd book.",
    nullable: true,
  })
  editorialBody!: string | null;

  @ApiPropertyOptional({ example: 'Explore Curaçao', nullable: true })
  editorialCta!: string | null;

  @ApiPropertyOptional({ example: 'Need help before booking?', nullable: true })
  faqTitle!: string | null;

  @ApiPropertyOptional({
    example: "We're locals. We grew up here.",
    nullable: true,
  })
  faqSubtitle!: string | null;

  @ApiProperty({
    type: [HomePageFaqDto],
    description:
      'Published FAQs for THIS locale, in display order. Untranslated FAQs are ' +
      'omitted rather than falling back to English; an empty list means the ' +
      'frontend keeps its bundled dictionary FAQs.',
  })
  faqs!: HomePageFaqDto[];
}

/** One locale's stored copy, as returned to the dashboard. */
export class HomePageTranslationEntryDto {
  @ApiProperty({ enum: Locale, example: Locale.nl })
  locale!: Locale;

  @ApiPropertyOptional({ nullable: true })
  heroTitle!: string | null;

  @ApiPropertyOptional({ nullable: true })
  heroSubtitle!: string | null;

  @ApiPropertyOptional({ nullable: true })
  experiencesTitle!: string | null;

  @ApiPropertyOptional({ nullable: true })
  editorialTitleLine1!: string | null;

  @ApiPropertyOptional({ nullable: true })
  editorialTitleLine2!: string | null;

  @ApiPropertyOptional({ nullable: true })
  editorialBody!: string | null;

  @ApiPropertyOptional({ nullable: true })
  editorialCta!: string | null;

  @ApiPropertyOptional({ nullable: true })
  faqTitle!: string | null;

  @ApiPropertyOptional({ nullable: true })
  faqSubtitle!: string | null;

  @ApiProperty({ example: false })
  isMachineTranslated!: boolean;
}

/** The admin view: base row plus every stored locale. */
export class HomePageResponseDto {
  @ApiPropertyOptional({ nullable: true })
  heroImage!: string | null;

  @ApiProperty({ type: [String] })
  editorialImages!: string[];

  @ApiPropertyOptional({ nullable: true })
  editorialDestinationId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  ogImage!: string | null;

  @ApiProperty({ type: [HomePageTranslationEntryDto] })
  translations!: HomePageTranslationEntryDto[];
}

// ── Query DTOs ────────────────────────────────────────────────────────────────

export class HomePageLocaleQueryDto {
  @ApiPropertyOptional({ enum: Locale, default: Locale.en })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

/**
 * Locale-agnostic homepage fields. Every property is optional so a PATCH only
 * touches what it names; an explicit `null` clears a field back to its
 * dictionary/bundled default.
 */
export class UpdateHomePageDto {
  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/demo/image/upload/hero.jpg',
    nullable: true,
  })
  @IsOptional()
  @IsUrl(URL_RULES)
  @MaxLength(URL_MAX_LENGTH)
  heroImage?: string | null;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Up to three fanned CTA card images, in fan order. The design renders ' +
      'exactly three cards, so more than three is rejected rather than silently ' +
      'truncated.',
  })
  @IsOptional()
  @IsArray()
  @IsUrl(URL_RULES, { each: true })
  @MaxLength(URL_MAX_LENGTH, { each: true })
  @ArrayMaxSize(3)
  editorialImages?: string[];

  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  editorialDestinationId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUrl(URL_RULES)
  @MaxLength(URL_MAX_LENGTH)
  ogImage?: string | null;
}

/** Per-locale copy. Mirrors the `fields` wrapper every other entity uses. */
export class HomePageTranslationFieldsDto {
  @ApiPropertyOptional({
    example: "We didn't discover the Caribbean. We grew up in it.",
  })
  @IsOptional()
  @IsString()
  heroTitle?: string | null;

  @ApiPropertyOptional({ example: 'Chosen by locals. Made for travelers.' })
  @IsOptional()
  @IsString()
  heroSubtitle?: string | null;

  @ApiPropertyOptional({ example: 'Top island experiences' })
  @IsOptional()
  @IsString()
  experiencesTitle?: string | null;

  @ApiPropertyOptional({ example: 'One island' })
  @IsOptional()
  @IsString()
  editorialTitleLine1?: string | null;

  @ApiPropertyOptional({ example: 'Endless adventures' })
  @IsOptional()
  @IsString()
  editorialTitleLine2?: string | null;

  @ApiPropertyOptional({
    example: "We grew up on this island. These are the tours we'd book.",
  })
  @IsOptional()
  @IsString()
  editorialBody?: string | null;

  @ApiPropertyOptional({ example: 'Explore Curaçao' })
  @IsOptional()
  @IsString()
  editorialCta?: string | null;

  @ApiPropertyOptional({ example: 'Need help before booking?' })
  @IsOptional()
  @IsString()
  faqTitle?: string | null;

  @ApiPropertyOptional({ example: "We're locals. We grew up here." })
  @IsOptional()
  @IsString()
  faqSubtitle?: string | null;
}

export class UpsertHomePageTranslationDto {
  @ApiProperty({ type: HomePageTranslationFieldsDto })
  @ValidateNested()
  @Type(() => HomePageTranslationFieldsDto)
  fields!: HomePageTranslationFieldsDto;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isMachineTranslated?: boolean = false;
}
