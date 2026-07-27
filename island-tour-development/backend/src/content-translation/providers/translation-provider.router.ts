import { Injectable, Logger } from '@nestjs/common';
import type { Locale } from '@prisma/client';
import { AnthropicProvider } from './anthropic.provider';
import { GeminiProvider } from './gemini.provider';
import { OpenAiCompatProvider } from './openai-compat.provider';
import { catalogEntry } from './provider-catalog';
import {
  DEFAULT_TRANSLATION_PROVIDER,
  TranslationConfigService,
} from './translation-config.service';
import type {
  TranslatableValue,
  TranslationProvider,
} from './translation-provider.interface';

/**
 * The object actually bound to TRANSLATION_PROVIDER: routes every call to the
 * provider the admin selected in Settings > Integrations (env fallback),
 * resolved PER CALL so switching needs no restart. The catalog maps each
 * provider key to one of three transports (gemini / anthropic /
 * openai-compatible) - so "any provider" is real: known vendors are one
 * catalog row, and `custom` accepts any OpenAI-compatible base URL with no
 * code change at all. An unknown stored name falls back to the default
 * (gemini) with a warning rather than silently going dark.
 */
@Injectable()
export class TranslationProviderRouter implements TranslationProvider {
  private readonly logger = new Logger(TranslationProviderRouter.name);
  private warnedUnknown: string | null = null;

  constructor(
    private readonly config: TranslationConfigService,
    private readonly gemini: GeminiProvider,
    private readonly anthropic: AnthropicProvider,
    private readonly openaiCompat: OpenAiCompatProvider,
  ) {}

  private async active(): Promise<TranslationProvider> {
    const { provider } = await this.config.resolve();
    const entry = catalogEntry(provider);
    if (!entry) {
      if (this.warnedUnknown !== provider) {
        this.warnedUnknown = provider;
        this.logger.warn(
          `Unknown translation provider "${provider}" - falling back to ${DEFAULT_TRANSLATION_PROVIDER}`,
        );
      }
      return this.gemini;
    }
    switch (entry.transport) {
      case 'gemini':
        return this.gemini;
      case 'anthropic':
        return this.anthropic;
      case 'openai':
        return this.openaiCompat;
    }
  }

  async isConfigured(): Promise<boolean> {
    return (await this.active()).isConfigured();
  }

  async translateFields(
    fields: Record<string, TranslatableValue>,
    from: Locale | null,
    to: Locale,
  ): Promise<Record<string, TranslatableValue>> {
    return (await this.active()).translateFields(fields, from, to);
  }

  async translateText(
    text: string,
    from: Locale | null,
    to: Locale,
  ): Promise<string> {
    return (await this.active()).translateText(text, from, to);
  }
}
