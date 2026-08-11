import { Global, Module } from '@nestjs/common';
import { EmailLogService } from './email-log.service';
import { EmailPreferencesController } from './email-preferences.controller';
import { EmailPreferencesService } from './email-preferences.service';
import { MailService } from './mail.service';
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
  ],
  exports: [
    MailService,
    EmailLogService,
    EmailPreferencesService,
    OnboardingEmailsService,
  ],
})
export class MailModule {}
