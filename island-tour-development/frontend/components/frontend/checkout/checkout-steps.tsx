'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

/** Which phase of the checkout is currently active. */
export type CheckoutPhase = 'contact' | 'payment';

type StepState = 'active' | 'done' | 'upcoming';

/**
 * One node of the progress indicator (design v2 .step): a 27px circle with its
 * label BESIDE it, gap 8. Active = orange-filled; done = green-filled with the
 * white check (tappable to jump back); upcoming = white with the subtle ring.
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
            ? 'bg-it-primary text-it-white tracking-[-0.012em]'
            : state === 'done'
              ? 'bg-it-green text-it-white tracking-[-0.012em]'
              : 'border-[1.5px] border-it-border bg-it-white text-it-text-muted tracking-[-0.012em]';
    return (
        <button
            type='button'
            onClick={onClick}
            disabled={!onClick}
            className='flex items-center gap-2 border-none bg-transparent p-0 enabled:cursor-pointer disabled:cursor-default'>
            <span
                className={`grid size-[27px] shrink-0 place-items-center rounded-full transition-colors duration-300 ${circle}`}>
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
                            src='/icons/checkout/check-tick-white.svg'
                            alt=''
                            width={24}
                            height={24}
                            className='size-[13px] shrink-0'
                        />
                    </motion.span>
                ) : (
                    <span className='text-[12px] font-medium leading-none tabular-nums tracking-[-0.012em]'>
                        {number}
                    </span>
                )}
            </span>
            <span
                className={`text-[12.5px] font-medium leading-[1.6] ${
                    state === 'upcoming' ? 'text-it-text-muted tracking-[-0.012em]' : ''
                }`}>
                {label}
            </span>
        </button>
    );
}

/**
 * Checkout progress indicator (design v2 .steps): horizontal circle+label
 * pairs joined by a 48px hairline. The completed Contact step is tappable to
 * return to it. `paymentStep=false` (operator_full - nothing to pay) drops the
 * line and the Payment node, leaving the single Contact marker.
 */
export function CheckoutSteps({
    phase,
    contactLabel,
    paymentLabel,
    onGoToContact,
    paymentStep = true,
}: {
    phase: CheckoutPhase;
    contactLabel: string;
    paymentLabel: string;
    /** Return to the Contact phase (only wired while on Payment). */
    onGoToContact?: () => void;
    /** False hides the Payment node (operator_full checkout). */
    paymentStep?: boolean;
}) {
    return (
        <div className='flex items-center'>
            <Step
                number={1}
                label={contactLabel}
                state={phase === 'contact' ? 'active' : 'done'}
                onClick={phase === 'payment' ? onGoToContact : undefined}
            />
            {paymentStep && (
                <>
                    <span className='mx-3 h-[1.5px] w-12 shrink-0 bg-it-border' />
                    <Step
                        number={2}
                        label={paymentLabel}
                        state={phase === 'payment' ? 'active' : 'upcoming'}
                    />
                </>
            )}
        </div>
    );
}

