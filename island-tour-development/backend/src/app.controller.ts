import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AppService } from './app.service';

// ── Per-route throttle examples ──────────────────────────────────────────────
//
// Override global limits on a controller or single route:
//   @Throttle({ short: { limit: 5, ttl: 60_000 } })   // 5 req/min on this route
//
// Tighten auth-sensitive routes (use on login / register / reset-password):
//   @Throttle({ short: { limit: 5, ttl: 60_000 }, medium: { limit: 10, ttl: 60_000 } })
//
// Skip throttling entirely (health checks, payment webhooks):
//   @SkipThrottle()
//
// Skip only specific throttlers:
//   @SkipThrottle({ long: true })
// ─────────────────────────────────────────────────────────────────────────────

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @SkipThrottle()
  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  getHealth() {
    return this.appService.getHealth();
  }
}
