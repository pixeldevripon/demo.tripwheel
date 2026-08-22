import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';

import { AuthenticatedUser } from '@/auth/decorators/authenticated-user.decorator';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import type { TypedAuthUser } from '@/auth/auth.types';

import { CustomersService } from './customers.service';
import { EmailCustomersDto, ListCustomersQueryDto } from './dto/customer.dto';
import {
  ApiEmailCustomersDocs,
  ApiListCustomersDocs,
  ApiSendReviewRequestDocs,
} from './customers.swagger';

/**
 * CustomersController - who has booked, and who still owes a review.
 *
 * `VIEW_USERS` decides WHO may see a customer list; the service decides WHOSE.
 * An operator is pinned to their own customers after every other filter, so no
 * query can widen the scope.
 *
 * Emailing needs `MANAGE_USERS`, which operators do not hold: reaching into a
 * traveller's inbox is an Island Tours action at launch.
 */
@ApiTags('Customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  // Conflict #7: this surface is money by nature, so it requires
  // VIEW_BOOKING_FINANCIALS ON TOP of its own permission. Without the pairing a
  // "field guide" designation granted only 'View users' would read back exactly
  // the amounts the manifest projection hides on /bookings.
  @Get()
  @RequirePermissions(Permission.VIEW_USERS, Permission.VIEW_BOOKING_FINANCIALS)
  @ApiListCustomersDocs()
  list(
    @Query() query: ListCustomersQueryDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.customers.list(query, { id: user.id, role: user.role });
  }

  /**
   * Throttled hard: this is the one endpoint here that reaches real inboxes,
   * and a loop calling it is a mailing-list incident rather than a slow page.
   */
  /**
   * Send ONE customer a review request by hand - the manual twin of the hourly
   * job. `VIEW_USERS`, not `MANAGE_USERS`: this sends a transactional email the
   * guest is already expecting, to their own booking, rather than composing
   * arbitrary copy - so an operator may nudge their own customer.
   */
  @Throttle({ medium: { limit: 20, ttl: 60000 } })
  @Post(':id/review-request')
  @RequirePermissions(Permission.VIEW_USERS)
  @ApiSendReviewRequestDocs()
  reviewRequest(
    @Param('id') id: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.customers.sendReviewRequest(id, {
      id: user.id,
      role: user.role,
    });
  }

  @Throttle({ medium: { limit: 3, ttl: 60000 } })
  @Post('email')
  @RequirePermissions(Permission.MANAGE_USERS)
  @ApiEmailCustomersDocs()
  email(
    @Body() dto: EmailCustomersDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.customers.email(dto, { id: user.id, role: user.role });
  }
}
