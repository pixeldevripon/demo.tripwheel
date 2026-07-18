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
}: {
    locale: Locale;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className='it-container pt-10 pb-20 md:pt-16 md:pb-28'>
            <article className='mx-auto max-w-4xl'>
                <h1 className='m-0 font-medium text-[28px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                    {title}
                </h1>

                {locale !== 'en' && (
                    <p className='mt-6 mb-0 rounded-lg border border-it-border bg-it-surface px-4 py-3 text-[14px] leading-[1.6] text-it-text-muted'>
                        This page is currently available in English only. A
                        translated version will follow.
                    </p>
                )}

                <div
                    className='mt-8 md:mt-10
                        [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-medium [&_h2]:text-[20px] md:[&_h2]:text-[24px] [&_h2]:leading-[1.3] [&_h2]:tracking-[-0.012em] [&_h2]:text-it-heading
                        [&_h3]:mt-7 [&_h3]:mb-2 [&_h3]:font-medium [&_h3]:text-[17px] md:[&_h3]:text-[19px] [&_h3]:leading-[1.4] [&_h3]:text-it-heading
                        [&_p]:mt-0 [&_p]:mb-4 [&_p]:text-[15px] md:[&_p]:text-[16px] [&_p]:leading-[1.7] [&_p]:tracking-[-0.006em] [&_p]:text-it-ink-secondary
                        [&_ul]:mt-0 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5
                        [&_ol]:mt-0 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5
                        [&_li]:mb-1.5 [&_li]:text-[15px] md:[&_li]:text-[16px] [&_li]:leading-[1.7] [&_li]:tracking-[-0.006em] [&_li]:text-it-ink-secondary
                        [&_strong]:font-semibold [&_strong]:text-it-heading
                        [&_a]:text-it-primary [&_a]:no-underline hover:[&_a]:underline
                        [&_table]:mb-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left
                        [&_th]:border-b [&_th]:border-it-border [&_th]:px-3 [&_th]:py-2.5 [&_th]:align-top [&_th]:text-[13px] md:[&_th]:text-[14px] [&_th]:font-semibold [&_th]:text-it-heading
                        [&_td]:border-b [&_td]:border-it-border [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-top [&_td]:text-[13px] md:[&_td]:text-[14px] [&_td]:leading-[1.6] [&_td]:text-it-ink-secondary'>
                    {children}
                </div>
            </article>
        </div>
    );
}

/** Horizontal-scroll guard for wide tables (cookie list) on phones. */
export function LegalTableScroller({ children }: { children: React.ReactNode }) {
    return <div className='overflow-x-auto'>{children}</div>;
}
