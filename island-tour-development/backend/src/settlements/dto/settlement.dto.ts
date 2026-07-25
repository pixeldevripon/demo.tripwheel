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

/** One settlement-ledger row for the admin dashboard, joined to its booking. */
export class SettlementListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() bookingId!: string;
  @ApiProperty({ example: 'IT-2026-0A1B2C' }) displayRef!: string;
  @ApiProperty() operatorId!: string;
  @ApiPropertyOptional({ nullable: true }) operatorName!: string | null;
  @ApiPropertyOptional({ nullable: true }) tourName!: string | null;
  @ApiProperty({ enum: PaymentModel }) paymentModel!: PaymentModel;

  // All amounts EUR (rule #22 / settlement ledger).
  @ApiProperty({ example: '100.00' }) amountCollected!: string;
  @ApiProperty({ example: '20.00' }) commissionOwed!: string;
  @ApiProperty({
    example: '80.00',
    description: '+ = Island Tours owes the operator; - = operator owes IT.',
  })
  netPosition!: string;
  @ApiPropertyOptional({ nullable: true, example: '80.00' })
  operatorPayout!: string | null;

  @ApiProperty({ enum: SettlementStatus }) status!: SettlementStatus;
  @ApiProperty({ enum: Currency }) currency!: Currency;
  @ApiPropertyOptional({ nullable: true }) settledAt!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty({
    description:
      'True when this row is a paid_in_full payout owed to the operator that is ' +
      'past its clawback (free-cancellation) window and still RECORDED - i.e. ready ' +
      'to release/pay. Computed server-side.',
  })
  payoutEligible!: boolean;

  @ApiProperty({
    enum: SettlementMethod,
    description:
      'HOW this booking settles: SELF_SETTLING (deposit models - nothing to move), ' +
      'OPERATOR_PAYOUT (paid_in_full - IT pays the operator the net), ' +
      'COMMISSION_INVOICE (operator_full - IT invoices the operator, v2).',
  })
  method!: SettlementMethod;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'WHEN the operator payout releases: the booking free-cancellation window ' +
      'close (clawback-safe point), ISO UTC. Only for OPERATOR_PAYOUT; null otherwise.',
  })
  payoutReleaseAt!: string | null;

  @ApiProperty({
    description:
      'True when this RECORDED paid_in_full payout is HELD by a pending ' +
      'cancellation request (requested, not yet actioned). The release cron ' +
      'skips it until the request is resolved, since a refund may still be owed ' +
      'to the traveller (master 6.4). Render as "On hold" instead of "Ready to ' +
      'pay out". Computed server-side.',
  })
  payoutHeld!: boolean;
}

/** Per-scope roll-up: how much is owed out (pending) vs already released. */
export class SettlementSummaryDto {
  @ApiProperty({ description: 'Sum of paid_in_full net still RECORDED (EUR).' })
  owedPending!: string;
  @ApiProperty({ description: 'Count of settlements still owed a payout.' })
  owedCount!: number;
  @ApiProperty({ description: 'Sum of operatorPayout on PAID_OUT rows (EUR).' })
  released!: string;
  @ApiProperty({ description: 'Count of released (PAID_OUT) settlements.' })
  releasedCount!: number;
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

  @ApiPropertyOptional({ enum: SettlementStatus })
  @IsOptional()
  @IsEnum(SettlementStatus)
  status?: SettlementStatus;

  @ApiPropertyOptional({ enum: PaymentModel })
  @IsOptional()
  @IsEnum(PaymentModel)
  paymentModel?: PaymentModel;

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
