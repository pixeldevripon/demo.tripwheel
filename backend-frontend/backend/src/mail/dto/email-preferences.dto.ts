import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EmailAudience,
  EmailSendStatus,
  EmailStream,
  EmailTemplateKey,
} from '@prisma/client';

// ── Response DTOs ─────────────────────────────────────────────────────────────

/**
 * What an unsubscribe token resolves to (GET) and what acting on it returns
 * (POST — same shape, `optedOut` then always true). The email is MASKED: the
 * token arrives in forwarded emails and shared screenshots, so the page it
 * feeds must never disclose the full address.
 */
export class UnsubscribeStatusResponseDto {
  @ApiProperty({
    example: 'j***@example.com',
    description: 'Masked recipient address (first character + domain only)',
  })
  email!: string;

  @ApiProperty({ enum: EmailAudience, example: EmailAudience.OPERATOR })
  audience!: EmailAudience;

  @ApiProperty({
    enum: EmailStream,
    example: EmailStream.LIFECYCLE,
    description: 'The one stream this token opts out of - never all email',
  })
  stream!: EmailStream;

  @ApiProperty({
    example: false,
    description: 'Whether the address is already opted out of this stream',
  })
  optedOut!: boolean;
}

/** One send-log row, as the dashboard email timeline renders it. */
export class EmailSendDto {
  @ApiProperty({ example: '0b6f9c3e-8d1f-4f9a-b1a2-3c4d5e6f7a8b' })
  id!: string;

  @ApiProperty({
    enum: EmailTemplateKey,
    example: EmailTemplateKey.OB3_FIRST_TOUR_HOWTO,
  })
  templateKey!: EmailTemplateKey;

  @ApiProperty({
    example: 'op_9f8e7d6c',
    description:
      'Dedupe scope: booking id or operator id. Admin resends carry a `#resend-{n}` suffix.',
  })
  scopeId!: string;

  @ApiProperty({ example: 'operator@example.com' })
  toEmail!: string;

  @ApiProperty({ enum: EmailStream, example: EmailStream.LIFECYCLE })
  stream!: EmailStream;

  @ApiProperty({ enum: EmailSendStatus, example: EmailSendStatus.SENT })
  status!: EmailSendStatus;

  @ApiPropertyOptional({
    example: 'en',
    nullable: true,
    description: 'Platform locale the copy rendered in (traveller emails)',
  })
  locale!: string | null;

  @ApiPropertyOptional({
    example: '49a3999c-0ce1-4ea6-ab68-afcd6dc2e794',
    nullable: true,
  })
  providerMessageId!: string | null;

  @ApiPropertyOptional({
    example: 'opted-out',
    nullable: true,
    description: 'Why the email deliberately did not go out (SUPPRESSED rows)',
  })
  suppressedReason!: string | null;

  @ApiPropertyOptional({
    example: 'Email send failed: application_error',
    nullable: true,
    description: 'Truncated transport error (FAILED rows)',
  })
  error!: string | null;

  @ApiProperty({ example: '2026-08-11T13:05:00.000Z' })
  createdAt!: Date;
}
