import { Injectable, Logger } from '@nestjs/common';
import { Locale } from '@prisma/client';
import {
  JsonTranslationProvider,
  TRANSLATION_REQUEST_TIMEOUT_MS,
} from './json-translation.base';
import { catalogEntry } from './provider-catalog';
import { TranslationConfigService } from './translation-config.service';

const ANTHROPIC_VERSION = '2023-06-01';

/** Generous ceiling for a 20k-char translation chunk. */
const MAX_TOKENS = 8_192;

/**
 * Anthropic (Claude) native Messages API transport - Claude's surface is not
 * OpenAI-shaped, so it gets its own thin client rather than riding the compat
 * provider. No JSON response mode exists here; the base class's
 * fence-stripping + strict validation + corrective retry carry the JSON
 * contract instead. Prompting, chunking and validation live in
 * JsonTranslationProvider.
 */
@Injectable()
export class AnthropicProvider extends JsonTranslationProvider {
  protected readonly label = 'Anthropic';
  protected readonly logger = new Logger(AnthropicProvider.name);

  constructor(private readonly config: TranslationConfigService) {
    super();
  }

  private async resolveConfig(): Promise<{ apiKey?: string; model: string }> {
    const { apiKey, model } = await this.config.resolve();
    return {
      apiKey,
      model: model || (catalogEntry('anthropic')?.defaultModel as string),
    };
  }

  async isConfigured(): Promise<boolean> {
    return Boolean((await this.resolveConfig()).apiKey);
  }

  protected async requestChunk(
    payload: string,
    from: Locale | null,
    to: Locale,
    correction?: string,
  ): Promise<unknown> {
    const cfg = await this.resolveConfig();
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      TRANSLATION_REQUEST_TIMEOUT_MS,
    );
    let response: Response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': cfg.apiKey ?? '',
          'anthropic-version': ANTHROPIC_VERSION,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: cfg.model,
          max_tokens: MAX_TOKENS,
          temperature: 0.2,
          system: this.buildSystemInstruction(from, to, correction),
          messages: [{ role: 'user', content: payload }],
        }),
      });
    } catch (error) {
      throw new Error(
        `Anthropic request failed (network/timeout): ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      // 429 (rate limit) and 529 (overloaded) are the retryable cases the
      // queue's exponential backoff exists for.
      const body = await response.text().catch(() => '');
      throw new Error(
        `Anthropic HTTP ${response.status}: ${body.slice(0, 300) || response.statusText}`,
      );
    }

    const json = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const text = json.content
      ?.filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('');
    if (!text) throw new Error('Anthropic returned an empty message');

    return this.parseModelJson(text);
  }
}
