import { Module } from '@nestjs/common';
import { DestinationController } from './destinations.controller';
import { DestinationService } from './destinations.service';

@Module({
  controllers: [DestinationController],
  providers: [DestinationService],
  exports: [DestinationService],
})
export class DestinationsModule {}
