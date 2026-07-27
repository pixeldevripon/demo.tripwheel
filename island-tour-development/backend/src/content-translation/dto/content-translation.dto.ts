import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Locale } from '@prisma/client';

/**
 * Result of a manual "Translate with AI" run (one entity, one locale).
 * `written`/`skipped` count unit x locale pairs - a tour's main copy, each
 * highlight, each FAQ group and so on are separate units.
 */
export class GenerateTranslationResponseDto {
  @ApiProperty({ example: 'tour' })
  entityType!: string;

  @ApiProperty({ example: 'a2f1c9e0-4b7d-4f7e-9c1a-2d3e4f5a6b7c' })
  entityId!: string;

  @ApiProperty({ enum: Locale, example: Locale.es })
  locale!: Locale;

  @ApiProperty({
    example: 12,
    description: 'Units freshly translated and written',
  })
  written!: number;

  @ApiProperty({
    example: 3,
    description:
      'Units left alone: human-edited rows (never overwritten) and rows already built from the current English source',
  })
  skipped!: number;

  @ApiPropertyOptional({
    example: 'not_found',
    description: 'Set when nothing could be attempted',
  })
  reason?: string;
}

/**
 * One-off inline translation (the per-field AI button in the Translation
 * Console). Pure utility: translates the given English text and returns it -
 * NOTHING is persisted; the dashboard fills the form field and the human
 * reviews before saving.
 */
export class TranslateTextDto {
  @ApiProperty({
    example: 'The biggest catamarans on the island.',
    description: 'English source text to translate',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20_000)
  text!: string;

  @ApiProperty({ enum: Locale, example: Locale.nl })
  @IsEnum(Locale)
  targetLocale!: Locale;
}

export class TranslateTextResponseDto {
  @ApiProperty({ example: 'De grootste catamarans van het eiland.' })
  translatedText!: string;
}
