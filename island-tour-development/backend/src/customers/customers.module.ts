import { Module } from '@nestjs/common';
import { RateLimitModule } from '@/common/rate-limit.module';
import { MailModule } from '@/mail/mail.module';
import { CustomerProvisioningService } from './customer-provisioning.service';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

/**
 * Customers module - marks booking contacts as customers of tour operators.
 *
 * Currently service-only: `CustomerProvisioningService` is invoked
 * fire-and-forget from the booking lifecycle (confirmation, contact update,
 * cancellation) to findOrCreate the Role.USER account, send the welcome
 * set-password email, backfill-link bookings by contactEmail, and keep the
 * `customers` (user x operator) aggregates fresh. The operator-facing
 * "Customers" controller now lives here: a scoped list plus a bulk email.
 *
 * Uses the process-wide shared `TargetRateLimiter` (RateLimitModule) - the
 * `customer-welcome` bucket keeps its counters isolated from the bookings
 * module's TYP-action buckets within the single instance.
 */
@Module({
  imports: [RateLimitModule, MailModule],
  controllers: [CustomersController],
  providers: [CustomerProvisioningService, CustomersService],
  exports: [CustomerProvisioningService, CustomersService],
})
export class CustomersModule {}
