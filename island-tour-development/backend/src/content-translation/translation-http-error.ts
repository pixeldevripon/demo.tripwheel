import {
  BadRequestException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';

/**
 * Translate a raw AI-provider failure into the sentence a dashboard user
 * should read.
 *
 * The providers (gemini / anthropic / openai-compat) throw plain Errors whose
 * messages embed the upstream status and body ("Gemini HTTP 401: {...}").
 * Interpolating that into an HTTP response - which these controllers used to
 * do - shows raw provider JSON to the user; letting it fall through the
 * global filter shows "Internal server error". Both are useless. This maps
 * each failure class to what happened AND what to do about it.
 */
export function toTranslationHttpError(err: unknown): HttpException {
  const msg = err instanceof Error ? err.message : '';

  if (/not configured/i.test(msg)) {
    return new BadRequestException(
      'AI translation is not set up yet - add a provider API key under Settings > Integrations > AI Translation (or TRANSLATION_API_KEY).',
    );
  }
  if (
    /HTTP 401|HTTP 403|api key not valid|invalid[_ ]api[_ ]key|invalid x-api-key|unauthorized|permission[_ ]denied|authentication/i.test(
      msg,
    )
  ) {
    return new ServiceUnavailableException(
      'The AI provider rejected the API key. Check the key, provider and model under Settings > Integrations > AI Translation.',
    );
  }
  if (
    /HTTP 402|insufficient[_ ]quota|exceeded your current quota|credit|billing/i.test(
      msg,
    )
  ) {
    return new ServiceUnavailableException(
      'The AI provider account is out of credit or quota. Top up or check billing with the provider, then try again.',
    );
  }
  if (
    /HTTP 429|rate[_ ]?limit|resource[_ ]exhausted|too many requests|overloaded/i.test(
      msg,
    )
  ) {
    return new ServiceUnavailableException(
      'The AI provider is rate-limiting requests right now. Wait a minute and try again - if it keeps happening, the plan quota may be used up.',
    );
  }
  if (/network\/timeout|abort/i.test(msg)) {
    return new ServiceUnavailableException(
      'The AI provider did not respond in time. Try again shortly.',
    );
  }
  if (/non-JSON|invalid JSON/i.test(msg)) {
    return new ServiceUnavailableException(
      'The AI provider returned an unusable answer. Try again - shorter sections translate more reliably.',
    );
  }
  return new ServiceUnavailableException(
    'AI translation failed - please try again shortly.',
  );
}
