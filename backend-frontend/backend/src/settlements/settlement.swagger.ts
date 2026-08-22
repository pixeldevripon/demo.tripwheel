import { applyDecorators } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import {
  ConflictErrorDto,
  NotFoundErrorDto,
} from '@/common/dto/error-responses.dto';
import {
  ListSettlementsResponseDto,
  SettlementActionResponseDto,
  SettlementSummaryDto,
} from './dto/settlement.dto';

export const ApiListSettlementsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'List operator-payout ledger rows',
      description:
        'The operator-payout ledger (EUR). One row per confirmed paid_in_full ' +
        'booking - the only model where Island Tours holds money it owes the ' +
        'operator. ADMIN sees every operator (filterable by operator); a ' +
        'TOUR_OPERATOR is scoped to their own. Filter by status / recorded-date ' +
        'range. Each row carries `payoutEligible` (ready to pay), `payoutHeld` ' +
        '(cancellation request pending) and `payoutReleaseAt` (when the clawback ' +
        'window closes) so the state needs no guessing.',
    }),
    ApiOkResponse({ type: ListSettlementsResponseDto }),
  );

export const ApiSettlementSummaryDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Settlement roll-up (payout due vs paid out)',
      description:
        'Totals for the settlements header: EUR still owed out to operators ' +
        '(payout due) and EUR actually paid out (admin-confirmed). Same ' +
        'operator-scoping as the list, and the same owed predicate as the ' +
        'analytics `payoutDueEur` card - the figures always match.',
    }),
    ApiOkResponse({ type: SettlementSummaryDto }),
  );

export const ApiMarkSettlementPaidDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Mark a payout as paid (admin, manual)',
      description:
        'Confirms the operator payout was transferred (v1 payout is a manual ' +
        'bank transfer). Flips RECORDED -> PAID_OUT and stamps `operatorPayout` ' +
        '+ `settledAt`. Only allowed on an eligible row: the booking stands, no ' +
        'cancellation request is pending, and the free-cancellation (clawback) ' +
        'window has closed. Each blocker returns a specific 409 message.',
    }),
    ApiOkResponse({ type: SettlementActionResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiConflictResponse({ type: ConflictErrorDto }),
  );

export const ApiMarkSettlementUnpaidDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Revert a mis-clicked mark-paid (admin)',
      description:
        'Flips PAID_OUT back to RECORDED (payout due) and clears the payout ' +
        'stamp. Only for rows previously marked paid; REVERSED rows stay ' +
        'reversed.',
    }),
    ApiOkResponse({ type: SettlementActionResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiConflictResponse({ type: ConflictErrorDto }),
  );
