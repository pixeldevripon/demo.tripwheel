import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { PrismaModule } from '@/prisma/prisma.module';

// NOTE: ThrottlerModule uses in-memory storage by default.
// In production with multiple instances, swap to Redis storage:
//   pnpm add @nest-lab/throttler-storage-redis
//   storage: new ThrottlerStorageRedisService(redisClient)
// Wire this up in Phase 5 when Redis is added.

@Module({
  imports: [
    PrismaModule,
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'short', ttl: 1_000, limit: 20 }, // burst: 20 req/s
        { name: 'medium', ttl: 60_000, limit: 300 }, // sustained: 300 req/min
        { name: 'long', ttl: 3_600_000, limit: 3_000 }, // hourly cap: 3 000 req/hr
      ],
    }),
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
