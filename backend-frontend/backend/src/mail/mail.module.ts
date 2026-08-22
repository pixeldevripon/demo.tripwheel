import { Global, Module } from '@nestjs/common';
import { EmailCentreController } from './email-centre.controller';
import { EmailCentreService } from './email-centre.service';
import { EmailLogService } from './email-log.service';
import { EmailPreferencesController } from './email-preferences.controller';
import { EmailPreferencesService } from './email-preferences.service';
import { EmailSettingsService } from './email-settings.service';
import { EmailTestSendService } from './email-test-send.service';
import { MailService } from './mail.service';
import { NextAdventureEmailsService } from './next-adventure-emails.service';
import { OnboardingEmailsService } from './onboarding-emails.service';

@Global()
@Module({
  controllers: [EmailPreferencesController, EmailCentreController],
  providers: [
    MailService,
    EmailLogService,
    EmailPreferencesService,
    // WP-H: the switchboard resolver lives in the global MailModule so every
    // consumer (sweeps, MailService reply-to, INT-1/INT-2 alert paths in
    // operators/tours) injects it with zero new module imports.
    EmailSettingsService,
    EmailCentreService,
    EmailTestSendService,
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
    EmailSettingsService,
    OnboardingEmailsService,
    NextAdventureEmailsService,
  ],
})
export class MailModule {}
