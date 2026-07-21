import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

// ── Shared DTOs ───────────────────────────────────────────────────────────────

export class FaqItemDto {
  @ApiPropertyOptional({ example: 'What is your refund policy?' })
  @IsOptional()
  @IsString()
  question?: string;

  @ApiPropertyOptional({ example: 'We offer full refunds within 24 hours.' })
  @IsOptional()
  @IsString()
  answer?: string;
}

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class SiteInfoResponseDto {
  @ApiProperty({ example: 'default' })
  id!: string;

  @ApiProperty({ example: 'Island Tour', nullable: true })
  siteName!: string | null;

  @ApiProperty({ example: 'Your best travel partner', nullable: true })
  siteTagline!: string | null;

  @ApiProperty({ example: 'Description of the site', nullable: true })
  siteDescription!: string | null;

  @ApiProperty({ example: 'v2', nullable: true })
  bookingFormStyle!: string | null;

  @ApiProperty({ example: 'https://example.com/logo.png', nullable: true })
  logo!: string | null;

  @ApiProperty({ example: 'https://example.com/favicon.ico', nullable: true })
  favicon!: string | null;

  @ApiProperty({ example: false })
  enableWhatsappChat!: boolean;

  @ApiProperty({ example: '+1234567890', nullable: true })
  whatsappNumber!: string | null;

  @ApiProperty({ example: 'widget_id', nullable: true })
  instagramWidgetId!: string | null;

  @ApiProperty({ example: false })
  enableInstagram!: boolean;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/demo/image/upload/host.jpg',
    nullable: true,
    description: 'Still frame for the FAQ host avatar, and its video poster.',
  })
  faqHostImage!: string | null;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/demo/video/upload/host.mp4',
    nullable: true,
    description: 'Short loop for the FAQ host avatar.',
  })
  faqHostVideo!: string | null;

  @ApiProperty({ example: [], type: [FaqItemDto] })
  faqs!: any;
}

/**
 * Public-safe projection of SiteInfo for the unauthenticated marketing site.
 *
 * Deliberately a separate class rather than a Pick<> of SiteInfoResponseDto:
 * this shape is served to anyone on the internet, so every field is an explicit
 * decision. Never widen it to spread the SiteInfo row - the settings table also
 * backs Stripe and Mollie config.
 */
export class PublicSiteInfoResponseDto {
  @ApiProperty({ example: 'Island Tours', nullable: true })
  siteName!: string | null;

  @ApiProperty({ example: 'Your Journey Begins here', nullable: true })
  siteTagline!: string | null;

  @ApiProperty({
    example: 'https://res.cloudinary.com/demo/image/upload/v1/logo.png',
    nullable: true,
  })
  logo!: string | null;

  @ApiProperty({ example: 'https://example.com/favicon.ico', nullable: true })
  favicon!: string | null;

  @ApiProperty({
    example: true,
    description:
      'Master 6.6 - gates every WhatsApp surface on the public site.',
  })
  enableWhatsappChat!: boolean;

  @ApiProperty({
    example: '+8801913509868',
    nullable: true,
    description:
      'Null whenever enableWhatsappChat is false, so a disabled number is never exposed.',
  })
  whatsappNumber!: string | null;

  @ApiProperty({ example: false })
  enableInstagram!: boolean;

  @ApiProperty({ example: 'widget_id', nullable: true })
  instagramWidgetId!: string | null;

  @ApiProperty({
    example: 'https://res.cloudinary.com/demo/image/upload/host.jpg',
    nullable: true,
    description:
      'FAQ host avatar still. Null keeps the bundled avatar - the FAQ block ' +
      'renders on the home, destination and collection pages.',
  })
  faqHostImage!: string | null;

  @ApiProperty({
    example: 'https://res.cloudinary.com/demo/video/upload/host.mp4',
    nullable: true,
  })
  faqHostVideo!: string | null;
}

