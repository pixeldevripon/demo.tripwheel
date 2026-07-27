import { Locale } from '@prisma/client';
import { GeminiProvider } from './gemini.provider';

/**
 * The cases that matter are the ones that corrupt data or burn free-tier
 * quota: malformed model output slipping through, an array coming back the
 * wrong length, and a rate limit not surfacing as the retryable throw the
 * queue's backoff depends on. Config resolution (DB vs env, provider pick)
 * is TranslationConfigService's job and mocked at that seam.
 */

const TEST_KEY = 'test-key-aaaaaaaaaaaaaaaaaaaa';

function mockConfig(apiKey: string | null = TEST_KEY): any {
  return {
    resolve: jest.fn().mockResolvedValue({
      provider: 'gemini',
      apiKey: apiKey ?? undefined,
      model: undefined,
    }),
  };
}

/** A well-formed generateContent response wrapping the given object. */
function geminiResponse(body: unknown) {
  return {
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }],
    }),
  };
}

describe('GeminiProvider', () => {
  let provider: GeminiProvider;
  const realFetch = global.fetch;

  beforeEach(() => {
    provider = new GeminiProvider(mockConfig());
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  describe('isConfigured', () => {
    it('is false with no key resolved', async () => {
      provider = new GeminiProvider(mockConfig(null));
      expect(await provider.isConfigured()).toBe(false);
    });

    it('is true when the shared config resolves a key', async () => {
      expect(await provider.isConfigured()).toBe(true);
    });
  });

  describe('translateFields', () => {
    it('round-trips a field map, arrays keeping length and order', async () => {
      const source = {
        title: 'Catamaran day trip',
        whatToBring: ['Swimwear', 'Sunscreen', 'Hat'],
      };
      const translated = {
        title: 'Excursión en catamarán',
        whatToBring: ['Bañador', 'Protector solar', 'Sombrero'],
      };
      global.fetch = jest
        .fn()
        .mockResolvedValue(geminiResponse(translated)) as any;

      const out = await provider.translateFields(source, Locale.en, Locale.es);

      expect(out).toEqual(translated);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      // The key rides the header - a key in the URL leaks into request logs.
      expect(url).not.toContain('test-key');
      expect(init.headers['x-goog-api-key']).toBe(
        'test-key-aaaaaaaaaaaaaaaaaaaa',
      );
      const body = JSON.parse(init.body);
      // JSON mode + low temperature is the reliability floor, not a nicety.
      expect(body.generationConfig).toEqual({
        responseMimeType: 'application/json',
        temperature: 0.2,
      });
      expect(JSON.parse(body.contents[0].parts[0].text)).toEqual(source);
    });

    it('names Simplified Chinese in the prompt for zh (never the bare code)', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(geminiResponse({ title: '标题' })) as any;

      await provider.translateFields({ title: 'Title' }, Locale.en, Locale.zh);

      const body = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body,
      );
      expect(body.systemInstruction.parts[0].text).toContain(
        'Simplified Chinese',
      );
    });

    it('recovers from one malformed response via a corrective retry', async () => {
      global.fetch = jest
        .fn()
        // First answer drops a key entirely.
        .mockResolvedValueOnce(geminiResponse({ wrong: 'shape' }))
        .mockResolvedValueOnce(geminiResponse({ title: 'Titel' })) as any;

      const out = await provider.translateFields(
        { title: 'Title' },
        Locale.en,
        Locale.de,
      );

      expect(out).toEqual({ title: 'Titel' });
      expect(global.fetch).toHaveBeenCalledTimes(2);
      const retryBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[1][1].body,
      );
      expect(retryBody.systemInstruction.parts[0].text).toContain('rejected');
    });

    it('throws after two invalid responses (the retryable case for BullMQ)', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(geminiResponse({ wrong: 'shape' })) as any;

      await expect(
        provider.translateFields({ title: 'Title' }, Locale.en, Locale.fr),
      ).rejects.toThrow('invalid JSON twice');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('rejects an array that came back the wrong length', async () => {
      global.fetch = jest
        .fn()
        // Two items for a three-item source - silently accepting this would
        // desync bullets from their meaning.
        .mockResolvedValueOnce(geminiResponse({ items: ['a', 'b'] }))
        .mockResolvedValueOnce(
          geminiResponse({ items: ['a', 'b', 'c'] }),
        ) as any;

      const out = await provider.translateFields(
        { items: ['x', 'y', 'z'] },
        Locale.en,
        Locale.nl,
      );

      expect(out).toEqual({ items: ['a', 'b', 'c'] });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('surfaces HTTP 429 as a throw so the queue backoff absorbs it', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => 'quota exceeded',
      }) as any;

      await expect(
        provider.translateFields({ title: 'Title' }, Locale.en, Locale.pt),
      ).rejects.toThrow('Gemini HTTP 429');
    });

    it('throws when unconfigured instead of calling the network', async () => {
      provider = new GeminiProvider(mockConfig(null));
      global.fetch = jest.fn() as any;

      await expect(
        provider.translateFields({ title: 'Title' }, Locale.en, Locale.es),
      ).rejects.toThrow('not configured');
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('translateText', () => {
    it('unwraps the single-string shape (reviews), auto-detecting the source', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(geminiResponse({ text: 'Fantastisch!' })) as any;

      const out = await provider.translateText('Fantastic!', null, Locale.nl);

      expect(out).toBe('Fantastisch!');
      const body = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body,
      );
      expect(body.systemInstruction.parts[0].text).toContain('auto-detect');
    });
  });
});
