import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Currency, PaymentModel, SettlementStatus } from '@prisma/client';
import { IsLocalDate } from '@/common/validators/is-local-date.validator';

/** HOW a booking settles - derived from its payment model (not stored). */
export enum SettlementMethod {
  SELF_SETTLING = 'SELF_SETTLING',
  OPERATOR_PAYOUT = 'OPERATOR_PAYOUT',
  COMMISSION_INVOICE = 'COMMISSION_INVOICE',
}

/** Derive the settlement method from a booking's payment model (single source). */
export function settlementMethodFor(model: PaymentModel): SettlementMethod {
  if (model === PaymentModel.PAID_IN_FULL) {
    return SettlementMethod.OPERATOR_PAYOUT;
  }
  if (model === PaymentModel.OPERATOR_FULL) {
    return SettlementMethod.COMMISSION_INVOICE;
  }
  return SettlementMethod.SELF_SETTLING; // operator_link / on_arrival
}

// ── Response ─────────────────────────────────────────────────────────────────

/**
 * One operator-payout row, joined to its booking. Every row is a `paid_in_full`
 * booking - the only model where Island Tours holds money it owes the operator.
 */
export class SettlementListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() bookingId!: string;
  @ApiProperty({ example: 'IT-2026-0A1B2C' }) displayRef!: string;
  @ApiProperty() operatorId!: string;
  @ApiPropertyOptional({ nullable: true }) operatorName!: string | null;
  @ApiPropertyOptional({ nullable: true }) tourName!: string | null;

  // All amounts EUR (rule #22 / settlement ledger).
  @ApiProperty({
    example: '100.00',
    description: 'The booking total Island Tours collected at checkout (EUR).',
  })
  amountCollected!: string;
  @ApiProperty({
    example: '20.00',
    description: 'The commission Island Tours keeps (EUR).',
  })
  commissionOwed!: string;
  @ApiProperty({
    example: '80.00',
    description:
      'The payout owed to the operator (collected - commission, EUR). Zero on a ' +
      'REVERSED row (booking cancelled - the obligation was voided).',
  })
  netPosition!: string;
  @ApiPropertyOptional({
    nullable: true,
    example: '80.00',
    description: 'The amount actually paid out (set when marked paid).',
  })
  operatorPayout!: string | null;

  @ApiProperty({
    enum: SettlementStatus,
    description:
      'RECORDED = payout due (money held by Island Tours, not yet paid). ' +
      'PAID_OUT = an admin confirmed the transfer was made. ' +
      'REVERSED = booking cancelled, nothing owed.',
  })
  status!: SettlementStatus;
  @ApiProperty({ enum: Currency }) currency!: Currency;
  @ApiPropertyOptional({
    nullable: true,
    description: 'When the admin marked this payout as paid (ISO UTC).',
  })
  settledAt!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty({
    description:
      'True when this payout is READY TO PAY: still RECORDED, the booking ' +
      'stands, no cancellation request pending, and the free-cancellation ' +
      '(clawback) window has closed. The "Mark as paid" action is only allowed ' +
      'on eligible rows. Computed server-side.',
  })
  payoutEligible!: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'WHEN this payout clears for paying: the booking free-cancellation window ' +
      'close (clawback-safe point), ISO UTC.',
  })
  payoutReleaseAt!: string | null;

  @ApiProperty({
    description:
      'True when this RECORDED payout is HELD by a pending cancellation request ' +
      '(requested, not yet actioned) - a refund may still be owed to the ' +
      'traveller (master 6.4), so it must not be paid until the request is ' +
      'resolved. Render as "On hold". Computed server-side.',
  })
  payoutHeld!: boolean;
}

/** Per-scope roll-up: payout still due vs already paid out (admin-confirmed). */
export class SettlementSummaryDto {
  @ApiProperty({
    description: 'Sum of payouts still due (RECORDED nets, EUR).',
  })
  owedPending!: string;
  @ApiProperty({ description: 'Count of payouts still due.' })
  owedCount!: number;
  @ApiProperty({
    description: 'Sum actually paid out (PAID_OUT operatorPayout, EUR).',
  })
  released!: string;
  @ApiProperty({ description: 'Count of paid-out settlements.' })
  releasedCount!: number;
}

/** Result of a manual mark-paid / mark-unpaid row action. */
export class SettlementActionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: SettlementStatus }) status!: SettlementStatus;
  @ApiPropertyOptional({ nullable: true, example: '80.00' })
  operatorPayout!: string | null;
  @ApiPropertyOptional({ nullable: true }) settledAt!: string | null;
}

export class ListSettlementsResponseDto {
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty({ type: [SettlementListItemDto] })
  data!: SettlementListItemDto[];
}

// ── Query ────────────────────────────────────────────────────────────────────

export class ListSettlementsQueryDto {
  @ApiPropertyOptional({ description: 'Filter to one operator (admin).' })
  @IsOptional()
  @IsString()
  operatorId?: string;

  @ApiPropertyOptional({
    description: 'Search by booking reference (case-insensitive contains).',
    example: 'IT-2026',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: SettlementStatus })
  @IsOptional()
  @IsEnum(SettlementStatus)
  status?: SettlementStatus;

  @ApiPropertyOptional({
    example: '2026-07-01',
    description: 'Recorded on/after this day (UTC).',
  })
  @IsOptional()
  @IsLocalDate()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-07-31',
    description: 'Recorded on/before this day (UTC).',
  })
  @IsOptional()
  @IsLocalDate()
  to?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
