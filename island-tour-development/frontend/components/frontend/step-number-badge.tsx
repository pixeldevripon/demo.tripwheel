import { cn } from '@/lib/utils';

/**
 * The numbered step circle: a tinted-orange disc holding a step number.
 *
 * ONE definition, shared by the tour page's "What to expect" timeline and the
 * two policy modals opened from the booking card's trust lines. The client asked
 * for the modals to use "the same circles as What to expect", and the acceptance
 * criterion is that they are *visually identical* - which is only true by
 * construction if there is a single component. Two copies of these class strings
 * would look identical on the day they were written and diverge on the first
 * design tweak that reaches one file.
 *
 * NOT `aria-hidden`. The number is real content here: both call sites render
 * inside an `<ol>`, and while list semantics convey order to a screen reader,
 * the visible numeral is what the copy refers to ("step 2"). It stays readable.
 *
 * `tabular-nums` so a two-digit step does not shift the disc's optical centre.
 */
export function StepNumberBadge({
    step,
    className,
}: {
    /** 1-based step number, as displayed. */
    step: number;
    /** Positioning only - the disc's own chrome is fixed. */
    className?: string;
}) {
    return (
        <span
            className={cn(
                'grid size-[30px] shrink-0 place-items-center rounded-it-full bg-it-primary-subtle text-[13px] font-medium text-it-primary-hover tabular-nums',
                className
            )}>
            {step}
        </span>
    );
}
