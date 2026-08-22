import { Module } from '@nestjs/common';
import { MailModule } from '@/mail/mail.module';
import { CustomerProvisioningService } from './customer-provisioning.service';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

/**
 * Customers module - marks booking contacts as customers of tour operators.
 *
 * `CustomerProvisioningService` is invoked fire-and-forget from the booking
 * lifecycle (confirmation, contact update, cancellation) to findOrCreate the
 * Role.USER account, backfill-link bookings by contactEmail, and keep the
 * `customers` (user x operator) aggregates fresh. It sends NO email: since
 * 2026-07-28 travellers are passwordless, so the account is a CRM record
 * nobody signs into. The operator-facing "Customers" controller lives here
 * too: a scoped list plus a bulk email.
 */
@Module({
  imports: [MailModule],
  controllers: [CustomersController],
  providers: [CustomerProvisioningService, CustomersService],
  exports: [CustomerProvisioningService, CustomersService],
})
export class CustomersModule {}
