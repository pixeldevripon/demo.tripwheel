import { Locale } from '@/common/constants/locales';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// Page content section DTOs - shared across every entity that owns authored
// heading + body blocks. A logical section is one sectionGroupId whose per-locale
// rows are translations of each other; the English row is the base and carries the
// group-level attributes (displayOrder, isActive, anchor, sectionKey). Same
// "author in English, then translate" editor shape as the grouped FAQ DTOs.

// ── Response ────────────────────────────────────────────────────────────────────

export class PageContentSectionTranslationEntryDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'Top things to do' })
  heading!: string;

  @ApiProperty({
    example:
      'Sail to Klein Curacao at sunrise, drift over the reef at Playa Piskado, then walk the Willemstad quays after dark.',
  })
  body!: string;

  @ApiProperty({ enum: Locale, example: Locale.en })
  locale!: Locale;
}

export class PageContentSectionResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  sectionGroupId!: string;

  @ApiProperty({
    example: 'top-things',
    nullable: true,
    description:
      'Stable editorial slug. Set on seeded sections so the seed can re-upsert them and the frontend can map one back to the bundled dictionary label it replaced. Null on admin-created sections.',
  })
  sectionKey!: string | null;

  @ApiProperty({
    example: 'experiences',
    nullable: true,
    description:
      'In-page jump target without the leading "#". Null renders the section as plain copy instead of a link.',
  })
  anchor!: string | null;

  @ApiProperty({ example: 0 })
  displayOrder!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({
    type: [PageContentSectionTranslationEntryDto],
    description: 'Per-locale rows of this section (English is the base).',
  })
  translations!: PageContentSectionTranslationEntryDto[];
}

// ── Request ─────────────────────────────────────────────────────────────────────

export class CreatePageContentSectionDto {
  @ApiProperty({ example: 'Top things to do' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  heading!: string;

  @ApiProperty({
    example:
      'Sail to Klein Curacao at sunrise, drift over the reef at Playa Piskado, then walk the Willemstad quays after dark.',
  })
  @IsString()
  @MinLength(10)
  body!: string;

  @ApiPropertyOptional({
    example: 'experiences',
    description:
      'In-page jump target WITHOUT the leading "#". Lowercase letters, digits and hyphens only.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'anchor must be a slug (lowercase letters, digits and hyphens) with no leading "#"',
  })
  @MaxLength(60)
  anchor?: string;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number = 0;
}

export class UpsertPageContentSectionTranslationDto {
  @ApiProperty({ example: 'Wat je moet doen' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  heading!: string;

  @ApiProperty({
    example:
      'Vaar bij zonsopgang naar Klein Curacao, drijf over het rif bij Playa Piskado en loop na zonsondergang langs de kades van Willemstad.',
  })
  @IsString()
  @MinLength(10)
  body!: string;
}

export class UpdatePageContentSectionDto {
  @ApiPropertyOptional({
    example: 'experiences',
    description: 'Send an empty string to clear the anchor.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/, {
    message:
      'anchor must be a slug (lowercase letters, digits and hyphens) with no leading "#"',
  })
  @MaxLength(60)
  anchor?: string;

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
