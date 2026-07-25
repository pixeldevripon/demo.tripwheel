import { applyDecorators } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import {
  ListSettlementsResponseDto,
  SettlementSummaryDto,
} from './dto/settlement.dto';

export const ApiListSettlementsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'List settlement-ledger rows',
      description:
        'The money-movement ledger (one row per confirmed booking, EUR). ADMIN sees ' +
        'every operator; a TOUR_OPERATOR is scoped to their own. Filter by operator / ' +
        'status / payment model / recorded-date range. Each row carries `payoutEligible` ' +
        '(a paid_in_full net owed to the operator, past its clawback window, ready to ' +
        'release). `netPosition` sign: + = Island Tours owes the operator; - = operator owes IT.',
    }),
    ApiOkResponse({ type: ListSettlementsResponseDto }),
  );

export const ApiSettlementSummaryDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Settlement roll-up (owed pending vs released)',
      description:
        'Totals for the settlements header: EUR still owed out to operators ' +
        '(paid_in_full nets not yet released) and EUR already released. Same ' +
        'operator-scoping as the list.',
    }),
    ApiOkResponse({ type: SettlementSummaryDto }),
  );
