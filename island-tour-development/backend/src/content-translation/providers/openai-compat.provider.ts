import { Injectable, Logger } from '@nestjs/common';
import { Locale } from '@prisma/client';
import {
  JsonTranslationProvider,
  TRANSLATION_REQUEST_TIMEOUT_MS,
} from './json-translation.base';
import { catalogEntry } from './provider-catalog';
import { TranslationConfigService } from './translation-config.service';

/**
 * OpenAI-compatible chat-completions transport - ONE client that serves every
 * vendor exposing the de-facto standard surface: OpenAI, Groq, OpenRouter,
 * Mistral, DeepSeek (fixed base URLs from the catalog) and `custom`, where the
 * admin supplies any base URL (Together, xAI, self-hosted Ollama/vLLM, ...).
 * This class is what makes "any provider can be integrated" true without code
 * changes. Prompting, chunking, validation and the corrective retry live in
 * JsonTranslationProvider.
 */
@Injectable()
export class OpenAiCompatProvider extends JsonTranslationProvider {
  protected readonly label = 'The translation provider';
  protected readonly logger = new Logger(OpenAiCompatProvider.name);

  constructor(private readonly config: TranslationConfigService) {
    super();
  }

  private async resolveConfig(): Promise<{
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    provider: string;
  }> {
    const { provider, apiKey, model, baseUrl } = await this.config.resolve();
    const entry = catalogEntry(provider);
    return {
      provider,
      apiKey,
      // Known vendors have a fixed origin; `custom` uses the admin's URL.
      baseUrl: (entry?.baseUrl ?? baseUrl)?.replace(/\/+$/, ''),
      model: model || entry?.defaultModel,
    };
  }

  /** Custom endpoints need all three: key, base URL and a model name. */
  async isConfigured(): Promise<boolean> {
    const cfg = await this.resolveConfig();
    return Boolean(cfg.apiKey && cfg.baseUrl && cfg.model);
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
      response = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${cfg.apiKey ?? ''}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: cfg.model,
          temperature: 0.2,
          // Widely supported; where a custom endpoint ignores it, the base
          // class's fence-stripping + validation + corrective retry still hold.
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: this.buildSystemInstruction(from, to, correction),
            },
            { role: 'user', content: payload },
          ],
        }),
      });
    } catch (error) {
      throw new Error(
        `${cfg.provider} request failed (network/timeout): ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      // 429 and 5xx are the retryable cases the queue's backoff exists for.
      const body = await response.text().catch(() => '');
      throw new Error(
        `${cfg.provider} HTTP ${response.status}: ${body.slice(0, 300) || response.statusText}`,
      );
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content;
    if (!text) throw new Error(`${cfg.provider} returned an empty choice`);

    return this.parseModelJson(text);
  }
}
