import { Module } from '@nestjs/common';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuthModule } from '@/auth/auth.module';
import { MailModule } from '@/mail/mail.module';
import { UserModule } from '@/users/user.module';
import { SettingsModule } from './settings/settings.module';
import { OperatorsModule } from './operators/operators.module';

// NOTE: ThrottlerModule and ThrottlerGuard live in AuthModule so the rate-limit
// guard fires before session validation on every request. See auth.module.ts.

@Module({
  imports: [PrismaModule, AuthModule, MailModule, UserModule, SettingsModule, OperatorsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