/**
 * Public-safe projection of SiteSEO for the unauthenticated marketing site.
 * Meta/OG/Twitter tags only - analytics IDs, verification codes, and robots.txt
 * stay behind VIEW_SETTINGS.
 */
export class PublicSiteSEOResponseDto {
  @ApiProperty({
    example: 'Island Tours - Curacao Trips & Tours',
    nullable: true,
  })
  metaTitle!: string | null;

  @ApiProperty({ example: 'Book island tours and activities.', nullable: true })
  metaDescription!: string | null;

  @ApiProperty({ example: 'tours, island, travel', nullable: true })
  metaKeywords!: string | null;

  @ApiProperty({ example: 'https://example.com', nullable: true })
  canonicalUrl!: string | null;

  @ApiProperty({ example: 'index, follow', nullable: true })
  robotsMeta!: string | null;

  @ApiProperty({ example: 'OG Title', nullable: true })
  ogTitle!: string | null;

  @ApiProperty({ example: 'OG Description', nullable: true })
  ogDescription!: string | null;

  @ApiProperty({ example: 'https://example.com/og.png', nullable: true })
  ogImage!: string | null;

  @ApiProperty({ example: 'Twitter Title', nullable: true })
  twitterTitle!: string | null;

  @ApiProperty({ example: 'Twitter Description', nullable: true })
  twitterDescription!: string | null;

  @ApiProperty({ example: 'https://example.com/twitter.png', nullable: true })
  twitterImage!: string | null;

  @ApiProperty({
    example: 'dBw5CvburAxi537Rp9qi5uG2174Vb6JwHwIRwPSLIK8',
    nullable: true,
    description:
      'Search Console ownership token, rendered publicly as the google-site-verification meta tag.',
  })
  googleSearchConsole!: string | null;

  @ApiProperty({
    example: '12345678-abcd-1234-abcd-123456789abc',
    nullable: true,
    description:
      'Cookiebot domain group ID (data-cbid). Public by nature - it ships in the consent script tag on every page.',
  })
  cookiebotCbid!: string | null;
}

/** Public-safe SocialMedia projection - the profile URLs, nothing else. */
export class PublicSocialMediaResponseDto {
  @ApiProperty({ example: 'https://facebook.com/islandtour', nullable: true })
  facebookUrl!: string | null;

  @ApiProperty({ example: 'https://twitter.com/islandtour', nullable: true })
  twitterUrl!: string | null;

  @ApiProperty({
    example: 'https://linkedin.com/company/islandtour',
    nullable: true,
  })
  linkedinUrl!: string | null;

  @ApiProperty({ example: 'https://instagram.com/islandtour', nullable: true })
  instagramUrl!: string | null;

  @ApiProperty({ example: 'https://youtube.com/@islandtour', nullable: true })
  youtubeUrl!: string | null;

  @ApiProperty({ example: 'https://tiktok.com/@islandtour', nullable: true })
  tiktokUrl!: string | null;
}

/**
 * Public-safe CompanyInformations projection for footer/legal surfaces.
 * companySize and record timestamps are internal and deliberately excluded.
 */
export class PublicCompanyInfoResponseDto {
  @ApiProperty({ example: 'Island Tour Ltd.', nullable: true })
  companyName!: string | null;

  @ApiProperty({ example: 'info@islandtour.com', nullable: true })
  companyEmail!: string | null;

  @ApiProperty({ example: '+1234567890', nullable: true })
  companyPhone!: string | null;

  @ApiProperty({ example: 'https://islandtour.com', nullable: true })
  companyWebsite!: string | null;

  @ApiProperty({ example: '123 Street Name', nullable: true })
  companyAddress!: string | null;

  @ApiProperty({ example: 'City Name', nullable: true })
  companyCity!: string | null;

  @ApiProperty({ example: 'State Name', nullable: true })
  companyState!: string | null;

  @ApiProperty({ example: '12345', nullable: true })
  companyZip!: string | null;

  @ApiProperty({ example: 'Country Name', nullable: true })
  companyCountry!: string | null;

