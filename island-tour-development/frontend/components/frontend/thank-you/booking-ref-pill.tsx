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
        <div
            className={`flex items-center gap-2.5 rounded-it-full border border-it-border bg-it-bg px-4 py-[9px] text-[13.5px] leading-[1.5] ${className}`}>
            <span className='text-it-text-muted'>{dict.bookingRef}</span>
            <code className='font-mono font-bold tracking-[0.02em] text-it-ink'>
                {displayRef}
            </code>
            <BookingRefCopy
                displayRef={displayRef}
                copyLabel={dict.copy}
                copiedLabel={dict.copied}
                ariaLabel={`${dict.bookingRef} ${displayRef}`}
            />
        </div>
    );
}
