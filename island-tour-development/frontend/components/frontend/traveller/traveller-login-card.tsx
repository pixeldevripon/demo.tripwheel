'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { Dictionary } from '@/lib/i18n/dictionaries';
import { crossFade } from '@/lib/motion';
import {
    requestTravellerCodeClient,
    verifyTravellerCodeClient,
} from '@/lib/api/traveller-login';
import {
    saveTravellerAccount,
    storeTravelerSession,
} from '@/lib/traveler-booking';

import { ErrorNote, Field, inputClass, primaryBtn, quietLink } from '../login/login-ui';
import { TravellerOtpField } from './traveller-otp-field';

/** Matches the backend's per-target cap of one code per minute. */
const RESEND_COOLDOWN_S = 60;

/**
 * The account-area door: email in, one-time code back, history session out.
 *
 * Deliberately a STRONGER credential than the `/bookings` pair login. That one
 * proves possession of a single confirmation email - which travellers forward
 * to companions all the time - and is right for viewing one booking. This page
 * shows a person's whole booking and payment history, so it asks them to prove
 * they hold the inbox right now.
 */
export function TravellerLoginCard({
    dict,
}: {
    dict: Dictionary['traveller'];
}) {
    const router = useRouter();
    const [step, setStep] = useState<'email' | 'code'>('email');
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cooldown, setCooldown] = useState(0);
    const codeRef = useRef<HTMLDivElement>(null);

    // Tick the resend cooldown down to zero.
    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setTimeout(() => setCooldown(s => s - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    async function sendCode(e?: React.FormEvent) {
        e?.preventDefault();
        if (busy || !email.trim()) return;
        setBusy(true);
        setError(null);
        const result = await requestTravellerCodeClient(email.trim());
        setBusy(false);
        if (result === 'throttled') {
            setError(dict.throttledError);
            // Still advance: an earlier code may well be sitting in the inbox.
        }
        setCooldown(RESEND_COOLDOWN_S);
        setStep('code');
        setCode('');
        setTimeout(() => codeRef.current?.querySelector('input')?.focus(), 50);
    }

    async function submitCode(value: string) {
        if (busy) return;
        setBusy(true);
        setError(null);
        const token = await verifyTravellerCodeClient(email.trim(), value);
        if (!token) {
            setBusy(false);
            setCode('');
            setError(dict.codeError);
            return;
        }
        // Park the token in the first-party HttpOnly cookie BEFORE refreshing,
        // so the very next server render is already signed in.
        await storeTravelerSession(token);
        // The navbar cannot read the HttpOnly cookie, so mirror the identity
        // into its display cookie - otherwise the account menu still shows the
        // signed-out state right after signing in.
        saveTravellerAccount(email.trim());
        router.refresh();
    }

    return (
        <div className='mx-auto w-full max-w-115 rounded-[20px] border border-it-heading/10 bg-it-white p-6 shadow-it-sm sm:p-8'>
            <AnimatePresence mode='wait' initial={false}>
                <motion.div
                    key={step}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={crossFade}>
                    {step === 'email' ? (
                        <form onSubmit={sendCode} noValidate>
                            <h1 className='mb-2 font-medium text-[26px] leading-[1.25] tracking-[-0.012em] text-it-heading'>
                                {dict.loginTitle}
                            </h1>
                            <p className='mb-7 text-[15px] leading-[1.6] text-it-text-muted'>
                                {dict.loginSubtitle}
                            </p>
                            {error && <ErrorNote>{error}</ErrorNote>}
                            <Field label={dict.emailLabel} htmlFor='traveller-email'>
                                <input
                                    id='traveller-email'
                                    type='email'
                                    name='email'
                                    autoComplete='email'
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className={inputClass}
                                    placeholder={dict.emailPlaceholder}
                                />
                            </Field>
                            <motion.button
                                type='submit'
                                disabled={busy}
                                whileTap={{ scale: 0.98 }}
                                className={`${primaryBtn} mt-2 disabled:opacity-60`}>
                                {busy ? dict.sending : dict.sendCode}
                            </motion.button>
                        </form>
                    ) : (
                        <div>
                            <h1 className='mb-2 font-medium text-[26px] leading-[1.25] tracking-[-0.012em] text-it-heading'>
                                {dict.codeTitle}
                            </h1>
                            <p className='mb-7 text-[15px] leading-[1.6] text-it-text-muted'>
                                {dict.codeSentNote.replace('{email}', email.trim())}
                            </p>
                            {error && <ErrorNote>{error}</ErrorNote>}
                            <div ref={codeRef} className='mb-4'>
                                <label
                                    htmlFor='traveller-code'
                                    className='mb-2.5 block text-[13px] font-semibold text-it-heading'>
                                    {dict.codeLabel}
                                </label>
                                <TravellerOtpField
                                    id='traveller-code'
                                    value={code}
                                    disabled={busy}
                                    autoFocus
                                    onChange={value => {
                                        setCode(value);
                                        if (value.length === 6) void submitCode(value);
                                    }}
                                />
                                <p className='mt-2.5 text-[13px] leading-[1.6] text-it-text-muted'>
                                    {dict.codeHint}
                                </p>
                            </div>
                            <motion.button
                                type='button'
                                disabled={busy || code.length !== 6}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => void submitCode(code)}
                                className={`${primaryBtn} disabled:opacity-60`}>
                                {busy ? dict.verifying : dict.verify}
                            </motion.button>
                            <div className='mt-5 flex items-center justify-between gap-3'>
                                <button
                                    type='button'
                                    onClick={() => {
                                        setStep('email');
                                        setError(null);
                                    }}
                                    className={quietLink}>
                                    {dict.changeEmail}
                                </button>
                                <button
                                    type='button'
                                    disabled={cooldown > 0 || busy}
                                    onClick={() => void sendCode()}
                                    className={`${quietLink} disabled:opacity-50`}>
                                    {cooldown > 0
                                        ? dict.resendWait.replace(
                                              '{seconds}',
                                              String(cooldown)
                                          )
                                        : dict.resend}
                                </button>
                            </div>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
