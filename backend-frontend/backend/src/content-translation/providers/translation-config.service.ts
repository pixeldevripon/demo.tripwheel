import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { safeDecrypt } from '@/common/utils/crypto.util';

/** The active AI-translation configuration, provider included. */
export interface TranslationConfig {
  /** Normalized provider name (a PROVIDER_CATALOG key). */
  provider: string;
  apiKey?: string;
  /** Blank = the provider's own catalog default. */
  model?: string;
  /** Only meaningful for `custom` - any OpenAI-compatible endpoint. */
  baseUrl?: string;
}

export const DEFAULT_TRANSLATION_PROVIDER = 'gemini';

/**
 * One resolution path for provider, key and model - provider-agnostic on
 * purpose (founder 2026-07-27: the settings surface must not be branded to
 * one vendor). Dashboard values (Settings > Integrations, key encrypted) win
 * over the TRANSLATION_PROVIDER_NAME / TRANSLATION_API_KEY / TRANSLATION_MODEL
 * env fallbacks. Resolved PER CALL, so an admin switching providers or keys
 * needs no restart.
 */
@Injectable()
export class TranslationConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(): Promise<TranslationConfig> {
    const row = await this.prisma.integrationsConfiguration.findUnique({
      where: { id: 'default' },
      select: {
        translationProvider: true,
        translationApiKey: true,
        translationModel: true,
        translationBaseUrl: true,
      },
    });
    const provider = (
      row?.translationProvider?.trim() ||
      process.env.TRANSLATION_PROVIDER_NAME?.trim() ||
      DEFAULT_TRANSLATION_PROVIDER
    ).toLowerCase();
    const apiKey =
      safeDecrypt(row?.translationApiKey)?.trim() ||
      process.env.TRANSLATION_API_KEY?.trim();
    const model =
      row?.translationModel?.trim() || process.env.TRANSLATION_MODEL?.trim();
    const baseUrl =
      row?.translationBaseUrl?.trim() ||
      process.env.TRANSLATION_BASE_URL?.trim();
    return {
      provider,
      apiKey: apiKey || undefined,
      model: model || undefined,
      baseUrl: baseUrl || undefined,
    };
  }
}
