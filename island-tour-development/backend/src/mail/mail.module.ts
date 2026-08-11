import { Global, Module } from '@nestjs/common';
import { EmailLogService } from './email-log.service';
import { EmailPreferencesController } from './email-preferences.controller';
import { EmailPreferencesService } from './email-preferences.service';
import { MailService } from './mail.service';
import { NextAdventureEmailsService } from './next-adventure-emails.service';
import { OnboardingEmailsService } from './onboarding-emails.service';

@Global()
@Module({
  controllers: [EmailPreferencesController],
  providers: [
    MailService,
    EmailLogService,
    EmailPreferencesService,
    // WP-D: lives here (not WorkersModule) so the sweep tick, the outbox
    // consumer and OperatorsService can all inject it with zero new module
    // imports — it reads operators/tours via Prisma, keeping the graph acyclic.
    OnboardingEmailsService,
    // WP-G: same placement rationale — the sweep tick reaches it with zero
    // new module imports, and it reads bookings/tours via Prisma only.
    NextAdventureEmailsService,
  ],
  exports: [
    MailService,
    EmailLogService,
    EmailPreferencesService,
    OnboardingEmailsService,
    NextAdventureEmailsService,
  ],
})
export class MailModule {}
