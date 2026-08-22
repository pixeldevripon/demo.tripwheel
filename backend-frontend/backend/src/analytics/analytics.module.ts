import { Module } from '@nestjs/common';

import { FxModule } from '@/fx/fx.module';

import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  // FxModule supplies the single EUR->USD rate used for dual-currency display.
  imports: [FxModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
