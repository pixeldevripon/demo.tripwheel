import { Module } from '@nestjs/common';
import { CalendarFeedsController } from './calendar-feeds.controller';
import { CalendarFeedsService } from './calendar-feeds.service';

@Module({
  controllers: [CalendarFeedsController],
  providers: [CalendarFeedsService],
  exports: [CalendarFeedsService],
})
export class CalendarFeedsModule {}