  @ApiProperty({ example: 'VAT123456', nullable: true })
  companyVat!: string | null;
}

export class SiteSEOResponseDto {
  @ApiProperty({ example: 'default' })
  id!: string;

  @ApiProperty({ example: 'Island Tour - SEO Title', nullable: true })
  metaTitle!: string | null;

  @ApiProperty({ example: 'SEO Description', nullable: true })
  metaDescription!: string | null;

  @ApiProperty({ example: 'tours, island, travel', nullable: true })
  metaKeywords!: string | null;

  @ApiProperty({ example: 'https://example.com', nullable: true })
  canonicalUrl!: string | null;

  @ApiProperty({ example: 'index, follow', nullable: true })
  robotsMeta!: string | null;

  @ApiProperty({ example: 'OG Title', nullable: true })
  ogTitle!: string | null;

  @ApiProperty({ example: 'OG Description', nullable: true })
  ogDescription!: string | null;

  @ApiProperty({ example: 'https://example.com/og.png', nullable: true })
  ogImage!: string | null;

  @ApiProperty({ example: 'Twitter Title', nullable: true })
  twitterTitle!: string | null;

  @ApiProperty({ example: 'Twitter Description', nullable: true })
  twitterDescription!: string | null;

  @ApiProperty({ example: 'https://example.com/twitter.png', nullable: true })
  twitterImage!: string | null;

  @ApiProperty({ example: 'UA-XXXXX-X', nullable: true })
  googleAnalyticsId!: string | null;

  @ApiProperty({ example: 'GTM-XXXXX', nullable: true })
  googleTagManagerId!: string | null;

  @ApiProperty({ example: 'verification_code', nullable: true })
  googleSearchConsole!: string | null;

  @ApiProperty({ example: 'pixel_id', nullable: true })
  facebookPixelId!: string | null;

  @ApiProperty({ example: 'Organization', nullable: true })
  schemaType!: string | null;

  @ApiProperty({ example: '{}', nullable: true })
  customSchema!: string | null;

  @ApiProperty({ example: 'true', nullable: true })
  autoGenerateSitemap!: string | null;

  @ApiProperty({ example: 'User-agent: *', nullable: true })
  robotsTxt!: string | null;

  @ApiProperty({
    example: '12345678-abcd-1234-abcd-123456789abc',
    nullable: true,
  })
  cookiebotCbid!: string | null;
}

export class SocialMediaResponseDto {
  @ApiProperty({ example: 'default' })
  id!: string;

  @ApiProperty({ example: 'https://facebook.com/islandtour', nullable: true })
  facebookUrl!: string | null;

  @ApiProperty({ example: 'https://twitter.com/islandtour', nullable: true })
  twitterUrl!: string | null;

  @ApiProperty({
    example: 'https://linkedin.com/company/islandtour',
    nullable: true,
  })
  linkedinUrl!: string | null;

  @ApiProperty({ example: 'https://instagram.com/islandtour', nullable: true })
  instagramUrl!: string | null;

  @ApiProperty({ example: 'https://youtube.com/@islandtour', nullable: true })
  youtubeUrl!: string | null;

  @ApiProperty({ example: 'https://tiktok.com/@islandtour', nullable: true })
  tiktokUrl!: string | null;
}

export class MailchimpResponseDto {
  @ApiProperty({ example: 'default' })
  id!: string;

  @ApiPropertyOptional({ example: '••••••••1234', nullable: true })
  apiKey?: string | null;

  @ApiProperty({ example: 'audience_id', nullable: true })
  audienceId!: string | null;

  @ApiProperty({ example: 'usX', nullable: true })
  serverPrefix!: string | null;
}

export class CompanyInformationsResponseDto {
  @ApiProperty({ example: 'default' })
  id!: string;

  @ApiProperty({ example: 'Island Tour Ltd.', nullable: true })
  companyName!: string | null;

  @ApiProperty({ example: 'info@islandtour.com', nullable: true })
  companyEmail!: string | null;

