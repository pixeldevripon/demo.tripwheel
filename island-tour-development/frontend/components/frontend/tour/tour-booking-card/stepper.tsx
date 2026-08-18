'use client';

import { springPop } from '@/lib/motion';
import { motion } from 'framer-motion';
import Image from 'next/image';

/**
 * Circular +/- stepper button - `.ctr button` in mck-15: a 28px disc with a
 * hairline border.
 *
 * 28px of visible disc, with the touch target taken back out to 44px by an
 * invisible `before:` box (-8px on each side). The same trick the tour hero's
 * overlay actions use: sizing the disc itself at 44px to satisfy the target
 * floor puts six heavy circles in a card the mockup draws light, and the tap
 * area is not the thing that has to be seen.
 */
function StepperButton({
    sign,
    label,
    onClick,
    disabled,
}: {
    sign: 'minus' | 'plus';
    label: string;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (
        <motion.button
            type='button'
            aria-label={label}
            onClick={onClick}
            disabled={disabled}
            whileTap={disabled ? undefined : { scale: 0.9 }}
            transition={springPop}
            className='relative grid size-7 shrink-0 cursor-pointer place-items-center rounded-it-full border border-it-border bg-it-white transition-colors duration-200 before:absolute before:-inset-2 before:content-[""] hover:bg-it-bg disabled:cursor-not-allowed disabled:opacity-35'>
            <Image
                src={`/icons/stepper-${sign}.svg`}
                alt=''
                width={20}
                height={20}
                className='size-3.5 shrink-0'
            />
        </motion.button>
    );
}

/** A count control: (−) N (+) with min/max clamping. */
export function Stepper({
    value,
    onChange,
    min,
    max,
    decLabel,
    incLabel,
}: {
    value: number;
    onChange: (next: number) => void;
    min: number;
    max: number;
    decLabel: string;
    incLabel: string;
}) {
    return (
        // `.ctr`: the pair plus its count, 10px apart, pinned to the row's right
        // edge (`margin-left:auto`) and never shrinking under a long band label.
        // The auto margin is what keeps the extras' steppers in one column when
        // their names are different lengths.
        <div className='ml-auto flex shrink-0 items-center gap-2.5'>
            <StepperButton
                sign='minus'
                label={decLabel}
                disabled={value <= min}
                onClick={() => onChange(value - 1)}
            />
            <span className='min-w-4 text-center text-[14px] font-medium leading-[1.6] tabular-nums text-it-heading tracking-[-0.012em]'>
                {value}
            </span>
            <StepperButton
                sign='plus'
                label={incLabel}
                disabled={value >= max}
                onClick={() => onChange(value + 1)}
            />
        </div>
    );
}

