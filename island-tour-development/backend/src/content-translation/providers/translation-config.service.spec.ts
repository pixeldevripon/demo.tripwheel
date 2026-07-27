import { TranslationConfigService } from './translation-config.service';
import { TranslationProviderRouter } from './translation-provider.router';

/**
 * The provider-agnostic settings contract: dashboard values win, env is the
 * fallback, and with nothing set anywhere the platform still lands on gemini
 * (founder: gemini is the default AND the fallback) - never on "dark".
 */

function mockPrisma(row: Record<string, unknown> | null = null): any {
  return {
    integrationsConfiguration: {
      findUnique: jest.fn().mockResolvedValue(row),
    },
  };
}

describe('TranslationConfigService', () => {
  afterEach(() => {
    delete process.env.TRANSLATION_PROVIDER_NAME;
    delete process.env.TRANSLATION_API_KEY;
    delete process.env.TRANSLATION_MODEL;
  });

  it('defaults to gemini with nothing configured anywhere', async () => {
    const cfg = await new TranslationConfigService(mockPrisma()).resolve();

    expect(cfg).toEqual({
      provider: 'gemini',
      apiKey: undefined,
      model: undefined,
    });
  });

  it('falls back to the env vars when the dashboard row is blank', async () => {
    process.env.TRANSLATION_PROVIDER_NAME = 'gemini';
    process.env.TRANSLATION_API_KEY = 'env-key-aaaaaaaaaaaaaaaaaaaa';
    process.env.TRANSLATION_MODEL = 'gemini-2.5-flash';

    const cfg = await new TranslationConfigService(
      mockPrisma({
        translationProvider: '',
        translationApiKey: null,
        translationModel: '',
      }),
    ).resolve();

    expect(cfg.apiKey).toBe('env-key-aaaaaaaaaaaaaaaaaaaa');
    expect(cfg.model).toBe('gemini-2.5-flash');
  });

  it('lets the dashboard provider/model win over env', async () => {
    process.env.TRANSLATION_PROVIDER_NAME = 'somethingelse';
    process.env.TRANSLATION_MODEL = 'env-model';

    const cfg = await new TranslationConfigService(
      mockPrisma({
        translationProvider: 'Gemini',
        translationApiKey: null,
        translationModel: 'db-model',
      }),
    ).resolve();

    // Normalized to lowercase; DB beats env.
    expect(cfg.provider).toBe('gemini');
    expect(cfg.model).toBe('db-model');
  });
});

describe('TranslationProviderRouter', () => {
  function stubProvider(name: string): any {
    return {
      isConfigured: jest.fn().mockResolvedValue(true),
      translateText: jest.fn().mockResolvedValue(`ok:${name}`),
      translateFields: jest.fn().mockResolvedValue({}),
    };
  }

  function router(provider: string) {
    const config = {
      resolve: jest
        .fn()
        .mockResolvedValue({ provider, apiKey: 'k', model: undefined }),
    } as any;
    const gemini = stubProvider('gemini');
    const anthropic = stubProvider('anthropic');
    const openaiCompat = stubProvider('openai-compat');
    return {
      r: new TranslationProviderRouter(config, gemini, anthropic, openaiCompat),
      gemini,
      anthropic,
      openaiCompat,
    };
  }

  it('routes to gemini when selected', async () => {
    const { r, gemini } = router('gemini');

    await r.isConfigured();

    expect(gemini.isConfigured).toHaveBeenCalled();
  });

  it('routes anthropic to its native transport', async () => {
    const { r, anthropic, openaiCompat } = router('anthropic');

    await r.translateText('hi', null, 'de');

    expect(anthropic.translateText).toHaveBeenCalled();
    expect(openaiCompat.translateText).not.toHaveBeenCalled();
  });

  it.each(['openai', 'groq', 'openrouter', 'mistral', 'deepseek', 'custom'])(
    'routes %s through the one OpenAI-compatible client',
    async (provider) => {
      const { r, openaiCompat } = router(provider);

      await r.translateText('hi', null, 'fr');

      expect(openaiCompat.translateText).toHaveBeenCalled();
    },
  );

  it('falls back to gemini on an unknown provider name instead of going dark', async () => {
    const { r, gemini } = router('nonsense');

    const out = await r.translateText('hi', null, 'nl');

    expect(out).toBe('ok:gemini');
    expect(gemini.translateText).toHaveBeenCalled();
  });
});
