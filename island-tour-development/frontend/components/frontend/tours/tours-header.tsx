import { getCurrentYear } from '@/lib/current-year';

export type ToursHeaderDict = {
    /** Title template - e.g. "All {destination} tours & activities in {year}" */
    title: string;
    subtitle: string;
    /** Count template - e.g. "{count} tours" (rendered emphasised) */
    availableCount: string;
    /** Trailing muted word - e.g. "available" */
    availableLabel: string;
};

/**
 * Tours listing heading - design v2 `.pagehead`: display H1, the muted
 * orientation line beneath it, and the faint tabular availability count.
 * Shared by the All-Tours page (`{destination}` + `{year}` template) and the
 * Category page (pre-resolved `title`/`subtitle` overrides).
 */
export async function ToursHeader({
    dict,
    destinationName,
    total,
    title: titleOverride,
    subtitle: subtitleOverride,
}: {
    dict: ToursHeaderDict;
    destinationName: string;
    total: number;
    /** Pre-resolved title - skips the `dict.title` template (category page). */
    title?: string;
    /** Pre-resolved subtitle - overrides `dict.subtitle` (category page). */
    subtitle?: string;
}) {
    const title =
        titleOverride ??
        dict.title
            .replace('{destination}', destinationName)
            .replace('{year}', String(await getCurrentYear()));
    // The bundled subtitle is a template ("… on {destination}"), so it names the
    // island it is actually rendering on. A pre-resolved override is used as-is.
    const subtitle =
        subtitleOverride ??
        dict.subtitle.replace('{destination}', destinationName);
    const count = dict.availableCount.replace('{count}', String(total));

    return (
        // No own entrance animation: this header renders in the STATIC shell, so
        // the sitewide PageTransition already animates it in on navigation.
        <div className='flex flex-col'>
            <h1 className='m-0 text-[32px] md:text-[48px] leading-[1.2] tracking-[-0.012em] text-it-heading font-medium'>
                {title}
            </h1>
            <p className='m-0 mt-2 max-w-[640px] text-[14px] md:text-[16px] leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
                {subtitle}
            </p>
            <p className='m-0 mt-1.5 text-[12.5px] leading-[1.6] text-it-text-muted tabular-nums'>
                {count} {dict.availableLabel}
            </p>
        </div>
    );
}

