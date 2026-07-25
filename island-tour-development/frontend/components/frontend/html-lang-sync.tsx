'use client';

import { useEffect } from 'react';

import type { Locale } from '@/lib/constants/locales';

/**
 * Keeps `<html lang>` in sync with the active locale at runtime.
 *
 * WHY CLIENT-SIDE: the `<html>` element lives in the ROOT layout, which sits
 * ABOVE the `[locale]` segment and so cannot read the locale param - it renders
 * a static `lang="en"`. The proxy's matcher deliberately excludes already-
 * localized paths (the Vercel RSC-variant fix), so we also can't stamp the locale
 * onto a request header for the root to read. Setting it here corrects the DOM
 * for assistive tech and browser tooling; the SEO localization signal is carried
 * by the hreflang alternates, which are fully server-rendered.
 *
 * Renders nothing.
 */
export function HtmlLangSync({ locale }: { locale: Locale }) {
    useEffect(() => {
        document.documentElement.lang = locale;
    }, [locale]);
    return null;
}
