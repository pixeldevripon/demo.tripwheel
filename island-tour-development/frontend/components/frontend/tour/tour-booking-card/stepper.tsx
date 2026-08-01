'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { springPop } from '@/lib/motion';

/** Circular +/- stepper button (Figma node 49212:8122). */
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
            className='grid size-10 shrink-0 cursor-pointer place-items-center rounded-it-full border border-it-border-subtle bg-transparent transition-colors duration-300 hover:bg-it-bg disabled:cursor-not-allowed disabled:opacity-35'>
            <Image
                src={`/icons/stepper-${sign}.svg`}
                alt=''
                width={20}
                height={20}
                className='size-5 shrink-0'
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
        <div className='flex items-center gap-2.5'>
            <StepperButton
                sign='minus'
                label={decLabel}
                disabled={value <= min}
                onClick={() => onChange(value - 1)}
            />
            <span className='min-w-4 text-center font-medium text-[18px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
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
