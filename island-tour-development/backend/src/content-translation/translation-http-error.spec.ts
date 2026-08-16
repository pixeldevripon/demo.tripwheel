import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { toTranslationHttpError } from './translation-http-error';

/**
 * Raw provider failures ("Gemini HTTP 401: {json...}") must become sentences
 * that say what happened AND what to do - never interpolated provider JSON,
 * never a bare 500.
 */
describe('toTranslationHttpError', () => {
  it('maps a missing configuration to a 400 pointing at Settings', () => {
    const err = toTranslationHttpError(
      new Error(
        'Gemini is not configured (missing API key, base URL or model)',
      ),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.message).toContain('Settings > Integrations');
  });

  it('maps a rejected key (HTTP 401/403, provider phrasing) to key advice', () => {
    for (const raw of [
      'Gemini HTTP 400: {"error":{"message":"API key not valid. Please pass a valid API key."}}',
      'Anthropic HTTP 401: {"type":"error","error":{"type":"authentication_error"}}',
      'openai HTTP 403: permission_denied',
    ]) {
      const err = toTranslationHttpError(new Error(raw));
      expect(err).toBeInstanceOf(ServiceUnavailableException);
      expect(err.message).toContain('rejected the API key');
      expect(err.message).not.toContain('{');
    }
  });

  it('maps rate limiting and quota exhaustion to wait/billing advice', () => {
    expect(
      toTranslationHttpError(new Error('Gemini HTTP 429: RESOURCE_EXHAUSTED'))
        .message,
    ).toContain('rate-limiting');
    // Quota phrasing wins over the bare 429: "used it all up" needs billing
    // action, not a one-minute wait.
    expect(
      toTranslationHttpError(
        new Error('openai HTTP 429: You exceeded your current quota'),
      ).message,
    ).toContain('out of credit');
    expect(
      toTranslationHttpError(new Error('HTTP 402: insufficient credit'))
        .message,
    ).toContain('out of credit');
  });

  it('maps timeouts and unusable output to retry advice', () => {
    expect(
      toTranslationHttpError(
        new Error('Gemini request failed (network/timeout): AbortError'),
      ).message,
    ).toContain('did not respond in time');
    expect(
      toTranslationHttpError(new Error('Gemini returned non-JSON output'))
        .message,
    ).toContain('unusable answer');
  });

  it('falls back to a generic retry sentence, never raw text', () => {
    const err = toTranslationHttpError(new Error('some weird internal thing'));
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect(err.message).toBe(
      'AI translation failed - please try again shortly.',
    );
    expect(toTranslationHttpError('not-an-error').message).toBe(
      'AI translation failed - please try again shortly.',
    );
  });
});
