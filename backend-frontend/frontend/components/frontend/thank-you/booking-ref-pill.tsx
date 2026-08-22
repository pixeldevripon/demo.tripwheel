import { BookingRefCopy } from './thank-you-hero-actions';

/**
 * The booking-reference pill: label + monospaced ref + copy button.
 *
 * ONE definition, shared by the celebratory hero and the booking-management
 * header. Those are the two presentations of the SAME page - the two things
 * most likely to be asked to look identical, and the two most likely to drift.
 * They were byte-identical copies except for the management header's
 * positioning classes, which is what `className` is for here.
 *
 * Stays a Server Component: only the inner copy button is a client leaf.
 *
 * Render it only for a viewer who proved they own the booking. The reference is
 * what support identifies a traveller by, so the masked (shared-link) view does
 * not carry it - and the real owner already has it in their email.
 */
export function BookingRefPill({
    displayRef,
    dict,
    className = '',
}: {
    displayRef: string;
    dict: { bookingRef: string; copy: string; copied: string };
    /** Positional overrides only - the pill's own chrome is fixed. */
    className?: string;
}) {
    return (
        // Figma 47745:10846: "Booking ref:" is muted text OUTSIDE the pill;
        // the pill itself is a plain #f8f8f8 radius-8 box holding the ref and
        // the copy control. It was one bordered capsule with the label inside.
        <div
            className={`flex flex-wrap items-center justify-center gap-2 text-[14.5px] leading-[1.6] ${className}`}>
            <span className='text-it-text-muted tracking-[-0.012em]'>
                {dict.bookingRef}
            </span>
            <div className='flex h-[42px] min-w-[204px] items-center justify-between gap-4 rounded-[8px] bg-it-surface px-4'>
                <span className='font-medium tracking-[-0.012em] text-it-heading tabular-nums'>
                    {displayRef}
                </span>
                <BookingRefCopy
                    displayRef={displayRef}
                    copyLabel={dict.copy}
                    copiedLabel={dict.copied}
                    ariaLabel={`${dict.bookingRef} ${displayRef}`}
                />
            </div>
        </div>
    );
}

