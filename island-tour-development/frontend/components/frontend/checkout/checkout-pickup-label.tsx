'use client';

import Image from 'next/image';
import { createContext, useContext, type ReactNode } from 'react';

/**
 * Live pickup label for the checkout summary.
 *
 * The summary card is SERVER-rendered (streamed into the client shell as a node),
 * but the pickup is chosen in the client form - so the summary can never see the
 * selection through props. This context bridges the two: `CheckoutClient` owns the
 * selected label and provides it; the summary's pickup row is the one client leaf
 * that consumes it, falling back to the server-rendered label ("No pickup") until
 * the traveller picks something.
 */
const PickupLabelContext = createContext<string | null>(null);

export function PickupLabelProvider({
    value,
    children,
}: {
    value: string | null;
    children: ReactNode;
}) {
    return (
        <PickupLabelContext.Provider value={value}>
            {children}
        </PickupLabelContext.Provider>
    );
}

/**
 * The summary card's pickup row - markup identical to the server `SummaryRow`
 * (icon 24, gap 10), just with a live label.
 */
export function CheckoutSummaryPickupRow({ fallback }: { fallback: string }) {
    const live = useContext(PickupLabelContext);
    return (
        <div className='flex items-center justify-between gap-2.5'>
            <span className='flex items-center gap-2.5 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                <Image
                    src='/icons/checkout/location.svg'
                    alt=''
                    width={24}
                    height={24}
                    className='size-6 shrink-0'
                />
                {live ?? fallback}
            </span>
        </div>
    );
}
