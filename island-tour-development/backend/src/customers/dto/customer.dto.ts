import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// ════════════════════════════════════════════════════════════════════════════
// Response DTOs
// ════════════════════════════════════════════════════════════════════════════

export class CustomerListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() email!: string;
  @ApiPropertyOptional({ nullable: true, example: 'Anna Meijer' })
  name!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    example: 'Blue Bay Charters',
    description:
      "The operator this relationship belongs to. Always the caller's own " +
      'operator on an operator-scoped read.',
  })
  operatorName!: string | null;
  @ApiProperty() operatorId!: string;
  @ApiProperty({ example: 3 }) bookingsCount!: number;
  @ApiProperty({
    example: '412.50',
    description: 'EUR-normalized lifetime spend, as a decimal string.',
  })
  totalSpendEur!: string;
  @ApiPropertyOptional({ nullable: true }) firstBookingAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) lastBookingAt!: string | null;
  @ApiProperty({
    example: 2,
    description: 'Approved reviews this customer has left for this operator.',
  })
  reviewsLeft!: number;
  @ApiProperty({
    example: 1,
    description:
      'Completed bookings still awaiting a review - the "who could I ask" ' +
      'number, and the reason this list is useful rather than decorative.',
  })
  awaitingReview!: number;
}

export class PaginatedCustomersDto {
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty({ type: [CustomerListItemDto] })
  data!: CustomerListItemDto[];
}

export class SendReviewRequestResultDto {
  @ApiProperty({ example: true }) sent!: boolean;
  @ApiPropertyOptional({ nullable: true, example: 'ada@example.com' })
  email?: string;
  @ApiPropertyOptional({
    nullable: true,
    example: 'no_booking_awaiting_review',
    description:
      'Why nothing was sent: `no_booking_awaiting_review`, `no_email`, or ' +
      '`send_failed`.',
  })
  reason?: string;
}

export class CustomerEmailResultDto {
  @ApiProperty({ example: 12 }) sent!: number;
  @ApiProperty({ example: 0 }) failed!: number;
  @ApiProperty({
    example: 1,
    description:
      'Recipients skipped because the same address appeared twice across ' +
      'operators - a person is emailed once, not once per relationship.',
  })
  deduped!: number;
}

// ════════════════════════════════════════════════════════════════════════════
// Query / Request DTOs
// ════════════════════════════════════════════════════════════════════════════

export class ListCustomersQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Matches name or email.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    description:
      'Narrow to one operator. IGNORED for an operator caller, whose scope is ' +
      'already their own - a supplied value can never widen it.',
  })
  @IsOptional()
  @IsUUID()
  operatorId?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Only customers with a completed booking awaiting a review.',
  })
  @IsOptional()
  @Type(() => Boolean)
  awaitingReviewOnly?: boolean;
}

export class EmailCustomersDto {
  @ApiProperty({
    type: [String],
    description: 'Customer row ids to email. Addresses are deduplicated.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  customerIds!: string[];

  @ApiProperty({ example: 'A little favour?' })
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  subject!: string;

  @ApiProperty({
    example: 'Hi {firstName}, we would love to hear how your trip went.',
    description:
      'Plain text. `{firstName}` is substituted per recipient; everything ' +
      'else is sent verbatim and HTML-escaped.',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  body!: string;
}
