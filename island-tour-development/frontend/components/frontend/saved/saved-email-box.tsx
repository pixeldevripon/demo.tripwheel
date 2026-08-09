'use client';

import { motion } from 'framer-motion';
import { Mail } from 'lucide-react';
import { useState } from 'react';

import { wishlistApi } from '@/lib/api/wishlist';
import { currencyFromCookie } from '@/lib/currency/current';
import type { Locale } from '@/lib/constants/locales';
import { springPop } from '@/lib/motion';

export type SavedEmailDict = {
    /** "Take your list with you" */
    title: string;
    placeholder: string;
    /** "Email me this list" */
    cta: string;
    /** "One email with a link to this list. Nothing else unless you opt in." */
    help: string;
    sent: string;
    error: string;
};

type Status = 'idle' | 'sending' | 'sent' | 'error';

/**
 * "Email me this list" (mck-17, [H]).
 *
 * The only pre-booking email capture on the platform, and the thing that makes
 * a device-local list work on a second device - which is exactly what the
 * device line above it promises. The address is used for this one send and is
 * stored nowhere: there is no subscriber list on the platform for it to join,
 * so the mockup's optional marketing checkbox is deliberately absent rather
 * than collecting a consent with nowhere to live.
 */
export function SavedEmailBox({
    ids,
    locale,
    dict,
}: {
    ids: string[];
    locale: Locale;
    dict: SavedEmailDict;
}) {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<Status>('idle');

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        if (status === 'sending' || ids.length === 0) return;
        setStatus('sending');
        try {
            // The shopper's display currency rides along, so the prices on the
            // cards in the inbox are the prices they were just looking at.
            await wishlistApi.emailList(
                email,
                ids,
                locale,
                currencyFromCookie(document.cookie, locale)
            );
            setStatus('sent');
            setEmail('');
        } catch {
            // The backend's own message is either a validation detail or a
            // rate-limit code; neither helps here, so the copy stays one line.
            setStatus('error');
        }
    }

    return (
        <div className='rounded-it-lg bg-it-bg px-[22px] py-5'>
            <b className='block font-it-display text-[17px] font-bold leading-[1.3] text-it-heading'>
                {dict.title}
            </b>

            <form onSubmit={handleSubmit} className='mt-3 flex gap-2'>
                <input
                    type='email'
                    required
                    value={email}
                    onChange={e => {
                        setEmail(e.target.value);
                        if (status !== 'idle') setStatus('idle');
                    }}
                    placeholder={dict.placeholder}
                    aria-label={dict.placeholder}
                    className='min-w-0 flex-1 rounded-it-sm border border-it-border bg-it-white px-[13px] py-[11px] font-it-body text-[13.5px] leading-[1.6] text-it-ink outline-none focus-visible:border-it-primary'
                />
                <motion.button
                    type='submit'
                    disabled={status === 'sending'}
                    whileTap={{ scale: 0.97 }}
                    transition={springPop}
                    className='inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-it-sm border-none bg-it-primary px-4 py-[11px] text-[13.5px] font-bold leading-[1.6] text-it-white transition-colors duration-(--it-duration-xs) ease-(--it-ease) hover:bg-it-primary-hover disabled:opacity-60'>
                    {/* lucide, not a Figma export: there is no envelope in the
                        icon set, and this is a generic affordance rather than
                        a piece of the brand's iconography. */}
                    <Mail
                        className='size-4 shrink-0'
                        strokeWidth={1.8}
                        aria-hidden='true'
                    />
                    {dict.cta}
                </motion.button>
            </form>

            {/* One live region for all three states, so a screen reader hears
                the outcome without the form re-announcing itself. */}
            <p
                aria-live='polite'
                className='m-0 mt-[9px] text-[12px] leading-[1.5] text-it-text-muted'>
                {status === 'sent'
                    ? dict.sent
                    : status === 'error'
                      ? dict.error
                      : dict.help}
            </p>
        </div>
    );
}
