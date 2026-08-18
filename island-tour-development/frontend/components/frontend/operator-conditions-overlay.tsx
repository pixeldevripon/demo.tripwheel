'use client';

import { ModalShell } from '@/components/frontend/modal-shell';
import { OperatorConditionsBody } from '@/components/frontend/operator-conditions-body';
import { springPop } from '@/lib/motion';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

/**
 * The intercepted rendering of /{locale}/operators/{slug}/conditions
 * (Pastel #80 / MCK-20 §3): an in-app link to the conditions URL opens this
 * overlay above the page the reader came from - tour page, checkout, anywhere -
 * while the URL is the shareable canonical address. Closing goes BACK in
 * history, so the page underneath is exactly where the reader left it; a
 * refresh or a direct load renders the full canonical page instead.
 *
 * Read-only by design: agreeing to the conditions is the CHECKOUT's job (its
 * in-flow reader ticks the box); this overlay only lets anyone read them.
 */
export function OperatorConditionsOverlay({
    title,
    versionLine,
    closeLabel,
    html,
}: {
    title: string;
    versionLine: string;
    closeLabel: string;
    html: string;
}) {
    const router = useRouter();
    const close = () => router.back();

    return (
        <ModalShell
            open
            onClose={close}
            ariaLabel={title}
            panelClassName='sm:max-h-[85vh] sm:max-w-[720px] sm:gap-5'>
            {/* Header - does not scroll */}
            <div className='flex shrink-0 flex-col gap-4'>
                <div className='flex items-start justify-between gap-4'>
                    <div className='flex flex-col gap-1'>
                        <h2 className='m-0 font-it-display text-[21px] leading-[1.2] tracking-[-0.012em] text-it-heading sm:text-[22px] font-medium'>
                            {title}
                        </h2>
                        <span className='text-[13px] leading-[1.5] text-it-text-muted tracking-[-0.012em]'>
                            {versionLine}
                        </span>
                    </div>
                    <motion.button
                        type='button'
                        aria-label={closeLabel}
                        onClick={close}
                        whileTap={{ scale: 0.9 }}
                        transition={springPop}
                        className='-mt-0.5 grid size-9 shrink-0 cursor-pointer place-items-center rounded-it-full border border-it-ink/10 bg-it-surface transition-colors duration-300 hover:bg-it-border sm:size-10'>
                        <Image
                            src='/icons/modal-close.svg'
                            alt=''
                            width={24}
                            height={24}
                            className='size-4 shrink-0 sm:size-[18px]'
                        />
                    </motion.button>
                </div>
                <div className='h-px w-full bg-it-ink/10' />
            </div>

            {/* Body - the scroll container */}
            <div className='min-h-0 flex-1 overflow-y-auto'>
                <OperatorConditionsBody html={html} />
            </div>
        </ModalShell>
    );
}
