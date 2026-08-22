import { ApiPropertyOptional } from '@nestjs/swagger';
import { Locale } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

/**
 * Query for the four `GET /:id/page-content` routes (category, destination,
 * hub, collection), which serve two callers with opposite needs:
 *
 * - the DASHBOARD editor must see exactly what is stored for that locale, or
 *   the admin edits English text in a Dutch box and saves it as Dutch;
 * - a PUBLIC page must never render a blank where English exists.
 *
 * Hence the opt-in: `fallback=true` merges the row field by field over the
 * English one. Default false keeps the editor's raw read untouched.
 */
export class PageContentQueryDto {
  @ApiPropertyOptional({
    description: 'Content locale',
    enum: Locale,
    default: Locale.en,
  })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;

  @ApiPropertyOptional({
    description:
      'Fill empty fields from English (public pages). Off by default so the dashboard editor reads the locale raw.',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  fallback?: boolean = false;
}
