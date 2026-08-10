import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // Explicit pool + timeouts (hardening F6). Before this, everything ran on
    // node-postgres DEFAULTS: max 10 connections and NO timeouts - under a
    // booking rush, waiters exhausted the pool (the sweeper shares it), the
    // 11th request queued forever, and a stuck transaction could hold row
    // locks indefinitely. Every value below is a fail-fast bound, not a
    // performance knob; F7's load test is what tunes the numbers.
    //
    // Postgres sizing rule: max_connections must cover
    // (DB_POOL_MAX + 10) x app processes + headroom for cron/psql/studio -
    // the +10 is the second pool in auth-prisma.client.ts (Better Auth).
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      // Pool ceiling. More connections than CPU can serve makes Postgres
      // slower, not faster - raise only with F7 numbers in hand.
      max: Number(process.env.DB_POOL_MAX ?? 25),
      // Waiting for a pool slot: fail fast instead of queueing forever.
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      // No single statement may run longer (server-side, per connection).
      statement_timeout: 10_000,
      // A transaction left open doing nothing gets killed, freeing its row
      // locks - the backstop against a wedged process holding the hot
      // departure row.
      idle_in_transaction_session_timeout: 15_000,
      // Waiting on a contended row caps here, freeing the pool slot. The
      // reserve path maps the resulting 55P03 to a 503 "try again" (never a
      // 500) - see BookingsService.isLockTimeout.
      lock_timeout: 3_000,
    });
    super({
      adapter,
      log:
        process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
