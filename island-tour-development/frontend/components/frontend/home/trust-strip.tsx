import Image from 'next/image';
import { Reveal } from '../reveal';

/**
 * Icons stay in the component; the copy comes from the dictionary (same order).
 *
 * Figma 47042:2178 replaces the design v2 microbar set: the deposit cell is a
 * WALLET rather than a lock, and the chat cell is `messages-2`. All three are
 * the real 40x40 exports with their #E8611A baked in, so they are rendered
 * through next/image at their intrinsic size and never recoloured by a text
 * utility (see CLAUDE.md, "Icons").
 */
const icons = [
    '/icons/trust-wallet.svg',
    '/icons/trust-check.svg',
    '/icons/trust-messages.svg',
];

export type TrustItem = { title: string; body: string };

/**
 * Single trust cell.
 *
 * Figma stacks these VERTICALLY and CENTRES them - a bare icon, 24px of air,
 * then the copy with 4px between title and body, every line centred
 * (counterAxisAlignItems CENTER on the cell, textAlignHorizontal CENTER on both
 * text nodes).
 *
 * The icon renders at 32px rather than Figma's 40 - a founder call, the same
 * one that took the type scale down. The earlier build sat it in a 40px peach
 * tile with the copy left-aligned beside it; the tile, the horizontal
 * arrangement and the left alignment are all gone.
 */
function TrustCard({ icon, item }: { icon: string; item: TrustItem }) {
    return (
        <div className='flex flex-col items-center gap-6 text-center'>
            <Image
                src={icon}
                alt=''
                width={40}
                height={40}
                className='size-8 shrink-0'
            />
            <div className='flex flex-col items-center gap-1'>
                <h3 className='m-0 text-[14.5px] font-medium leading-[1.6] tracking-[-0.012em] text-it-heading md:text-[18px]'>
                    {item.title}
                </h3>
                <p className='m-0 text-[13px] leading-[1.6] tracking-[-0.012em] text-it-text-muted md:text-[14.5px]'>
                    {item.body}
                </p>
            </div>
        </div>
    );
}

export function TrustStrip({ items }: { items: TrustItem[] }) {
    return (
        <section className='bg-it-white pt-10 md:pt-16 pb-0!'>
            <div className='it-container'>
                {/* 3 across on desktop, stacked on mobile. Figma's columns are
                    384px on a 1200px row with a 24px gutter, which is what a
                    3-col grid with gap-6 resolves to inside the container. */}
                <div className='grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-6'>
                    {items.map((item, i) => (
                        <Reveal key={item.title} delay={0} listItem>
                            <TrustCard icon={icons[i]} item={item} />
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
}
