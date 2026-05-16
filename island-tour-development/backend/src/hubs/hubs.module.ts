import { Module } from '@nestjs/common';
import { HubController } from './hubs.controller';
import { HubService } from './hubs.service';

@Module({
  controllers: [HubController],
  providers: [HubService],
  exports: [HubService],
})
export class HubsModule {}
