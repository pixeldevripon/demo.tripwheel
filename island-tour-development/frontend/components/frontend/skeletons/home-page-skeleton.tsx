import { Bar } from './skeleton-bar';

/**
 * Full homepage skeleton (design v2 loading state) - single solid shimmering
 * paper blocks per piece, mirroring the mockup's `.reelskl` (centered 9:16
 * blocks, 22px radius) and `.islskl` (3-col 3/2.5 tiles), plus silhouettes
 * for the hero, microbar, editorial band, and FAQ band so a cold load never
 * shows a blank viewport.
 */
export function HomePageSkeleton() {
    return (
        <>
            {/* Hero: heading + search pill + quick links. Flat bg only. */}
            <section className='relative flex min-h-[520px] items-end justify-center bg-it-hero-bg pb-14 md:min-h-0 md:h-[clamp(500px,62vh,660px)] md:items-center md:pb-0'>
                <div className='it-container flex w-full justify-center'>
                    <div className='flex w-full max-w-[680px] flex-col items-center gap-7'>
                        <div className='flex w-full flex-col items-center gap-3'>
                            <Bar className='h-10 w-11/12 max-w-lg md:h-12' />
                            <Bar className='h-5 w-2/3 max-w-sm rounded-it-sm' />
                        </div>
                        <div className='flex w-full max-w-[580px] flex-col items-center gap-4'>
                            <Bar className='h-14 w-full rounded-it-full md:h-[62px]' />
                            <Bar className='h-4 w-64 max-w-full rounded-it-sm' />
                        </div>
                    </div>
                </div>
            </section>

            {/* USP microbar: 3 cells - icon tile + two copy lines. */}
            <section className='bg-it-white pt-7 pb-1 md:pt-10'>
                <div className='it-container grid grid-cols-1 gap-4 py-1.5 md:grid-cols-3 md:gap-[26px]'>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className='flex items-start gap-3.5'>
                            <Bar className='size-10 shrink-0' />
                            <div className='flex w-full flex-col gap-1.5 pt-0.5'>
                                <Bar className='h-3.5 w-2/3 rounded-it-xs' />
                                <Bar className='h-3 w-5/6 rounded-it-xs' />
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Reels rail (design v2 .reelskl): centered 9:16 blocks. */}
            <section className='it-section bg-it-white'>
                <div className='it-container flex flex-col items-center gap-8'>
                    <Bar className='h-8 w-64 max-w-full' />
                    <div className='flex h-[330px] items-center justify-center gap-3 md:h-[465px] md:gap-[18px]'>
                        <Bar className='hidden aspect-[9/16] w-[206px] rounded-it-xl md:block' />
                        <Bar className='aspect-[9/16] w-[172px] rounded-it-xl md:w-[248px]' />
                        <Bar className='hidden aspect-[9/16] w-[206px] rounded-it-xl md:block' />
                    </div>
                </div>
            </section>

            {/* Islands (design v2 .islskl): 3-col 3/2.5 tiles. */}
            <section className='it-section bg-it-white'>
                <div className='it-container flex flex-col gap-[18px]'>
                    <div className='flex flex-col gap-2'>
                        <Bar className='h-8 w-64 max-w-full' />
                        <Bar className='h-4 w-52 max-w-full rounded-it-sm' />
                    </div>
                    <div className='grid gap-5 md:grid-cols-3'>
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Bar key={i} className='aspect-[3/2.5] w-full' />
                        ))}
                    </div>
                </div>
            </section>

            {/* Editorial band: one rounded block at the band's height. */}
            <section className='it-section bg-it-white'>
                <div className='it-container'>
                    <Bar className='h-[372px] w-full rounded-it-xl' />
                </div>
            </section>

            {/* NeedHelp band: copy column + accordion rows. Rows sit on the
                paper band, so they take the WHITE surface of the real cards -
                a paper block on the paper band would be invisible. */}
            <section className='it-section bg-it-surface'>
                <div className='it-container flex flex-col gap-10 lg:flex-row lg:gap-12'>
                    <div className='flex flex-col gap-4 lg:w-115 lg:shrink-0'>
                        <Bar className='h-8 w-72 max-w-full [--it-skeleton-bg:var(--it-white)]' />
                        <Bar className='h-4 w-4/5 rounded-it-sm [--it-skeleton-bg:var(--it-white)]' />
                        <Bar className='mt-3 h-11 w-44 rounded-it-full [--it-skeleton-bg:var(--it-white)]' />
                    </div>
                    <div className='flex flex-1 flex-col gap-2.5'>
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Bar key={i} className='h-13 w-full [--it-skeleton-bg:var(--it-white)]' />
                        ))}
                    </div>
                </div>
            </section>
        </>
    );
}
