import { Locale } from '@/common/constants/locales';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { TripResponseDto } from '@/trips/dto/trip.dto';

export class SearchQueryDto {
  @ApiProperty({ example: 'catamaran', description: 'Search term (min 2 chars). Matches tour title/description/highlights + category & hub names.' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q!: string;

  @ApiPropertyOptional({ example: 'curacao', description: 'Scope results to a destination slug (omit for global search)' })
  @IsOptional()
  @IsString()
  destinationSlug?: string;

  @ApiPropertyOptional({ enum: Locale, default: 'en' })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 20;
}

export class SearchResultsResponseDto {
  @ApiProperty({ example: 7 }) total!: number;
  @ApiProperty({ example: 1 }) page!: number;
  @ApiProperty({ example: 20 }) limit!: number;
  @ApiProperty({ example: 'catamaran' }) query!: string;
  @ApiProperty({ type: [TripResponseDto] }) data!: TripResponseDto[];
}
