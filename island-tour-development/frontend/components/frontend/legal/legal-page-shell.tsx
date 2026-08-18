import type { Locale } from '@/lib/constants/locales';

/**
 * Shared shell for the six global legal pages (legal handover README:
 * public/Legal Pages). Owns the page chrome and the prose typography so every
 * page reads identically; pages supply verbatim handover text as plain
 * semantic HTML (h2/h3/p/ul/table) and the descendant variants below style it.
 *
 * English is the legal source text. Every other locale shows the English page
 * with a notice until a per-language legal review lands (README: operative
 * clauses are not machine-translated).
 */
export function LegalPageShell({
    locale,
    title,
    children,
    showEnglishNotice,
}: {
    locale: Locale;
    title: string;
    children: React.ReactNode;
    /**
     * Overrides the English-only notice. Defaults to `locale !== 'en'` (every
     * page is English-only today); the CMS renderer passes the backend's
     * `isEnglishFallback` instead, so a page that gains a real translation
     * stops showing the notice without a code change.
     */
    showEnglishNotice?: boolean;
}) {
    return (
        <div className='it-container pt-10 pb-20 md:pt-14 md:pb-28'>
            {/* Design v2: the same 880px reading measure as the thank-you page. */}
            <article className='mx-auto max-w-[880px]'>
                <h1 className='m-0 text-[28px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading font-medium'>
                    {title}
                </h1>

                {(showEnglishNotice ?? locale !== 'en') && (
                    <p className='mt-6 mb-0 rounded-lg border border-it-border bg-it-bg px-4 py-3 text-[14px] leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
                        This page is currently available in English only. A
                        translated version will follow.
                    </p>
                )}

                {/* Prose typography lives in `.it-page-prose` (frontend-tokens.css)
                    so the CMS page renderer and the dashboard editor preview share
                    the exact same rules - see the token file for the sync note. */}
                <div className='it-page-prose mt-8 md:mt-10'>{children}</div>
            </article>
        </div>
    );
}

// The old `LegalTableScroller` (horizontal-scroll guard for wide tables) is
// gone with the hand-authored pages: `PageBody` now wraps EVERY table in the
// same guard at render time, so the concern lives with the CMS renderer.

