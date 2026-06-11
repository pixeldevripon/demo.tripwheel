'use client';

export type HubTripsTab = { key: string; label: string };

/**
 * Hub trips tab bar (Figma node 48024:11222 desktop / 48539:15632 mobile).
 * Horizontal-scroll on mobile with a full-width baseline hairline; the active
 * tab carries the orange underline + dark medium text. 16px mobile / 20px
 * desktop. Controlled by the parent (`active` index + `onChange`).
 */
export function HubTripsTabs({
    tabs,
    active,
    onChange,
}: {
    tabs: HubTripsTab[];
    active: number;
    onChange: (index: number) => void;
}) {
    return (
        <div className='flex overflow-x-auto border-b border-it-heading/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
            {tabs.map((tab, i) => (
                <button
                    key={tab.key}
                    type='button'
                    onClick={() => onChange(i)}
                    aria-current={i === active ? 'true' : undefined}
                    className={`-mb-px shrink-0 cursor-pointer whitespace-nowrap border-b-2 bg-transparent px-5 py-4 text-[16px] leading-[1.6] tracking-[-0.012em] transition-colors md:px-7.5 md:py-5 md:text-[20px] ${
                        i === active
                            ? 'border-it-primary font-medium text-it-heading'
                            : 'border-transparent font-normal text-it-text-muted hover:text-it-heading'
                    }`}>
                    {tab.label}
                </button>
            ))}
        </div>
    );
}
