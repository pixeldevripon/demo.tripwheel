import { cacheLife } from 'next/cache';

export type ToursHeaderDict = {
    /** Title template — e.g. "All {destination} tours & activities in {year}" */
    title: string;
    subtitle: string;
    /** Count template — e.g. "{count} tours" (rendered emphasised) */
    availableCount: string;
    /** Trailing muted word — e.g. "available" */
    availableLabel: string;
};

/**
 * Current year, read inside a Cache Component so the prerender stays static
 * (Next 16 forbids bare `new Date()` in a server component). Refreshes daily,
 * so the title rolls over within a day of the new year.
 */
async function getCurrentYear(): Promise<number> {
    'use cache';
    cacheLife('days');
    return new Date().getFullYear();
}

/**
 * All Tours page heading — title, subtitle and total-count line.
 * Matches Figma node 47167:4025.
 */
export async function ToursHeader({
    dict,
    destinationName,
    total,
}: {
    dict: ToursHeaderDict;
    destinationName: string;
    total: number;
}) {
    const title = dict.title
        .replace('{destination}', destinationName)
        .replace('{year}', String(await getCurrentYear()));
    const count = dict.availableCount.replace('{count}', String(total));

    return (
        <div className='flex flex-col gap-2'>
            <div className='flex flex-col gap-1'>
                <h1 className='m-0 font-medium text-[32px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                    {title}
                </h1>
                <p className='m-0 text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                    {dict.subtitle}
                </p>
            </div>
            <p className='m-0 text-[16px] leading-[1.6] tracking-[-0.012em]'>
                <span className='font-medium text-it-heading'>{count}</span>{' '}
                <span className='text-it-text-muted'>{dict.availableLabel}</span>
            </p>
        </div>
    );
}
