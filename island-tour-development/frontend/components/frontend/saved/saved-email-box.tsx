'use client';

import { motion } from 'framer-motion';
import { Mail } from 'lucide-react';
import { useRef, useState } from 'react';

import { wishlistApi } from '@/lib/api/wishlist';
import { currencyFromCookie } from '@/lib/currency/current';
import { isEmailShaped } from '@/lib/email-shape';
import { cn } from '@/lib/utils';
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
    /** Shown under the field when it is empty on submit. */
    emailRequired: string;
    /** Shown under the field when what is typed is not an address. */
    emailInvalid: string;
};

type Status = 'idle' | 'sending' | 'sent' | 'error';

const ERROR_ID = 'saved-email-error';

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
    const [fieldError, setFieldError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        if (status === 'sending' || ids.length === 0) return;

        // We validate rather than letting the browser do it. The native bubble
        // is a floating tooltip in the OS chrome: it is unstyled, it vanishes
        // on the next click, and it is positioned over whatever happens to sit
        // below the field. An error about a field belongs under that field,
        // where it stays put and a screen reader can find it.
        const value = email.trim();
        if (!value) {
            setFieldError(dict.emailRequired);
            inputRef.current?.focus();
            return;
        }
        if (!isEmailShaped(value)) {
            setFieldError(dict.emailInvalid);
            inputRef.current?.focus();
            return;
        }
        setFieldError(null);

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

            {/* `noValidate` turns off the browser's own bubble; the checks it
                would have run are in `handleSubmit`. `type='email'` stays for
                the keyboard it gives a phone. */}
            <form onSubmit={handleSubmit} noValidate className='mt-3 flex gap-2'>
                <input
                    ref={inputRef}
                    type='email'
                    autoComplete='email'
                    value={email}
                    onChange={e => {
                        setEmail(e.target.value);
                        if (status !== 'idle') setStatus('idle');
                        // Clear on the first keystroke of a fix. Re-validating
                        // as they type would flash the error back on every
                        // character of a half-typed address.
                        if (fieldError) setFieldError(null);
                    }}
                    placeholder={dict.placeholder}
                    aria-label={dict.placeholder}
                    aria-invalid={fieldError ? true : undefined}
                    aria-describedby={fieldError ? ERROR_ID : undefined}
                    className={cn(
                        'min-w-0 flex-1 rounded-it-sm border bg-it-white px-[13px] py-[11px] font-it-body text-[13.5px] leading-[1.6] text-it-ink outline-none',
                        fieldError
                            ? 'border-it-error focus-visible:border-it-error'
                            : 'border-it-border focus-visible:border-it-primary'
                    )}
                />
                <motion.button
                    type='submit'
                    disabled={status === 'sending'}
                    whileTap={{ scale: 0.97 }}
                    transition={springPop}
                    className='inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-it-sm border-none bg-it-primary px-4 py-[11px] text-[13.5px] font-bold leading-[1.6] text-it-white transition-colors duration-(--it-duration-xs) ease-(--it-ease) hover:bg-it-primary-hover disabled:cursor-default disabled:opacity-70'>
                    {status === 'sending' ? (
                        // Same spinner the checkout submit uses - a ring on the
                        // button's own ink, so the two reads as one system.
                        <span
                            className='size-4 shrink-0 animate-spin rounded-full border-2 border-it-white/30 border-t-it-white'
                            aria-hidden='true'
                        />
                    ) : (
                        // lucide, not a Figma export: there is no envelope in
                        // the icon set, and this is a generic affordance rather
                        // than a piece of the brand's iconography.
                        <Mail
                            className='size-4 shrink-0'
                            strokeWidth={1.8}
                            aria-hidden='true'
                        />
                    )}
                    {dict.cta}
                </motion.button>
            </form>

            {/* The field's own error sits directly under it, ahead of the help
                line, because it is about the thing immediately above it. */}
            {fieldError && (
                <p
                    id={ERROR_ID}
                    className='m-0 mt-2 text-[12px] font-semibold leading-[1.5] text-it-error'>
                    {fieldError}
                </p>
            )}

            {/* One live region for the send outcome, so a screen reader hears
                it without the form re-announcing itself. */}
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
