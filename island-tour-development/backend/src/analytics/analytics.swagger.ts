import { applyDecorators } from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import {
  ForbiddenErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';

import { DashboardStatsDto } from './dto/analytics.dto';

export function ApiDashboardStatsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Dashboard overview statistics',
      description: [
        'Every KPI, distribution and trend on the dashboard overview, computed from live rows.',
        '',
        'Scope follows the caller: ADMIN/STAFF/EDITOR see the whole platform, a TOUR_OPERATOR sees only its own tours, bookings and payments.',
        '',
        'All money is EUR-normalized using each booking’s snapshotted `fxRateToEur`, so a mixed-currency ledger sums correctly. `commissionEur` is the platform’s actual earnings; `gmvEur` is gross merchandise value.',
        '',
        'No value here is estimated or extrapolated: a zero means the query genuinely returned zero.',
        '',
        '`from`/`to` narrow the reporting window. They filter FLOWS only (money recognized, bookings created, customers acquired, tours published), each on the column that defines it - earnings on `utcRedeemedAt`, volume on `createdAt`, cash on the payment date. STOCKS (`trips.total`, `trips.live`, `trips.byStatus`, `trips.withBookings`, `bookings.upcoming`, `customers.registered`) are current state and are NEVER filtered, because a date-bounded stock is not a quantity.',
        '',
        'Growth fields compare the selected range against the equal-length window immediately before it. With no range supplied the response is all-time and growth falls back to this month against last month. The applied window comes back on `range`.',
      ].join('\n'),
    }),
    ApiQuery({
      name: 'from',
      required: false,
      type: String,
      description:
        'Inclusive start of the reporting window, YYYY-MM-DD. Omit both bounds for all time.',
    }),
    ApiQuery({
      name: 'to',
      required: false,
      type: String,
      description:
        'Inclusive end of the reporting window, YYYY-MM-DD. The whole of this day is included.',
    }),
    ApiQuery({
      name: 'granularity',
      required: false,
      enum: ['month', 'day'],
      description: 'Bucket size for the trend series. Defaults to month.',
    }),
    ApiQuery({
      name: 'buckets',
      required: false,
      type: Number,
      description:
        'How many trend buckets to return (2-24). Defaults to 6. Ignored when `from` is set - the series is then sized to span the range.',
    }),
    ApiOkResponse({ type: DashboardStatsDto }),
    ApiUnauthorizedResponse({ type: UnauthorizedErrorDto }),
    ApiForbiddenResponse({ type: ForbiddenErrorDto }),
  );
}
