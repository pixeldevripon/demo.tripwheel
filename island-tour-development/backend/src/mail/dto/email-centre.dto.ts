import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EmailAudience,
  EmailSendStatus,
  EmailStream,
  EmailTemplateKey,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * WP-H email centre DTOs (EMAIL-IMPLEMENTATION-PLAN.md §4, checklist
 * H-04…H-07). Response → Query → Request, per module conventions.
 *
 * DELIBERATELY ABSENT everywhere: any switch for the booking emails
 * (BK-1/BK-2/CX-1). They are contractual and always-on (founder decision
 * 2026-08-11); the global ValidationPipe's `forbidNonWhitelisted` turns any
 * attempt to PATCH such a field into a 400.
 */

// Bare-address-or-`Name <addr>` is the MAIL_FROM contract; settings addresses
// are stricter (a bare mailbox) so a typo cannot silently break Reply-To.
const EMAIL_SHAPE = /^\S+@\S+\.\S+$/;

// ≥1 weekday of lowercase day names, csv (validated case-insensitively;
// normalized to lowercase in the service).
const WEEKDAYS_CSV =
  /^(mon|tue|wed|thu|fri|sat|sun)(,(mon|tue|wed|thu|fri|sat|sun))*$/i;

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class ReviewRequestSettingsSliceDto {
  @ApiProperty({ example: false })
  enabled!: boolean;

  @ApiProperty({ example: 10 })
  firstSendLocalHour!: number;

  @ApiProperty({ example: 1 })
  firstSendDelayDays!: number;

  @ApiProperty({ example: 5 })
  reminderAfterDays!: number;

  @ApiProperty({ example: 30 })
  giveUpAfterDays!: number;
}

/** One fully resolved value set (used for `effective` and `defaults`). */
export class EmailSettingsValuesDto {
  @ApiProperty({ example: false })
  marketingEnabled!: boolean;

  @ApiProperty({ example: true })
  onboardingEnabled!: boolean;

  @ApiProperty({ example: false })
  calendarEmailEnabled!: boolean;

  @ApiProperty({ example: true })
  ob8PartnerOffer!: boolean;

  @ApiProperty({ example: 'sales@islandtours.com', nullable: true })
  salesEmail!: string | null;

  @ApiProperty({ example: 'hello@islandtours.com', nullable: true })
  mailReplyTo!: string | null;

  @ApiProperty({ example: 'founder@islandtours.com', nullable: true })
  ob6ReplyTo!: string | null;

  @ApiProperty({ example: 48 })
  ob3DelayHours!: number;

  @ApiProperty({ example: 7 })
  ob4DelayDays!: number;

  @ApiProperty({ example: 14 })
  ob6DelayDays!: number;

  @ApiProperty({ example: 3 })
  ob7AfterLiveDays!: number;

  @ApiProperty({ example: 7 })
  ob8AfterLiveDays!: number;

  @ApiProperty({ example: 2 })
  pendingReminderBusinessDays!: number;

  @ApiProperty({ example: 'tue,wed,thu' })
  windowWeekdays!: string;

  @ApiProperty({ example: 9 })
  windowStartHour!: number;

  @ApiProperty({ example: 11 })
  windowEndHour!: number;

  @ApiProperty({ example: 72 })
  mk1DelayHours!: number;

  @ApiProperty({ type: ReviewRequestSettingsSliceDto })
  review!: ReviewRequestSettingsSliceDto;
}

/** The raw stored row — null everywhere the admin never overrode. */
export class EmailSettingsStoredDto {
  @ApiProperty({ example: null, nullable: true })
  marketingEnabled!: boolean | null;

  @ApiProperty({ example: null, nullable: true })
  onboardingEnabled!: boolean | null;

  @ApiProperty({ example: null, nullable: true })
  calendarEmailEnabled!: boolean | null;

  @ApiProperty({ example: null, nullable: true })
  ob8PartnerOffer!: boolean | null;

  @ApiProperty({ example: null, nullable: true })
  salesEmail!: string | null;

  @ApiProperty({ example: null, nullable: true })
  mailReplyTo!: string | null;

  @ApiProperty({ example: null, nullable: true })
  ob6ReplyTo!: string | null;

