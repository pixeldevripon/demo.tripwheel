'use client';

/**
 * A save failure, shown IN PLACE rather than as a toast.
 *
 * A toast is the wrong instrument for this class of error. These are not
 * outages, they are the server telling you what is wrong with what you just
 * typed - "this hub only accepts tours in these categories", "<base> is not
 * allowed", "not valid JavaScript: Unexpected token ':'". They describe work
 * the user still has to do, and a notification that fades after four seconds in
 * the opposite corner of the screen is the worst possible place to put something
 * you need to read twice and then act on.
 *
 * So failures land here: persistent until fixed or dismissed, next to the form
 * that produced them.
 *
 * The colour discipline matches the toast restyle - a danger rail and a danger
 * icon, but body copy in normal foreground. A wall of red text reads as a crash;
 * this is a form telling you something.
 *
 * Extracted from the trip wizard's step error so the two cannot drift. The
 * wizard keeps its own wrapper for the `useWizard()` wiring; everything visual
 * lives here.
 */

import { Alert02Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { crossFade } from '@/lib/motion';

export function SaveError({
    /** The failure text. Null/empty renders nothing (and animates out). */
    message,
    /** Headline above it, e.g. "This step could not be saved". */
    title,
    onDismiss,
}: {
    message: string | null;
    title: string;
    onDismiss: () => void;
}) {
    const reduceMotion = useReducedMotion();

    return (
        <AnimatePresence initial={false}>
            {message && (
                <motion.div
                    initial={
                        reduceMotion
                            ? { opacity: 0 }
                            : { opacity: 0, height: 0, marginBottom: 0 }
                    }
                    animate={{
                        opacity: 1,
                        height: 'auto',
                        marginBottom: 20,
                    }}
                    exit={
                        reduceMotion
                            ? { opacity: 0 }
                            : { opacity: 0, height: 0, marginBottom: 0 }
                    }
                    transition={reduceMotion ? { duration: 0 } : crossFade}
                    className='overflow-hidden'>
                    <div
                        role='alert'
                        aria-live='polite'
                        className='relative flex items-start gap-3 overflow-hidden rounded-lg border border-danger-border bg-danger-subtle/40 py-3 pr-3 pl-4'>
                        {/* The signal rail, same language as the toast. */}
                        <span
                            aria-hidden
                            className='absolute inset-y-0 left-0 w-1 bg-danger-solid'
                        />
                        <HugeiconsIcon
                            icon={Alert02Icon}
                            className='mt-0.5 size-4 shrink-0 text-danger-solid'
                        />
                        <div className='min-w-0 flex-1'>
                            <p className='text-sm font-medium text-content'>
                                {title}
                            </p>
                            <p className='mt-0.5 text-sm text-content-muted'>
                                {message}
                            </p>
                        </div>
                        <button
                            type='button'
                            onClick={onDismiss}
                            aria-label='Dismiss'
                            className='shrink-0 rounded-md p-1 text-content-subtle transition-colors duration-fast hover:bg-danger-subtle hover:text-content'>
                            <HugeiconsIcon
                                icon={Cancel01Icon}
                                className='size-3.5'
                            />
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
