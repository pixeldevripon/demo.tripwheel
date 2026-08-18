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
    variant = 'subtle',
}: {
    /** 1-based step number, as displayed. */
    step: number;
    /** Positioning only - the disc's own chrome is fixed. */
    className?: string;
    /**
     * `subtle` - 30px peach disc with orange numeral (the policy modal).
     * `solid`  - 40px deep-orange disc with a white numeral, per Figma
     *            47936:3716, used by the "What to Expect" timeline.
     *
     * Two variants rather than one restyle: the tour node specifies the solid
     * disc, but the policy modal is not in that node and its steps are a quiet
     * aside, not the spine of a section.
     */
    variant?: 'subtle' | 'solid';
}) {
    return (
        <span
            className={cn(
                'grid shrink-0 place-items-center rounded-it-full tabular-nums tracking-[-0.012em]',
                variant === 'solid'
                    ? 'size-9 bg-it-primary it-text font-medium leading-[1.4] text-it-white lg:size-10 '
                    : 'size-[30px] bg-it-primary-subtle text-[12px] font-medium text-it-primary-hover',
                className
            )}>
            {step}
        </span>
    );
}
