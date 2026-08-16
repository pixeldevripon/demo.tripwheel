/**
 * Public operator-conditions document (server-side, cached) - Pastel #80 /
 * MCK-20 §3. ONE source: the canonical /{locale}/operators/{slug}/conditions
 * page and its intercepted overlay both render from here; the checkout's
 * in-flow reader reads the same text through the tour-scoped endpoint.
 */
import { seg } from '@/lib/api/api-path';
import 'server-only';

import { cacheLife } from 'next/cache';

import type { Locale } from '@/lib/constants/locales';
import { DEFAULT_LOCALE } from '@/lib/constants/locales';
import { buildQuery, publicGet } from './fetch';

export interface PublicOperatorTerms {
    operatorName: string | null;
    version: string | null;
    effectiveDate: string | null;
    /** Sanitized-HTML conditions text, locale-resolved with EN fallback. */
    document: string;
}

/**
 * The operator's conditions document, or null when none exists (backend 404) -
 * callers `notFound()` on null.
 *
 * Cached hourly WITHOUT a tag, deliberately: the document has no CMS write
 * path yet (seed / platform-managed only), and the cache-tag contract file is
 * duplicated across two repos - a tag with no producer would be dead weight in
 * both. The CMS follow-up registers a proper tag with its producer.
 */
export async function getOperatorConditions(
    operatorSlug: string,
    locale: Locale = DEFAULT_LOCALE
): Promise<PublicOperatorTerms | null> {
    'use cache';
    cacheLife('hours');

    return publicGet<PublicOperatorTerms>(
        `/operators/slug/${seg(operatorSlug)}/terms${buildQuery({ locale })}`
    );
}
