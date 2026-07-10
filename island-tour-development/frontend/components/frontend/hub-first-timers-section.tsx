import Image from 'next/image';
import { Reveal } from './reveal';

/** One insider tip - a short title + an explanatory paragraph. */
export type HubFirstTimersTip = { title: string; body: string };

export type HubFirstTimersDict = {
    /** Resolved heading, e.g. "What we tell first-timers about Klein Curaçao". */
    title: string;
    /** Green-check quick takeaways shown above the divider. */
    highlights: string[];
    /** Titled tips, each rendered with an orange left rule on its body. */
    tips: HubFirstTimersTip[];
};

/**
 * Activity Hub "What we tell first-timers about {hub}" section (Figma node
 * 48024:12062 desktop / 48621:8414 mobile). A heading, a row of green-check quick
 * takeaways above a hairline divider, then a list of titled tips - each tip's
 * body carries a 2/3px orange left rule.
 *
 * Layout (Figma): heading -> takeaways+divider -> tips, with section gaps 24/48
 * (mobile/desktop) heading->takeaways, 40/48 takeaways->tips; takeaways stack on
 * mobile and spread (space-between) on desktop; the takeaway->divider gap is
 * 24/40 and the inter-tip gap is 24/32.
 *
 * Pure + data-driven: owns no state. `highlights` (HIGHLIGHT content sections)
 * and `tips` (LOCAL_TIP content sections) come from the hub render payload
 * (dashboard-managed, per-locale); the title comes from the dictionary. The
 * green-check takeaways row is hidden when a hub has no highlights.
 */
export function HubFirstTimersSection({ dict }: { dict: HubFirstTimersDict }) {
    return (
        <section className='it-section pt-0! bg-it-white'>
            <div className='it-container'>
                <Reveal className='flex flex-col gap-10 md:gap-12'>
                    {/* Heading + quick takeaways (grouped: 24px gap on mobile,
                        48px on desktop). */}
                    <div className='flex flex-col gap-6 md:gap-12'>
                        <h2 className='m-0 font-medium text-[24px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                            {dict.title}
                        </h2>

                        {/* Takeaways stacked (mobile) / spread (desktop) + divider.
                            Hidden when the hub has no HIGHLIGHT sections. */}
                        {dict.highlights.length > 0 && (
                            <div className='flex flex-col gap-6 md:gap-10'>
                                <ul className='m-0 flex list-none flex-col gap-2 p-0 md:flex-row md:flex-wrap md:justify-between md:gap-x-6 md:gap-y-3'>
                                    {dict.highlights.map((highlight) => (
                                        <li
                                            key={highlight}
                                            className='flex items-center gap-2'>
                                            <Image
                                                src='/icons/check-green.svg'
                                                alt=''
                                                width={24}
                                                height={24}
                                                className='size-6 shrink-0'
                                            />
                                            <span className='font-medium text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                                {highlight}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                                <div
                                    className='h-px w-full bg-it-border-subtle'
                                    aria-hidden='true'
                                />
                            </div>
                        )}
                    </div>

                    {/* Tips - title + orange-ruled body */}
                    <div className='flex flex-col gap-6 md:gap-8'>
                        {dict.tips.map((tip) => (
                            <div key={tip.title} className='flex flex-col gap-2'>
                                <h3 className='m-0 font-medium text-[16px] md:text-[20px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                    {tip.title}
                                </h3>
                                <div className='border-l-2 border-it-primary pl-4 md:border-l-[3px] md:pl-5'>
                                    <p className='m-0 text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                        {tip.body}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Reveal>
            </div>
        </section>
    );
}
