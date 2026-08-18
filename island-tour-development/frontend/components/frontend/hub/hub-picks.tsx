import { Reveal } from '../reveal';
import {
    HubPickCard,
    type HubPick,
    type HubPickCardDict,
} from './hub-pick-card';

export type HubPicksData = {
    title: string;
    subtitle: string;
    /** Footer note, e.g. "Our honest picks, not paid placements." */
    footerNote: string;
    items: HubPick[];
    card: HubPickCardDict;
};

/**
 * "We've been on every boat" editorial top-picks block (Figma node 48024:11563 /
 * 48539:15821) - heading + a stack of split <HubPickCard>s + a footer note.
 * Rendered inside the Private charters panel.
 */
export function HubPicks({ data }: { data: HubPicksData }) {
    return (
        <Reveal className='flex flex-col gap-10 md:gap-12'>
            <div className='flex flex-col gap-1'>
                <h3 className='m-0 text-[20px] md:text-[32px] leading-[1.2] tracking-[-0.012em] text-it-heading font-medium'>
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
                {data.footerNote}
            </p>
        </Reveal>
    );
}

