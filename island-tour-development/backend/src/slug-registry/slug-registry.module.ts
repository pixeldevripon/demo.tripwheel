import { Module } from '@nestjs/common';
import { SlugRegistryController } from './slug-registry.controller';
import { SlugRegistryService } from './slug-registry.service';

@Module({
  controllers: [SlugRegistryController],
  providers: [SlugRegistryService],
  exports: [SlugRegistryService],
})
export class SlugRegistryModule {}
