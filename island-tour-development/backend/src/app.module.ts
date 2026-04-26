import { Module } from '@nestjs/common';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuthModule } from '@/auth/auth.module';
import { MailModule } from '@/mail/mail.module';

// NOTE: ThrottlerModule and ThrottlerGuard live in AuthModule so the rate-limit
// guard fires before session validation on every request. See auth.module.ts.

@Module({
  imports: [PrismaModule, AuthModule, MailModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

