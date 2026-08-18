'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';

import { crossFade } from '@/lib/motion';

/**
 * Small confirmation modal for actions worth a second look (QA follow-up
 * 2026-08-02: cancelling a booking must ask before the request fires). Plain
 * fixed overlay, no dialog library: closes on backdrop click and Escape,
 * focuses itself on open so the keyboard works immediately. The caller keeps
 * every side effect - this only renders the question.
 */
export function ConfirmDialog({
    open,
    title,
    body,
    confirmLabel,
    cancelLabel,
    busy = false,
    destructive = false,
    onConfirm,
    onClose,
}: {
    open: boolean;
    title: string;
    body?: string;
    confirmLabel: string;
    cancelLabel: string;
    /** Disables both buttons while the confirmed action is in flight. */
    busy?: boolean;
    /** Red-outline confirm for actions that give something up. */
    destructive?: boolean;
    onConfirm: () => void;
    onClose: () => void;
}) {
    // The page behind must not scroll while the question is up.
    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    role='alertdialog'
                    aria-modal='true'
                    aria-label={title}
                    tabIndex={-1}
                    ref={el => el?.focus()}
                    onClick={() => !busy && onClose()}
                    onKeyDown={e => {
                        if (e.key === 'Escape' && !busy) onClose();
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={crossFade}
                    className='fixed inset-0 z-100 flex items-center justify-center bg-black/50 p-4'>
                    <motion.div
                        onClick={e => e.stopPropagation()}
                        initial={{ opacity: 0, scale: 0.96, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 8 }}
                        transition={crossFade}
                        className='w-full max-w-100 rounded-[16px] bg-it-white p-6 shadow-[0_26px_70px_-20px_rgba(0,0,0,0.35)]'>
                        <p className='m-0 text-[17px] font-medium leading-[1.4] tracking-[-0.012em] text-it-heading'>
                            {title}
                        </p>
                        {body && (
                            <p className='mt-2.5 mb-0 text-[14px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                {body}
                            </p>
                        )}
                        <div className='mt-5 flex flex-wrap items-center gap-2.5'>
                            <motion.button
                                type='button'
                                disabled={busy}
                                whileTap={{ scale: 0.97 }}
                                onClick={onConfirm}
                                className={`cursor-pointer rounded-full px-4.5 py-2.25 text-[14px] font-medium transition-colors disabled:cursor-default disabled:opacity-60 ${
                                    destructive
                                        ? 'border-[1.5px] border-it-error bg-transparent text-it-error hover:bg-it-error-subtle tracking-[-0.012em]'
                                        : 'border-none bg-it-heading text-it-white hover:opacity-90 tracking-[-0.012em]'
                                }`}>
                                {confirmLabel}
                            </motion.button>
                            <motion.button
                                type='button'
                                disabled={busy}
                                whileTap={{ scale: 0.97 }}
                                onClick={onClose}
                                className='cursor-pointer rounded-full border-none bg-transparent px-4.5 py-2.25 text-[14px] font-medium text-it-text-muted transition-colors hover:text-it-heading disabled:cursor-default disabled:opacity-60 tracking-[-0.012em]'>
                                {cancelLabel}
                            </motion.button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

