import { Injectable, Logger } from '@nestjs/common';
import { Locale } from '@prisma/client';
import {
  JsonTranslationProvider,
  TRANSLATION_REQUEST_TIMEOUT_MS,
} from './json-translation.base';
import { catalogEntry } from './provider-catalog';
import { TranslationConfigService } from './translation-config.service';

/**
 * Gemini (Google AI Studio) transport - the default provider (real free tier,
 * strongest multilingual quality for zh/nl/pt). Thin REST client over
 * `generateContent`, no SDK (house pattern - every external call in this
 * backend is a native-fetch thin client, and the queue's retry contract is
 * easier to guarantee on a raw response). Prompting, chunking, validation and
 * the corrective retry live in JsonTranslationProvider.
 */
@Injectable()
export class GeminiProvider extends JsonTranslationProvider {
  protected readonly label = 'Gemini';
  protected readonly logger = new Logger(GeminiProvider.name);

  constructor(private readonly config: TranslationConfigService) {
    super();
  }

  private async resolveConfig(): Promise<{ apiKey?: string; model: string }> {
    const { apiKey, model } = await this.config.resolve();
    return {
      apiKey,
      model: model || (catalogEntry('gemini')?.defaultModel as string),
    };
  }

  async isConfigured(): Promise<boolean> {
    return Boolean((await this.resolveConfig()).apiKey);
  }

  /** POST generateContent and parse the JSON body out of the first candidate. */
  protected async requestChunk(
    payload: string,
    from: Locale | null,
    to: Locale,
    correction?: string,
  ): Promise<unknown> {
    const cfg = await this.resolveConfig();
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${cfg.model}:generateContent`;

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      TRANSLATION_REQUEST_TIMEOUT_MS,
    );
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // Header, never a query param - keys in URLs leak into logs.
          'x-goog-api-key': cfg.apiKey ?? '',
        },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              { text: this.buildSystemInstruction(from, to, correction) },
            ],
          },
          contents: [{ role: 'user', parts: [{ text: payload }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        }),
      });
    } catch (error) {
      throw new Error(
        `Gemini request failed (network/timeout): ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      // 429 (free-tier rate limit) and 5xx are the retryable cases the queue's
      // exponential backoff exists for - surface the status in the message.
      const body = await response.text().catch(() => '');
      throw new Error(
        `Gemini HTTP ${response.status}: ${body.slice(0, 300) || response.statusText}`,
      );
    }

    const json = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('');
    if (!text) throw new Error('Gemini returned an empty candidate');

    return this.parseModelJson(text);
  }
}
