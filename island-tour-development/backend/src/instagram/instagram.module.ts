import { Module } from '@nestjs/common';
import { InstagramController } from './instagram.controller';
import { InstagramService } from './instagram.service';

/**
 * The brand Instagram grid (master 3.9). Phase 1 serves admin-curated tiles;
 * phase 2 adds the API sync worker behind the same public contract. Exported so
 * that sync job can reuse the service.
 */
@Module({
  controllers: [InstagramController],
  providers: [InstagramService],
  exports: [InstagramService],
})
export class InstagramModule {}
