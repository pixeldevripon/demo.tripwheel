import { Locale } from '@prisma/client';
import { OpenAiCompatProvider } from './openai-compat.provider';

/**
 * One client, many vendors: what matters is that the catalog base URL is used
 * for known providers, the admin's base URL for `custom` (and that custom
 * without one is inert, not a crash), and that model output survives the
 * shared JSON contract (fences stripped, hard errors thrown for the queue).
 */

function mockConfig(over: Record<string, unknown> = {}): any {
  return {
    resolve: jest.fn().mockResolvedValue({
      provider: 'groq',
      apiKey: 'gsk_test',
      model: undefined,
      baseUrl: undefined,
      ...over,
    }),
  };
}

function completionResponse(body: unknown, wrapInFence = false) {
  const text = JSON.stringify(body);
  return {
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: wrapInFence ? '```json\n' + text + '\n```' : text,
          },
        },
      ],
    }),
  };
}

describe('OpenAiCompatProvider', () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.TRANSLATION_BASE_URL;
  });

  it('hits the catalog base URL with a bearer key and the catalog default model', async () => {
    const provider = new OpenAiCompatProvider(mockConfig());
    global.fetch = jest
      .fn()
      .mockResolvedValue(completionResponse({ title: 'Titel' })) as any;

    const out = await provider.translateFields(
      { title: 'Title' },
      Locale.en,
      Locale.de,
    );

    expect(out).toEqual({ title: 'Titel' });
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(init.headers.authorization).toBe('Bearer gsk_test');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('llama-3.3-70b-versatile');
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('uses the admin base URL for provider custom (any endpoint, no code change)', async () => {
    const provider = new OpenAiCompatProvider(
      mockConfig({
        provider: 'custom',
        baseUrl: 'https://api.together.xyz/v1/',
        model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      }),
    );
    global.fetch = jest
      .fn()
      .mockResolvedValue(completionResponse({ title: 'Titre' })) as any;

    await provider.translateFields({ title: 'Title' }, Locale.en, Locale.fr);

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    // Trailing slash normalized - never //chat/completions.
    expect(url).toBe('https://api.together.xyz/v1/chat/completions');
  });

  it('is not configured as custom without a base URL or model', async () => {
    const noUrl = new OpenAiCompatProvider(
      mockConfig({ provider: 'custom', model: 'x' }),
    );
    const noModel = new OpenAiCompatProvider(
      mockConfig({ provider: 'custom', baseUrl: 'https://x.test/v1' }),
    );

    expect(await noUrl.isConfigured()).toBe(false);
    expect(await noModel.isConfigured()).toBe(false);
  });

  it('tolerates a code-fenced JSON answer (endpoints that ignore response_format)', async () => {
    const provider = new OpenAiCompatProvider(mockConfig());
    global.fetch = jest
      .fn()
      .mockResolvedValue(completionResponse({ title: 'Titel' }, true)) as any;

    const out = await provider.translateFields(
      { title: 'Title' },
      Locale.en,
      Locale.nl,
    );

    expect(out).toEqual({ title: 'Titel' });
  });

  it('surfaces HTTP 429 as a throw so the queue backoff absorbs it', async () => {
    const provider = new OpenAiCompatProvider(mockConfig());
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: async () => 'rate limited',
    }) as any;

    await expect(
      provider.translateFields({ title: 'Title' }, Locale.en, Locale.pt),
    ).rejects.toThrow('HTTP 429');
  });
});
