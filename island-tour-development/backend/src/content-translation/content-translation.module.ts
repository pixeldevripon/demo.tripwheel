import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { buildRedisConnection } from '@/common/utils/redis.util';
import { PublicCacheService } from '@/workers/public-cache.service';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAiCompatProvider } from './providers/openai-compat.provider';
import { TranslationConfigService } from './providers/translation-config.service';
import { TranslationProviderRouter } from './providers/translation-provider.router';
import { TRANSLATION_PROVIDER } from './providers/translation-provider.interface';
import { CONTENT_TRANSLATION_QUEUE } from './content-translation.constants';
import { ContentTranslationController } from './content-translation.controller';
import { ContentTranslationEnqueuer } from './content-translation.enqueuer';
import { ContentTranslationProcessor } from './content-translation.processor';
import { ContentTranslationService } from './content-translation.service';
import { EntityRegistry } from './entity-registry';
import { TranslationClearMarkService } from './translation-clear-mark.service';

/**
 * ContentTranslationModule - AI translation of every Translation-Console
 * entity (and, via the exported provider token, review comments).
 *
 * Global for the same reason FaqModule is: the enqueue hook lives in eight
 * consumer modules (tours, categories, destinations, hubs, collections,
 * home-page, common/faq, common/page-content-sections) and re-importing a
 * module in all of them is churn without safety.
 *
 * The provider is selected by the ADMIN (Settings > Integrations, env
 * fallback TRANSLATION_PROVIDER_NAME, default gemini), resolved per call by
 * TranslationProviderRouter - a new provider is one class implementing
 * TranslationProvider plus one router case; consumers never change.
 */
@Global()
@Module({
  controllers: [ContentTranslationController],
  imports: [
    BullModule.registerQueue({
      name: CONTENT_TRANSLATION_QUEUE,
      connection: buildRedisConnection(),
    }),
  ],
  providers: [
    TranslationConfigService,
    GeminiProvider,
    AnthropicProvider,
    OpenAiCompatProvider,
    { provide: TRANSLATION_PROVIDER, useClass: TranslationProviderRouter },
    TranslationClearMarkService,
    EntityRegistry,
    // Stateless env-driven client; a second instance next to WorkersModule's
    // is deliberate - importing WorkersModule here would drag in every job.
    PublicCacheService,
    ContentTranslationService,
    ContentTranslationEnqueuer,
    ContentTranslationProcessor,
  ],
  exports: [
    TRANSLATION_PROVIDER,
    ContentTranslationService,
    ContentTranslationEnqueuer,
    // Injected by every module that owns a Translation-Console clear endpoint.
    TranslationClearMarkService,
  ],
})
export class ContentTranslationModule {}
