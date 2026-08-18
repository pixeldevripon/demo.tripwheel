import { getPlatformReviews } from '@/lib/api/public/platform-reviews';

import { Reveal } from '../reveal';

/** Provider display names for the summary line. */
const PROVIDER_LABELS: Record<string, string> = {
    trustpilot: 'Trustpilot',
    google: 'Google',
};

// Figma star - fill inherits from text colour (currentColor) so it can be green or coral
function Star({ className }: { className?: string }) {
    return (
        <svg
            viewBox='0 0 20 20'
            fill='currentColor'
            aria-hidden='true'
            className={className}>
            <path d='M19.9478 7.28126C19.8839 7.08307 19.763 6.90808 19.6003 6.77811C19.4376 6.64815 19.2402 6.56894 19.0328 6.55038L13.2602 6.02619L10.9776 0.683474C10.8092 0.29194 10.426 0.0385742 10.0001 0.0385742C9.57422 0.0385742 9.19089 0.291979 9.0226 0.68445L6.73997 6.02623L0.9665 6.55038C0.759313 6.56936 0.562253 6.64873 0.39975 6.77865C0.237248 6.90857 0.116451 7.08333 0.052336 7.28126C-0.079347 7.68627 0.0422577 8.13046 0.363164 8.41047L4.72656 12.2371L3.43988 17.9049C3.34574 18.3216 3.50746 18.7524 3.85325 19.0023C4.03908 19.1366 4.25655 19.205 4.47581 19.205C4.66488 19.205 4.85238 19.154 5.02074 19.0533L10.0001 16.0773L14.9776 19.0533C15.3419 19.2724 15.801 19.2524 16.146 19.0023C16.3149 18.88 16.4442 18.7108 16.5177 18.5157C16.5912 18.3206 16.6057 18.1082 16.5594 17.9049L15.2728 12.2371L19.6361 8.41125C19.7931 8.27416 19.9063 8.09398 19.9617 7.89308C20.0171 7.69219 20.0123 7.47943 19.9478 7.28126Z' />
        </svg>
    );
}

function Stars({
    className,
    count = 5,
}: {
    className?: string;
    count?: number;
}) {
    return (
        <div
            className={`flex items-center gap-1 md:gap-1.5 ${className ?? ''}`}>
            {Array.from({ length: Math.max(1, Math.min(5, count)) }).map(
                (_, i) => (
                    <Star key={i} className='size-4 md:size-5' />
                )
            )}
        </div>
    );
}

/**
 * Homepage testimonials band - live third-party reviews (Trustpilot / Google),
 * admin-configured in the dashboard. The backend gates visibility (enabled +
 * fetched + count > 100), so this renders nothing until the platform has real
 * social proof to show.
 */
export async function Testimonials() {
    const data = await getPlatformReviews();
    if (!data.visible || !data.displayPages.includes('homepage')) return null;

    const providerLabel =
        PROVIDER_LABELS[data.provider ?? ''] ?? (data.provider || 'reviews');
    const cards = data.reviews.slice(0, 3);

    return (
        <section className='bg-it-white border-y border-it-divider py-12 md:py-[54px]'>
            <div className='it-container'>
                <Reveal className='flex flex-col items-center gap-[26px]'>
                    {/* Platform summary (Trustpilot / Google) */}
                    <div className='flex flex-wrap items-center justify-center gap-x-2.5 gap-y-2'>
                        <Stars className='text-it-star' />
                        <p className='m-0 flex flex-wrap items-baseline gap-x-1.5'>
                            <span className='font-medium text-[16px] leading-[1.6] text-it-ink'>
                                {data.rating ?? ''} on {providerLabel}
                            </span>
                            <span className='text-[14px] leading-[1.6] text-it-text-muted tabular-nums'>
                                · {data.reviewCount} reviews
                            </span>
                        </p>
                    </div>

                    {/* Review cards - stacked on mobile, 3-col grid on desktop
                        (design v2 .quotes). */}
                    <div className='grid w-full grid-cols-1 gap-4 md:grid-cols-3 md:gap-5'>
                        {cards.map((r, i) => (
                            <Reveal
                                key={`${r.author}-${i}`}
                                width='auto'
                                listItem>
                                <article className='flex h-full flex-col justify-between gap-6 rounded-it-md border border-it-divider bg-it-bg shadow-it-sm px-5 py-[18px]'>
                                    <div className='flex flex-col gap-2'>
                                        <Stars
                                            className='text-it-star'
                                            count={Math.round(r.rating)}
                                        />
                                        <p className='m-0 text-[14px] md:text-[16px] leading-[1.6] text-it-ink line-clamp-5 md:line-clamp-7 tracking-[-0.012em]'>
                                            {r.text}
                                        </p>
                                    </div>

                                    <div className='flex flex-col gap-0.5'>
                                        <div className='flex flex-wrap items-center gap-x-2 text-[12.5px] leading-[1.6] text-it-text-muted'>
                                            <span className='font-medium text-it-ink'>
                                                {r.author}
                                            </span>
                                            {r.relativeTime && (
                                                <span>· {r.relativeTime}</span>
                                            )}
                                        </div>
                                        <span className='text-[12px] leading-[1.6] text-it-ink-muted'>
                                            via {providerLabel}
                                        </span>
                                    </div>
                                </article>
                            </Reveal>
                        ))}
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

