import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency, Locale } from '@prisma/client';
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

/**
 * Hard ceilings for the search-engine listing. The RECOMMENDED lengths (~70 and
 * ~170) are soft caps surfaced as a character counter in the editor — a long
 * title is truncated by Google, not rejected — so these only stop absurd input.
 */
const SEO_TITLE_MAX_LENGTH = 200;
const SEO_DESCRIPTION_MAX_LENGTH = 500;

// ── Response DTOs ─────────────────────────────────────────────────────────────

/** One published FAQ, already resolved to the requested locale. */
export class HomePageFaqDto {
  @ApiProperty({ example: 'Can I cancel my booking?' })
  question!: string;

  @ApiProperty({ example: 'Yes - free cancellation on every tour.' })
  answer!: string;
}

/**
 * One fanned CTA card, resolved for the public site.
 *
 * `name` is the CATEGORY's name IN THE REQUESTED LOCALE, never an admin-typed
 * string - that is what keeps all 7 locales correct with no translation work
 * and stops a card disagreeing with the page it opens. Null name means the
 * frontend keeps the bundled dictionary label for that slot.
 */
export class PublicEditorialCardDto {
  @ApiProperty({
    example: 'https://res.cloudinary.com/demo/image/upload/buggy.jpg',
  })
  image!: string;

  @ApiPropertyOptional({
    example: 'Buggy Tours',
    nullable: true,
    description:
      "The category's localized name; null = keep the bundled label.",
  })
  name!: string | null;

  @ApiPropertyOptional({
    example: 'buggy-tours',
    nullable: true,
    description:
      "The category's slug, or null when the card is a plain photo (no " +
      'category, the link switched off, or the category archived since). The ' +
      'ISLAND is not part of it: the banner is themed to one island, so the ' +
      'frontend joins this to the island it already resolved for the button - ' +
      'which is what guarantees a card and the button beside it never open ' +
      'different islands.',
  })
  categorySlug!: string | null;

  @ApiPropertyOptional({
    example: 'from 135.00',
    nullable: true,
    description:
      "The card target's cheapest live tour on the banner's island, converted " +
      'to the requested currency. Null when nothing bookable sits behind it.',
  })
  priceFrom!: string | null;

  @ApiPropertyOptional({ enum: Currency, nullable: true })
  priceCurrency!: Currency | null;
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
    type: [PublicEditorialCardDto],
    description:
      'The fanned editorial CTA cards, in fan order. Fewer than three entries ' +
      'leaves the remaining cards on their bundled defaults.',
  })
  editorialCards!: PublicEditorialCardDto[];

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

  @ApiPropertyOptional({
    example: 'Caribbean Tours & Activities, Chosen by Locals | Island Tours',
    nullable: true,
    description:
      'Search-engine title for this locale. Null means the frontend falls back ' +
      'to the site-wide default from Settings.',
  })
  metaTitle!: string | null;

  @ApiPropertyOptional({
    example:
      'Book boat trips, snorkelling and island tours across the Caribbean.',
    nullable: true,
  })
  metaDescription!: string | null;

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

  @ApiPropertyOptional({ nullable: true })
  metaTitle!: string | null;

  @ApiPropertyOptional({ nullable: true })
  metaDescription!: string | null;

  @ApiProperty({ example: false })
  isMachineTranslated!: boolean;
}

/** One fanned CTA card as stored, for the editor. */
export class EditorialCardResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  imageUrl!: string;

  @ApiPropertyOptional({ nullable: true })
  categoryId!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'The hub this card advertises. At most one of categoryId/hubId is set.',
  })
  hubId!: string | null;

  @ApiProperty({
    example: true,
    description:
      'Whether the card is clickable. Independent of the target so a ' +
      'page can be named on a card without sending traffic to it.',
  })
  isLink!: boolean;

  @ApiProperty({ example: 0, description: '0, 1, 2 - left, middle, front.' })
  displayOrder!: number;

  @ApiProperty({
    example: true,
    description:
      'Whether the target page would open on the island the banner points ' +
      'at (a category needs a LIVE tour there; a hub must be published, ' +
      'active and belong to that island). False means the public site ' +
      'serves the card without its link - the editor shows that rather ' +
      'than leaving an admin to discover it.',
  })
  hasLiveTours!: boolean;
}

/** The admin view: base row plus every stored locale. */
export class HomePageResponseDto {
  @ApiPropertyOptional({ nullable: true })
  heroImage!: string | null;

  @ApiProperty({ type: [EditorialCardResponseDto] })
  editorialCards!: EditorialCardResponseDto[];

  @ApiPropertyOptional({
    example: 'curacao',
    nullable: true,
    description:
      'The island the cards are gated against: the pinned one, else the ' +
      'fallback the public site resolves. Null only when nothing is active.',
  })
  resolvedDestinationSlug!: string | null;

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

  @ApiPropertyOptional({
    enum: Currency,
    description:
      "Shopper display currency. The editorial cards' starting prices are " +
      'converted into it (guide §20.9); omitted, they stay in the tour source ' +
      'currency.',
  })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

/** One fanned CTA card on the way in. Its slot is its index in the array. */
export class EditorialCardInputDto {
  @ApiProperty({
    example: 'https://res.cloudinary.com/demo/image/upload/buggy.jpg',
  })
  @IsUrl(URL_RULES)
  @MaxLength(URL_MAX_LENGTH)
  imageUrl!: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'The category this card advertises. Null = a plain photo keeping its ' +
      'bundled label. The island is NOT per card - the banner is themed to ' +
      'one island via editorialDestinationId.',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'The hub this card advertises. At most one of categoryId/hubId - the ' +
      'category wins if both are sent. A hub card only links when the hub ' +
      'belongs to the island the banner points at.',
  })
  @IsOptional()
  @IsUUID()
  hubId?: string | null;

  @ApiPropertyOptional({
    default: true,
    description:
      'Whether the card is clickable. Ignored without a target - there ' +
      'would be nowhere to click to.',
  })
  @IsOptional()
  @IsBoolean()
  isLink?: boolean;
}

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
    type: [EditorialCardInputDto],
    description:
      'The fanned CTA cards, in fan order - a WHOLESALE REPLACE of the deck ' +
      '(array index becomes displayOrder). The design renders exactly three ' +
      'cards, so more than three is rejected rather than silently truncated. ' +
      'Send [] to clear the deck back to its bundled photos.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => EditorialCardInputDto)
  editorialCards?: EditorialCardInputDto[];

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

  /**
   * SEO meta for `/{locale}/`. Same shape and rules as the page-content meta on
   * every other page; length is a soft cap enforced in the editor (a search
   * engine truncates, it does not reject), so only a hard ceiling lives here.
   */
  @ApiPropertyOptional({
    example: 'Caribbean Tours & Activities, Chosen by Locals | Island Tours',
  })
  @IsOptional()
  @IsString()
  @MaxLength(SEO_TITLE_MAX_LENGTH)
  metaTitle?: string | null;

  @ApiPropertyOptional({
    example:
      'Book boat trips, snorkelling and island tours across the Caribbean.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(SEO_DESCRIPTION_MAX_LENGTH)
  metaDescription?: string | null;
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