  @ApiProperty({ example: null, nullable: true })
  ob3DelayHours!: number | null;

  @ApiProperty({ example: null, nullable: true })
  ob4DelayDays!: number | null;

  @ApiProperty({ example: null, nullable: true })
  ob6DelayDays!: number | null;

  @ApiProperty({ example: null, nullable: true })
  ob7AfterLiveDays!: number | null;

  @ApiProperty({ example: null, nullable: true })
  ob8AfterLiveDays!: number | null;

  @ApiProperty({ example: null, nullable: true })
  pendingReminderBusinessDays!: number | null;

  @ApiProperty({ example: null, nullable: true })
  windowWeekdays!: string | null;

  @ApiProperty({ example: null, nullable: true })
  windowStartHour!: number | null;

  @ApiProperty({ example: null, nullable: true })
  windowEndHour!: number | null;

  @ApiProperty({ example: null, nullable: true })
  mk1DelayHours!: number | null;

  @ApiProperty({ type: ReviewRequestSettingsSliceDto })
  review!: ReviewRequestSettingsSliceDto;
}

/**
 * GET /email/settings — `effective` is what the programme runs on right now;
 * `stored` is what the admin explicitly set (null = never touched);
 * `defaults` is what a null falls back to (env value where one exists, else
 * the built-in) so the dashboard can render "using default (…)" hints.
 */
export class EmailSettingsResponseDto {
  @ApiProperty({ type: EmailSettingsValuesDto })
  effective!: EmailSettingsValuesDto;

  @ApiProperty({ type: EmailSettingsStoredDto })
  stored!: EmailSettingsStoredDto;

  @ApiProperty({ type: EmailSettingsValuesDto })
  defaults!: EmailSettingsValuesDto;
}

export class EmailSendRowDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ enum: EmailTemplateKey, example: 'OB3_FIRST_TOUR_HOWTO' })
  templateKey!: EmailTemplateKey;

  @ApiProperty({
    example: 'b7f9c1d2-4711-4e0a-9c60-2f8e7a1b3c4d',
    description:
      'Dedupe scope: booking id, operator id, `…#resend-{n}` or `test:<userId>#<n>`.',
  })
  scopeId!: string;

  @ApiProperty({ example: 'mayra@irietours.com' })
  toEmail!: string;

  @ApiProperty({ enum: EmailStream, example: 'LIFECYCLE' })
  stream!: EmailStream;

  @ApiProperty({ enum: EmailSendStatus, example: 'SENT' })
  status!: EmailSendStatus;

  @ApiProperty({ example: 'en', nullable: true })
  locale!: string | null;

  @ApiProperty({ example: 're_2Xk9…', nullable: true })
  providerMessageId!: string | null;

  @ApiProperty({ example: 'opted-out', nullable: true })
  suppressedReason!: string | null;

  @ApiProperty({ example: null, nullable: true })
  error!: string | null;

  @ApiProperty({ example: '2026-08-11T13:15:00.000Z' })
  createdAt!: Date;
}

export class PaginatedEmailSendsResponseDto {
  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ type: [EmailSendRowDto] })
  data!: EmailSendRowDto[];
}

export class EmailOptOutRowDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'mayra@irietours.com' })
  email!: string;

  @ApiProperty({ enum: EmailAudience, example: 'OPERATOR' })
  audience!: EmailAudience;

  @ApiProperty({ enum: EmailStream, example: 'LIFECYCLE' })
  stream!: EmailStream;

  @ApiProperty({ example: 'unsubscribe-link' })
  source!: string;

  @ApiProperty({ example: '2026-08-11T13:15:00.000Z' })
  createdAt!: Date;
}

export class PaginatedEmailOptOutsResponseDto {
  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ type: [EmailOptOutRowDto] })
  data!: EmailOptOutRowDto[];
}

export class EmailConsentRowDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'denley@example.com' })
  email!: string;

  @ApiProperty({ example: 'checkout-newsletter-opt-in' })
  source!: string;

  @ApiProperty({
    example: 'b7f9c1d2-4711-4e0a-9c60-2f8e7a1b3c4d',
    nullable: true,
  })
  bookingId!: string | null;

  @ApiProperty({ example: '2026-08-11T13:15:00.000Z' })
  createdAt!: Date;
}

