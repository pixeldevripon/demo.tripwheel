'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

/** Which phase of the checkout is currently active. */
export type CheckoutPhase = 'contact' | 'payment';

type StepState = 'active' | 'done' | 'upcoming';

/**
 * One node of the progress indicator - a 42px circle above its label, gap 8
 * (Figma 47659:2358 / 47667:15299). Active = #d9d9d9-filled circle; completed /
 * upcoming = white circle with a #d9d9d9 ring; completed shows the dark check.
 * A completed step is tappable to jump back to it.
 */
function Step({
    number,
    label,
    state,
    onClick,
}: {
    number: number;
    label: string;
    state: StepState;
    onClick?: () => void;
}) {
    const circle =
        state === 'active'
            ? 'bg-[#d9d9d9]'
            : 'border border-[#d9d9d9] bg-it-white';
    return (
        <button
            type='button'
            onClick={onClick}
            disabled={!onClick}
            className='relative flex flex-col items-center gap-2 border-none bg-transparent p-0 enabled:cursor-pointer disabled:cursor-default'>
            <span
                className={`grid size-[42px] place-items-center rounded-full transition-colors duration-300 ${circle}`}>
                {state === 'done' ? (
                    <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{
                            type: 'spring',
                            stiffness: 500,
                            damping: 30,
                        }}
                        className='grid place-items-center'>
                        <Image
                            src='/icons/checkout/step-check.svg'
                            alt=''
                            width={17}
                            height={12}
                            className='h-3 w-[17px] shrink-0'
                        />
                    </motion.span>
                ) : (
                    <span className='font-medium text-[16px] leading-[1.4] tracking-[-0.012em] text-it-heading'>
                        {number}
                    </span>
                )}
            </span>
            <span className='font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                {label}
            </span>
        </button>
    );
}

/**
 * Two-step checkout progress indicator (Contact -> Payment). The short
 * connector line (Figma "Line 24", #d9d9d9) runs at circle-centre height and
 * tucks under both opaque circles; 75px between the two step cells. The
 * completed Contact step is tappable to return to it. Figma 47659:2358
 * (Contact active) / 47667:15299 (Payment active).
 */
export function CheckoutSteps({
    phase,
    contactLabel,
    paymentLabel,
    onGoToContact,
}: {
    phase: CheckoutPhase;
    contactLabel: string;
    paymentLabel: string;
    /** Return to the Contact phase (only wired while on Payment). */
    onGoToContact?: () => void;
}) {
    return (
        <div className='relative flex w-fit items-start gap-[75px]'>
            <div className='absolute inset-x-[21px] top-[21px] h-px bg-[#d9d9d9]' />
            <Step
                number={1}
                label={contactLabel}
                state={phase === 'contact' ? 'active' : 'done'}
                onClick={phase === 'payment' ? onGoToContact : undefined}
            />
            <Step
                number={2}
                label={paymentLabel}
                state={phase === 'payment' ? 'active' : 'upcoming'}
            />
        </div>
    );
}
