import { Module } from '@nestjs/common';

import { MediaGalleryModule } from '@/media-gallery/media-gallery.module';
import { PublicCacheService } from '@/workers/public-cache.service';

import { InstagramConfigService } from './instagram-config.service';
import { InstagramController } from './instagram.controller';
import { InstagramService } from './instagram.service';
import { InstagramSyncScheduler } from './instagram-sync.scheduler';
import { InstagramSyncService } from './instagram-sync.service';
import { InstagramTokenService } from './instagram-token.service';
import { INSTAGRAM_API_PROVIDER } from './providers/instagram-api.provider';
import { InstagramGraphProvider } from './providers/instagram-graph.provider';

/**
 * The brand Instagram grid (master 3.9). Auto-sync is the primary path: an admin
 * pastes a long-lived access token in the dashboard, and a daily job mirrors the
 * account's recent feed into our own tiles.
 *
 * The live Graph client is bound behind INSTAGRAM_API_PROVIDER so the sync and
 * token service depend on the interface, not on `fetch`. MediaGalleryModule is
 * imported for CloudinaryService (the sync mirrors expiring media_url links into
 * assets we own, and the admin delete cleans them up). Services are exported for
 * reuse by future consumers; the daily sync is driven by InstagramSyncService.
 */
@Module({
  imports: [MediaGalleryModule],
  controllers: [InstagramController],
  providers: [
    InstagramService,
    InstagramConfigService,
    InstagramTokenService,
    InstagramSyncService,
    InstagramSyncScheduler,
    // Stateless env-driven client; a local instance (as content-translation
    // does) beats importing WorkersModule and dragging in every job.
    PublicCacheService,
    InstagramGraphProvider,
    { provide: INSTAGRAM_API_PROVIDER, useExisting: InstagramGraphProvider },
  ],
  exports: [InstagramService, InstagramSyncService, InstagramTokenService],
})
export class InstagramModule {}