  @ApiProperty({ example: '+1234567890', nullable: true })
  companyPhone!: string | null;

  @ApiProperty({ example: 'https://islandtour.com', nullable: true })
  companyWebsite!: string | null;

  @ApiProperty({ example: '123 Street Name', nullable: true })
  companyAddress!: string | null;

  @ApiProperty({ example: 'City Name', nullable: true })
  companyCity!: string | null;

  @ApiProperty({ example: 'State Name', nullable: true })
  companyState!: string | null;

  @ApiProperty({ example: '12345', nullable: true })
  companyZip!: string | null;

  @ApiProperty({ example: 'Country Name', nullable: true })
  companyCountry!: string | null;

  @ApiProperty({ example: 'VAT123456', nullable: true })
  companyVat!: string | null;

  @ApiProperty({ example: '10-50', nullable: true })
  companySize!: string | null;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2024-06-01T08:00:00.000Z' })
  updatedAt!: Date;
}

export class StripeConfigurationResponseDto {
  @ApiProperty({ example: 'default' })
  id!: string;

  @ApiProperty({ example: 'Stripe' })
  paymentLabel!: string;

  @ApiProperty({ example: 'pk_test_...' })
  publishableKey!: string;

  @ApiProperty({ example: ['card'], isArray: true })
  paymentMethods!: string[];

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2024-06-01T08:00:00.000Z' })
  updatedAt!: Date;
}

export class MollieConfigurationResponseDto {
  @ApiProperty({ example: 'default' })
  id!: string;

  @ApiProperty({ example: 'Mollie' })
  paymentLabel!: string;

  @ApiProperty({ example: ['creditcard'], isArray: true })
  paymentMethods!: string[];

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2024-06-01T08:00:00.000Z' })
  updatedAt!: Date;
}

// ── Update DTOs ───────────────────────────────────────────────────────────────

export class UpdateSiteInfoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteTagline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteDescription?: string;

  @ApiPropertyOptional({ default: 'v2' })
  @IsOptional()
  @IsString()
  bookingFormStyle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  favicon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enableWhatsappChat?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  whatsappNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instagramWidgetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enableInstagram?: boolean;

  @ApiPropertyOptional({
    description:
      "The FAQ host avatar's still frame. Empty keeps the bundled one.",
  })
  @IsOptional()
  @IsString()
  faqHostImage?: string;

  @ApiPropertyOptional({
    description: 'A short loop for the FAQ host avatar. Empty shows the still.',
  })
  @IsOptional()
  @IsString()
  faqHostVideo?: string;

  @ApiPropertyOptional({ type: [FaqItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FaqItemDto)
  faqs?: FaqItemDto[];
}

export class UpdateSiteSEODto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  metaTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  metaDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  metaKeywords?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  canonicalUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  robotsMeta?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ogTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ogDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ogImage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  twitterTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  twitterDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  twitterImage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  googleAnalyticsId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  googleTagManagerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  googleSearchConsole?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  facebookPixelId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  schemaType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customSchema?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  autoGenerateSitemap?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  robotsTxt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cookiebotCbid?: string;
}

export class UpdateSocialMediaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  facebookUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  twitterUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  linkedinUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instagramUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  youtubeUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tiktokUrl?: string;
}

export class UpdateMailchimpDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  audienceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serverPrefix?: string;
}

export class UpdateCompanyInformationsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  companyEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyWebsite?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyState?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyZip?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyCountry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyVat?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companySize?: string;
}

export class UpdateStripeConfigurationDto {
  @ApiPropertyOptional({ default: 'Stripe' })
  @IsOptional()
  @IsString()
  paymentLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  publishableKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  secretKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  webhookSecret?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  paymentMethods?: string[];
}

export class UpdateMollieConfigurationDto {
  @ApiPropertyOptional({ default: 'Mollie' })
  @IsOptional()
  @IsString()
  paymentLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  paymentMethods?: string[];
}
