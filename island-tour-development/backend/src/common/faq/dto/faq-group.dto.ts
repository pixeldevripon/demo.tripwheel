import { Locale } from '@/common/constants/locales';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

// Grouped FAQ DTOs — shared across every entity that owns FAQs (destination,
// category, hub, collection). A logical FAQ is one faqGroupId whose per-locale
// rows share the same question; the English row is the base and the other locales
// are translations of it. This powers the "add in English, then translate" editor.

export class FaqTranslationEntryDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'What is the best time to visit?' })
  question!: string;

  @ApiProperty({
    example:
      'It is a year-round destination, with the calmest seas from January to June.',
  })
  answer!: string;

  @ApiProperty({ example: 0 })
  displayOrder!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ enum: Locale, example: Locale.en })
  locale!: Locale;

  @ApiProperty({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    nullable: true,
  })
  faqGroupId!: string | null;
}

export class FaqGroupResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  faqGroupId!: string;

  @ApiProperty({ example: 0 })
  displayOrder!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({
    type: [FaqTranslationEntryDto],
    description: 'Per-locale rows of this FAQ (English is the base).',
  })
  translations!: FaqTranslationEntryDto[];
}

export class CreateFaqGroupDto {
  @ApiProperty({ example: 'What is the best time to visit?' })
  @IsString()
  @MinLength(5)
  question!: string;

  @ApiProperty({
    example:
      'It is a year-round destination, with the calmest seas from January to June.',
  })
  @IsString()
  @MinLength(10)
  answer!: string;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number = 0;
}

export class UpsertFaqTranslationDto {
  // Blank = cleared for this locale (stored '', the row survives and the
  // page falls back to English per field). English is guarded in the
  // service - see `clearableField`.
  @ApiProperty({ example: '¿Cuál es la mejor época para visitar?' })
  @IsString()
  question!: string;

  @ApiProperty({
    example:
      'Es un destino para todo el año, con el mar más tranquilo de enero a junio.',
  })
  @IsString()
  answer!: string;
}

export class UpdateFaqGroupDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
