import Link from 'next/link';
import { Reveal } from '../reveal';
import {
    HubPickCard,
    type HubPick,
    type HubPickCardDict,
} from './hub-pick-card';

export type HubPicksData = {
    title: string;
    subtitle: string;
    /** Footer note before the link, e.g. "Our honest picks not paid placements." */
    footerNote: string;
    seeAllLabel: string;
    seeAllHref: string;
    items: HubPick[];
    card: HubPickCardDict;
};

/**
 * "We've been on every boat" editorial top-picks block (Figma node 48024:11563 /
 * 48539:15821) - heading + a stack of split <HubPickCard>s + a footer note with
 * a "See All Tours" link. Rendered inside the Private charters panel.
 */
export function HubPicks({ data }: { data: HubPicksData }) {
    return (
        <Reveal className='flex flex-col gap-10 md:gap-12'>
            <div className='flex flex-col gap-1'>
                <h3 className='m-0 font-it-display text-[clamp(22px,2.8vw,30px)] font-bold leading-[1.2] tracking-[-0.015em] text-it-ink'>
                    {data.title}
                </h3>
                <p className='m-0 text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                    {data.subtitle}
                </p>
            </div>

            <div className='flex flex-col gap-2'>
                {data.items.map(pick => (
                    <Reveal key={pick.id} listItem>
                        <HubPickCard
                            key={pick.id}
                            pick={pick}
                            dict={data.card}
                        />
                    </Reveal>
                ))}
            </div>

            <p className='m-0 text-left text-[14px] md:text-center md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                {data.footerNote}{' '}
                <Link
                    href={data.seeAllHref}
                    className='font-medium text-it-primary underline decoration-1 underline-offset-4 transition-colors hover:text-it-heading'>
                    {data.seeAllLabel}
                </Link>
            </p>
        </Reveal>
    );
}

