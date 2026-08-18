import Image from 'next/image';
import { Reveal } from '../reveal';

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
                <Reveal className='flex flex-col gap-[26px]'>
                    {/* Heading + quick takeaways (grouped: 24px gap on mobile,
                        48px on desktop). */}
                    <div className='flex flex-col gap-[22px]'>
                        <h2 className='m-0 font-it-display text-[clamp(22px,2.8vw,30px)] leading-[1.2] tracking-[-0.012em] text-it-ink'>
                            {dict.title}
                        </h2>

                        {/* Takeaways stacked (mobile) / spread (desktop) + divider.
                            Hidden when the hub has no HIGHLIGHT sections. */}
                        {dict.highlights.length > 0 && (
                            <div className='flex flex-col gap-6 md:gap-10'>
                                {/* .checksrow: three bordered white cards */}
                                <ul className='m-0 grid list-none grid-cols-1 gap-3.5 p-0 md:grid-cols-3'>
                                    {dict.highlights.map((highlight, i) => (
                                        <li
                                            key={i}
                                            className='flex items-center gap-[9px] rounded-it-md border border-it-divider bg-it-white px-4 py-3.5 shadow-it-sm'>
                                            <Image
                                                src='/icons/trust-check-green.svg'
                                                alt=''
                                                width={24}
                                                height={24}
                                                className='size-4 shrink-0'
                                            />
                                            <span className='text-[14px] font-medium leading-[1.6] text-it-ink'>
                                                {highlight}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Tips - title + orange-ruled body */}
                    {/* .tips: titled tips over the peach left rule */}
                    <div className='flex max-w-[820px] flex-col gap-5'>
                        {dict.tips.map(tip => (
                            <Reveal
                                key={tip.title}
                                delay={0.02}
                                listItem
                                className='flex flex-col gap-1'>
                                <h3 className='m-0 text-[14.5px] leading-[1.6] text-it-ink'>
                                    {tip.title}
                                </h3>
                                <div className='border-l-[3px] border-it-peach-border py-0.5 pl-4'>
                                    <p className='m-0 text-[14px] md:text-[16px] leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
                                        {tip.body}
                                    </p>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

