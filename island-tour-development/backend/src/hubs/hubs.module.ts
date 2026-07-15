import { Module } from '@nestjs/common';
import { FxModule } from '@/fx/fx.module';
import { HubController } from './hubs.controller';
import { HubService } from './hubs.service';

@Module({
  imports: [FxModule], // display-rate conversion for public hub card `money` (guide §20.9)
  controllers: [HubController],
  providers: [HubService],
  exports: [HubService],
})
export class HubsModule {}
