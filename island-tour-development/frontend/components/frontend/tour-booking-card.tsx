import Image from 'next/image';

export type TourBookingDict = {
    from: string;
    perPerson: string;
    continue: string;
    selected: string;
    soldOut: string;
    /** "Only {count} left" */
    onlyLeft: string;
    /** "{count} Travelers" */
    travelers: string;
    total: string;
    payToday: string;
    balanceLater: string;
    taxesIncluded: string;
    showDetails: string;
    /** "Free cancellation up to {hours}h" */
    freeCancellation: string;
    /** "Pay only {pct}% today, the rest later" */
    payLater: string;
    sellOutTitle: string;
    sellOutSubtitle: string;
};

/**
 * Tour booking card - static / presentational (Figma node 47936:3386).
 *
 * The right-rail widget in its expanded state: price header, date field, three
 * time-slot chips (selected / limited / sold-out), a traveler + price summary,
 * the Continue CTA, two trust lines, and a "Likely to sell out" notice beneath.
 * All values are placeholders matching the design; the real date/party/pricing
 * logic lands with the booking module. Only the chrome labels are localized.
 */
export function TourBookingCard({ dict }: { dict: TourBookingDict }) {
    // Static placeholder content from the Figma wireframe (no booking logic yet).
    const date = 'Tue 28 May';
    const slots = [
        { time: '8:00 AM', note: dict.selected, selected: true },
        { time: '1:00 PM', note: dict.onlyLeft.replace('{count}', '2'), selected: false },
        { time: '4:00 PM', note: dict.soldOut, selected: false },
    ];
    const summary = [
        { label: dict.total, value: '$240', accent: false },
        { label: dict.payToday, value: '$48', accent: true },
        { label: dict.balanceLater, value: '$192', accent: false },
    ];

    return (
        <div className='flex flex-col gap-4'>
            {/* Main booking card */}
            <div className='overflow-hidden rounded-[16px] bg-it-surface'>
                {/* Price header */}
                <div className='flex items-baseline gap-1 border-b border-it-heading/10 px-4 py-4 text-it-heading'>
                    <span className='text-[24px] leading-[1.2] tracking-[-0.012em]'>
                        {dict.from}
                    </span>
                    <span className='text-[28px] font-bold leading-[1.4] tracking-[-0.012em]'>
                        $120
                    </span>
                    <span className='text-[24px] leading-[1.2] tracking-[-0.012em]'>
                        {dict.perPerson}
                    </span>
                </div>

                {/* Content: selectors + CTA */}
                <div className='flex flex-col gap-6 p-4'>
                    <div className='flex flex-col gap-2.5'>
                        {/* Date field */}
                        <div className='flex items-center justify-between gap-2.5 rounded-[8px] bg-it-white px-4 py-4'>
                            <span className='text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                {date}
                            </span>
                            <Image
                                src='/icons/booking-calendar.svg'
                                alt=''
                                width={24}
                                height={24}
                                className='size-6 shrink-0'
                            />
                        </div>

                        {/* Time slots */}
                        <div className='grid grid-cols-3 gap-2'>
                            {slots.map(s => (
                                <div
                                    key={s.time}
                                    className={`flex flex-col items-center gap-[3px] rounded-[8px] bg-it-white px-4 py-2 ${
                                        s.selected
                                            ? 'border border-it-primary'
                                            : 'border border-transparent'
                                    }`}>
                                    <span className='font-medium text-[18px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                        {s.time}
                                    </span>
                                    <span className='text-[14px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                        {s.note}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Traveler + price summary */}
                        <div className='flex flex-col gap-5 rounded-[8px] bg-it-white p-4'>
                            <div className='flex flex-col gap-3.5'>
                                <div className='flex items-center justify-between gap-1'>
                                    <span className='flex items-center gap-2.5 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                        <Image
                                            src='/icons/booking-travelers.svg'
                                            alt=''
                                            width={24}
                                            height={24}
                                            className='size-6 shrink-0'
                                        />
                                        {dict.travelers.replace('{count}', '2')}
                                    </span>
                                    <Image
                                        src='/icons/booking-chevron-right.svg'
                                        alt=''
                                        width={20}
                                        height={20}
                                        className='size-5 shrink-0'
                                    />
                                </div>

                                <div className='h-px w-full bg-it-heading/10' />

                                <div className='flex items-center justify-between gap-1 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                    <span>Adult x 2 x $120</span>
                                    <span>$240</span>
                                </div>

                                <div className='h-px w-full bg-it-heading/10' />

                                <div className='flex flex-col gap-2'>
                                    {summary.map(row => (
                                        <div
                                            key={row.label}
                                            className='flex items-center justify-between gap-1 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                            <span>{row.label}</span>
                                            <span className={row.accent ? 'text-it-primary' : undefined}>
                                                {row.value}
                                            </span>
                                        </div>
                                    ))}
                                    <span className='text-[14px] leading-[1.6] tracking-[-0.012em] text-it-ink-muted'>
                                        {dict.taxesIncluded}
                                    </span>
                                </div>
                            </div>

                            <button
                                type='button'
                                className='cursor-pointer self-center border-none bg-transparent text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                {dict.showDetails}
                            </button>
                        </div>
                    </div>

                    {/* CTA + trust lines */}
                    <div className='flex flex-col gap-5'>
                        <button
                            type='button'
                            className='flex w-full cursor-pointer items-center justify-center rounded-it-full border-none bg-it-primary px-10 py-[19px] font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-white transition-colors hover:bg-it-primary-hover'>
                            {dict.continue}
                        </button>
                        <div className='flex flex-col gap-2'>
                            {[
                                dict.freeCancellation.replace('{hours}', '48'),
                                dict.payLater.replace('{pct}', '20'),
                            ].map(line => (
                                <span
                                    key={line}
                                    className='flex items-center gap-2 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                    <Image
                                        src='/icons/booking-check.svg'
                                        alt=''
                                        width={20}
                                        height={20}
                                        className='size-5 shrink-0'
                                    />
                                    {line}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* "Likely to sell out" notice */}
            <div className='flex items-start gap-1 rounded-[16px] bg-it-surface p-4'>
                <Image
                    src='/icons/sell-out.svg'
                    alt=''
                    width={24}
                    height={24}
                    className='size-6 shrink-0'
                />
                <div className='flex flex-col gap-1'>
                    <span className='font-medium text-[18px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                        {dict.sellOutTitle}
                    </span>
                    <span className='text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                        {dict.sellOutSubtitle}
                    </span>
                </div>
            </div>
        </div>
    );
}
