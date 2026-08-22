import { Global, Module } from '@nestjs/common';
import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';

/**
 * The dashboard inbox (bell, badges, login digest).
 *
 * `@Global` for the same reason MailModule is: notifications are emitted from
 * tours, bookings, reviews, settlements, staff and the nightly jobs. Making
 * each of those import an InboxModule would add six edges to the module graph -
 * and two of them (availability -> tours) would close a cycle. One global
 * provider, injected like a logger.
 *
 * `StaffPermissionsService` comes from the global StaffPermissionsModule, so
 * the fan-out reads the same effective-permission cache the route guards do.
 */
@Global()
@Module({
  controllers: [InboxController],
  providers: [InboxService],
  exports: [InboxService],
})
export class InboxModule {}
