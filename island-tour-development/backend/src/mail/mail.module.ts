import { Global, Module } from '@nestjs/common';
import { EmailLogService } from './email-log.service';
import { EmailPreferencesController } from './email-preferences.controller';
import { EmailPreferencesService } from './email-preferences.service';
import { MailService } from './mail.service';

@Global()
@Module({
  controllers: [EmailPreferencesController],
  providers: [MailService, EmailLogService, EmailPreferencesService],
  exports: [MailService, EmailLogService, EmailPreferencesService],
})
export class MailModule {}
