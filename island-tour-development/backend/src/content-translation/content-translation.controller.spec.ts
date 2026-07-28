import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Locale } from '@prisma/client';
import { ContentTranslationController } from './content-translation.controller';

/**
 * The batched translate-fields endpoint carries its own validation (a
 * Record's values are opaque to class-validator), so the caps and the
 * persist-nothing provider hand-off are asserted here. The controller is
 * constructed directly - the service and prisma are untouched by this route.
 */

function makeController(provider: {
  isConfigured: jest.Mock;
  translateFields: jest.Mock;
}) {
  return new ContentTranslationController(
    {} as never,
    {} as never,
    provider as never,
  );
}

function mockProvider(configured = true) {
  return {
    isConfigured: jest.fn().mockResolvedValue(configured),
    translateFields: jest.fn(),
  };
}

describe('ContentTranslationController.translateFields', () => {
  it('translates the whole map in ONE provider call and returns the same keys', async () => {
    const provider = mockProvider();
    provider.translateFields.mockResolvedValue({
      f0: 'Beste cruise',
      f1: 'Een relaxte tocht.',
    });
    const controller = makeController(provider);

    const res = await controller.translateFields({
      fields: { f0: 'Best cruise', f1: 'A relaxed trip.' },
      targetLocale: Locale.nl,
    });

    expect(provider.translateFields).toHaveBeenCalledTimes(1);
    expect(provider.translateFields).toHaveBeenCalledWith(
      { f0: 'Best cruise', f1: 'A relaxed trip.' },
      Locale.en,
      Locale.nl,
    );
    expect(res).toEqual({
      fields: { f0: 'Beste cruise', f1: 'Een relaxte tocht.' },
    });
  });

  it('drops empty-string values before the provider call', async () => {
    const provider = mockProvider();
    provider.translateFields.mockResolvedValue({ f0: 'X' });
    const controller = makeController(provider);

    await controller.translateFields({
      fields: { f0: 'Filled', f1: '   ' },
      targetLocale: Locale.de,
    });

    expect(provider.translateFields).toHaveBeenCalledWith(
      { f0: 'Filled' },
      Locale.en,
      Locale.de,
    );
  });

  it('returns an empty map without touching the provider when every value is empty', async () => {
    const provider = mockProvider();
    const controller = makeController(provider);

    const res = await controller.translateFields({
      fields: { f0: '', f1: '  ' },
      targetLocale: Locale.fr,
    });

    expect(res).toEqual({ fields: {} });
    expect(provider.isConfigured).not.toHaveBeenCalled();
    expect(provider.translateFields).not.toHaveBeenCalled();
  });

  it('rejects en as the target locale', async () => {
    const controller = makeController(mockProvider());

    await expect(
      controller.translateFields({
        fields: { f0: 'x' },
        targetLocale: Locale.en,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an empty map, too many entries, oversized payloads and non-string values', async () => {
    const provider = mockProvider();
    const controller = makeController(provider);

    await expect(
      controller.translateFields({ fields: {}, targetLocale: Locale.nl }),
    ).rejects.toThrow(BadRequestException);

    const tooMany = Object.fromEntries(
      Array.from({ length: 101 }, (_, i) => [`f${i}`, 'x']),
    );
    await expect(
      controller.translateFields({ fields: tooMany, targetLocale: Locale.nl }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      controller.translateFields({
        fields: { f0: 'a'.repeat(30_001) },
        targetLocale: Locale.nl,
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      controller.translateFields({
        fields: { f0: 42 as never },
        targetLocale: Locale.nl,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(provider.translateFields).not.toHaveBeenCalled();
  });

  it('counts KEY length toward the character cap (long keys cannot smuggle payload)', async () => {
    const controller = makeController(mockProvider());

    // Value alone is under the cap; key + value is over it.
    await expect(
      controller.translateFields({
        fields: { ['k'.repeat(60)]: 'a'.repeat(29_950) },
        targetLocale: Locale.nl,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects over-long and prototype-touching keys loudly', async () => {
    const provider = mockProvider();
    const controller = makeController(provider);

    await expect(
      controller.translateFields({
        fields: { ['k'.repeat(65)]: 'x' },
        targetLocale: Locale.nl,
      }),
    ).rejects.toThrow(BadRequestException);

    // A bracket assignment of __proto__ would silently swallow the field -
    // the endpoint must fail loudly instead.
    const polluted = JSON.parse('{"__proto__": "x"}') as Record<string, string>;
    await expect(
      controller.translateFields({
        fields: polluted,
        targetLocale: Locale.nl,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(provider.translateFields).not.toHaveBeenCalled();
  });

  it('echoes back only requested keys and drops non-string provider values', async () => {
    const provider = mockProvider();
    provider.translateFields.mockResolvedValue({
      f0: 'Vertaald',
      hallucinated: 'extra key from the model',
      f1: 123, // malformed value under a requested key
    });
    const controller = makeController(provider);

    const res = await controller.translateFields({
      fields: { f0: 'Translated', f1: 'Other' },
      targetLocale: Locale.nl,
    });

    expect(res).toEqual({ fields: { f0: 'Vertaald' } });
  });

  it('400s when the provider is not configured', async () => {
    const controller = makeController(mockProvider(false));

    await expect(
      controller.translateFields({
        fields: { f0: 'x' },
        targetLocale: Locale.nl,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('maps a provider failure to 503 (safe to retry)', async () => {
    const provider = mockProvider();
    provider.translateFields.mockRejectedValue(new Error('rate limited'));
    const controller = makeController(provider);

    await expect(
      controller.translateFields({
        fields: { f0: 'x' },
        targetLocale: Locale.nl,
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});
