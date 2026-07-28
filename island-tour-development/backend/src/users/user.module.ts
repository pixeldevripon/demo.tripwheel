import { Module } from '@nestjs/common';
import { RateLimitModule } from '@/common/rate-limit.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  // RateLimitModule: the password-change request caps confirmation emails per
  // account through the shared process-wide TargetRateLimiter.
  imports: [RateLimitModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
