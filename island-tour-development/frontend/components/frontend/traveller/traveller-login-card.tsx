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

import {
    ErrorNote,
    Field,
    FieldError,
    inputClass,
    inputErrorClass,
    primaryBtn,
    quietLink,
} from '../login/login-ui';
import { TravellerOtpField } from './traveller-otp-field';

/** Matches the backend's per-target cap of one code per minute. */
const RESEND_COOLDOWN_S = 60;

/**
 * Deliberately shape-only: one `@`, something either side, and a dotted domain
 * with a 2+ character last label. Nothing stricter is worth doing here.
 *
 * The real check is whether a code arrives in that inbox, and the backend
 * intentionally does not say whether an address is known (that would turn this
 * form into an account-enumeration oracle). So this catches the honest typo -
 * a missing `@`, a trailing `.`, `gmail.con` is NOT catchable and must not be
 * guessed at - and nothing else pretends to.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const EMAIL_ERROR_ID = 'traveller-email-error';

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
    const [emailError, setEmailError] = useState<string | null>(null);
    const [cooldown, setCooldown] = useState(0);
    const codeRef = useRef<HTMLDivElement>(null);
    const emailRef = useRef<HTMLInputElement>(null);

    // Tick the resend cooldown down to zero.
    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setTimeout(() => setCooldown(s => s - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    async function sendCode(e?: React.FormEvent) {
        e?.preventDefault();
        if (busy) return;

        // Validate BEFORE the request. The form is `noValidate` so the browser's
        // own bubble never fires - it is unstyled and only ever in the browser's
        // language, which is wrong on a site that runs in 7. That means the check
        // has to happen here or not at all, and it used to be `!email.trim()`,
        // which let anything with a character in it ask for a code.
        //
        // Also guards the Resend button, which calls this with no event.
        const value = email.trim();
        if (!EMAIL_SHAPE.test(value)) {
            setEmailError(dict.emailInvalid);
            setError(null);
            emailRef.current?.focus();
            return;
        }

        setBusy(true);
        setError(null);
        setEmailError(null);
        const result = await requestTravellerCodeClient(value);
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
                                    ref={emailRef}
                                    id='traveller-email'
                                    type='email'
                                    name='email'
                                    autoComplete='email'
                                    required
                                    aria-invalid={emailError ? true : undefined}
                                    aria-describedby={
                                        emailError ? EMAIL_ERROR_ID : undefined
                                    }
                                    value={email}
                                    onChange={e => {
                                        setEmail(e.target.value);
                                        // Clear on the first keystroke of a fix.
                                        // Re-validating as they type would flash
                                        // the error back on every character of a
                                        // half-typed address.
                                        if (emailError) setEmailError(null);
                                    }}
                                    className={`${inputClass} ${emailError ? inputErrorClass : ''}`}
                                    placeholder={dict.emailPlaceholder}
                                />
                                {emailError && (
                                    <FieldError id={EMAIL_ERROR_ID}>
                                        {emailError}
                                    </FieldError>
                                )}
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