export class PaginatedEmailConsentsResponseDto {
  @ApiProperty({ example: 12 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ type: [EmailConsentRowDto] })
  data!: EmailConsentRowDto[];
}

// ── Query DTOs ────────────────────────────────────────────────────────────────

export class EmailSendsQueryDto {
  @ApiPropertyOptional({
    enum: EmailTemplateKey,
    description: 'Filter by template',
  })
  @IsOptional()
  @IsEnum(EmailTemplateKey)
  templateKey?: EmailTemplateKey;

  @ApiPropertyOptional({
    enum: EmailSendStatus,
    description: 'Filter by outcome',
  })
  @IsOptional()
  @IsEnum(EmailSendStatus)
  status?: EmailSendStatus;

  @ApiPropertyOptional({ enum: EmailStream, description: 'Filter by stream' })
  @IsOptional()
  @IsEnum(EmailStream)
  stream?: EmailStream;

  @ApiPropertyOptional({
    description: 'Exact recipient match (case-insensitive)',
    example: 'mayra@irietours.com',
  })
  @IsOptional()
  @IsString()
  @MaxLength(320)
  toEmail?: string;

  @ApiPropertyOptional({
    description: 'Rows created at/after this instant (ISO 8601)',
    example: '2026-08-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    description: 'Rows created at/before this instant (ISO 8601)',
    example: '2026-08-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;

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

export class EmailPeopleQueryDto {
  @ApiPropertyOptional({
    description:
      'Email search — prefix or exact match on the lowercased column',
    example: 'mayra@',
  })
  @IsOptional()
  @IsString()
  @MaxLength(320)
  email?: string;

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

// ── Request DTOs ──────────────────────────────────────────────────────────────

/**
 * The ReviewRequestSettings slice carried on the same PATCH (H-04: one
 * switchboard, no second screen). Bounds mirror UpdateReviewRequestsDto —
 * these fields are written to the review_request_settings row, never to
 * email_settings. NOT nullable: that table's columns have NOT NULL defaults,
 * so there is no "clear back to fallback" to express.
 */
export class UpdateReviewSettingsSliceDto {
  @ApiPropertyOptional({ example: false, description: 'Master switch.' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ example: 10, minimum: 0, maximum: 23 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  firstSendLocalHour?: number;

  @ApiPropertyOptional({ example: 1, minimum: 0, maximum: 14 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(14)
  firstSendDelayDays?: number;

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  reminderAfterDays?: number;

  @ApiPropertyOptional({ example: 30, minimum: 1, maximum: 180 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(180)
  giveUpAfterDays?: number;
}

/**
 * PATCH /email/settings. Every email-settings field is tri-state: absent =
 * untouched, null = clear the override (back to env/built-in), value =
 * store. `@IsOptional()` deliberately admits null (class-validator skips the
 * remaining validators for null), which is exactly the clear semantics.
 *
 * NO booking-email switch exists here — see the file JSDoc.
 */
export class UpdateEmailSettingsDto {
  @ApiPropertyOptional({
    example: true,
    nullable: true,
    description: 'MK-1 marketing switch (null → MK1_ENABLED env, default off)',
  })
  @IsOptional()
  @IsBoolean()
  marketingEnabled?: boolean | null;

  @ApiPropertyOptional({
    example: true,
    nullable: true,
    description:
      'Onboarding nudges OB-3…OB-8 (null → built-in on). Off = "not yet": nothing is written and nobody is skipped permanently.',
  })
  @IsOptional()
  @IsBoolean()
  onboardingEnabled?: boolean | null;

  @ApiPropertyOptional({
    example: false,
    nullable: true,
    description: 'OB-7 calendar email (null → CALENDAR_SYNC_AVAILABLE env)',
  })
  @IsOptional()
  @IsBoolean()
  calendarEmailEnabled?: boolean | null;

  @ApiPropertyOptional({
    example: true,
    nullable: true,
    description: 'OB-8 photo-partner block (null → built-in on, decision D6)',
  })
  @IsOptional()
  @IsBoolean()
  ob8PartnerOffer?: boolean | null;

  @ApiPropertyOptional({
    example: 'sales@islandtours.com',
    nullable: true,
    description: 'Sales-pipeline inbox (null → SALES_EMAIL ?? ADMIN_EMAIL env)',
  })
  @IsOptional()
  @Matches(EMAIL_SHAPE, { message: 'salesEmail must be an email address' })
  @MaxLength(320)
  salesEmail?: string | null;

  @ApiPropertyOptional({
    example: 'hello@islandtours.com',
    nullable: true,
    description: 'Default Reply-To on every send (null → MAIL_REPLY_TO env)',
  })
  @IsOptional()
  @Matches(EMAIL_SHAPE, { message: 'mailReplyTo must be an email address' })
  @MaxLength(320)
  mailReplyTo?: string | null;

  @ApiPropertyOptional({
    example: 'founder@islandtours.com',
    nullable: true,
    description:
      'OB-6 Reply-To (null → OB6_REPLY_TO env, then the default reply-to)',
  })
  @IsOptional()
  @Matches(EMAIL_SHAPE, { message: 'ob6ReplyTo must be an email address' })
  @MaxLength(320)
  ob6ReplyTo?: string | null;

  @ApiPropertyOptional({
    example: 48,
    nullable: true,
    minimum: 1,
    maximum: 720,
    description: 'OB-3 delay after approval, hours (null → 48)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  ob3DelayHours?: number | null;

  @ApiPropertyOptional({
    example: 7,
    nullable: true,
    minimum: 1,
    maximum: 90,
    description: 'OB-4 delay after approval, days (null → 7)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  ob4DelayDays?: number | null;

  @ApiPropertyOptional({
    example: 14,
    nullable: true,
    minimum: 1,
    maximum: 90,
    description: 'OB-6 delay after approval, days (null → 14)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  ob6DelayDays?: number | null;

  @ApiPropertyOptional({
    example: 3,
    nullable: true,
    minimum: 1,
    maximum: 90,
    description: 'OB-7 delay after first tour live, days (null → 3)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  ob7AfterLiveDays?: number | null;

  @ApiPropertyOptional({
    example: 7,
    nullable: true,
    minimum: 1,
    maximum: 90,
    description: 'OB-8 delay after first tour live, days (null → 7)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  ob8AfterLiveDays?: number | null;

  @ApiPropertyOptional({
    example: 2,
    nullable: true,
    minimum: 1,
    maximum: 90,
    description:
      'INT1R threshold: business days an operator may sit PENDING (null → 2)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  pendingReminderBusinessDays?: number | null;

  @ApiPropertyOptional({
    example: 'tue,wed,thu',
    nullable: true,
    description:
      'Lifecycle-nudge weekdays, csv of day names, ≥1 (null → "tue,wed,thu")',
  })
  @IsOptional()
  @Matches(WEEKDAYS_CSV, {
    message:
      'windowWeekdays must be a comma-separated list of day names (mon…sun) with at least one day',
  })
  windowWeekdays?: string | null;

  @ApiPropertyOptional({
    example: 9,
    nullable: true,
    minimum: 0,
    maximum: 23,
    description:
      'Window opening hour, America/Curacao, inclusive (null → 9). Must stay below the closing hour.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  windowStartHour?: number | null;

  @ApiPropertyOptional({
    example: 11,
    nullable: true,
    minimum: 1,
    maximum: 24,
    description:
      'Window closing hour, America/Curacao, exclusive (null → 11). Must stay above the opening hour.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  windowEndHour?: number | null;

  @ApiPropertyOptional({
    example: 72,
    nullable: true,
    minimum: 1,
    maximum: 720,
    description: 'MK-1 trigger delay after tour end, hours (null → 72)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  mk1DelayHours?: number | null;

  @ApiPropertyOptional({
    type: UpdateReviewSettingsSliceDto,
    description:
      'BK-3/BK-3R schedule — written to ReviewRequestSettings, same switchboard',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateReviewSettingsSliceDto)
  review?: UpdateReviewSettingsSliceDto;
}

export class TestSendDto {
  @ApiProperty({
    enum: EmailTemplateKey,
    example: 'BK1_CONFIRMATION',
    description:
      'Any of the 18 template keys — booking templates included (a test-send is not a switch)',
  })
  @IsEnum(EmailTemplateKey)
  templateKey!: EmailTemplateKey;
}
