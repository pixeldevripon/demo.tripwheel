'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import {
    requestTravellerCodeClient,
    verifyTravellerCodeClient,
} from '@/lib/api/traveller-login';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { crossFade } from '@/lib/motion';
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
 * Deliberately a TYPO-CATCHER, not an RFC validator: "something@something.tld,
 * no spaces, exactly one @". The AUTHORITY on validity is the backend's
 * `@IsEmail()` (validator.js) - anything this shape wrongly lets through gets
 * a 400 there, which the card surfaces as the same invalid-email message.
 * The one hard requirement on this regex: it must never be STRICTER than
 * `@IsEmail()`, or a real traveller (whose booking email passed `@IsEmail()`
 * at checkout) could be locked out of login client-side. IsEmail demands a
 * dotted domain, an alpha TLD of >=2 and no bare spaces, so every storable
 * address passes this shape.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Per-tab memory of addresses the backend called unknown (`|a|b|` format). */
const UNKNOWN_EMAILS_KEY = 'it.travellerUnknownEmails';

const EMAIL_ERROR_ID = 'traveller-email-error';

/**
 * Addresses this TAB has seen the backend call unknown, kept in
 * sessionStorage so the verdict survives a reload (founder: resubmitting an
 * address with no bookings must ALWAYS say "no account", never mutate into a
 * throttle banner). Only consulted when a request cannot reach the handler
 * (generic per-IP 429); a live `sent`/`otp-pending` verdict clears it.
 *
 * MODULE SCOPE: it captures nothing - every method goes straight to
 * sessionStorage - so rebuilding this object literal on every render was pure
 * garbage with no upside.
 */
const unknownEmails = {
    has(v: string) {
        try {
            return (
                sessionStorage.getItem(UNKNOWN_EMAILS_KEY) ?? ''
            ).includes(`|${v}|`);
        } catch {
            return false;
        }
    },
    add(v: string) {
        try {
            const cur = sessionStorage.getItem(UNKNOWN_EMAILS_KEY) ?? '';
            if (!cur.includes(`|${v}|`)) {
                sessionStorage.setItem(UNKNOWN_EMAILS_KEY, `${cur}|${v}|`);
            }
        } catch {
            // Storage unavailable (private mode) - degrade to per-render.
        }
    },
    drop(v: string) {
        try {
            const cur = sessionStorage.getItem(UNKNOWN_EMAILS_KEY) ?? '';
            sessionStorage.setItem(
                UNKNOWN_EMAILS_KEY,
                cur.replace(`|${v}|`, '')
            );
        } catch {
            // Nothing stored, nothing to drop.
        }
    },
};

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
    whatsappHref = null,
}: {
    dict: Dictionary['traveller'];
    /** Dashboard-managed WhatsApp deep link; null hides the support link. */
    whatsappHref?: string | null;
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
        const normalized = value.toLowerCase();
        // The backend's @IsEmail() rejected the address (our shape check is
        // deliberately looser) - same message as the local check, same step.
        if (result === 'invalid') {
            setEmailError(dict.emailInvalid);
            emailRef.current?.focus();
            return;
        }
        // No bookings under this address -> no code was sent. Stay on the
        // email step with a validation message (founder 2026-07-30) instead
        // of advancing to a code screen that can never succeed.
        if (result === 'unknown') {
            unknownEmails.add(normalized);
            setEmailError(dict.emailUnknown);
            emailRef.current?.focus();
            return;
        }
        // The GENERIC per-IP 429 proves nothing about the address (unknown
        // emails hit it too) - never advance on it. If this tab already saw
        // the backend call THIS address unknown, repeat that verdict (founder
        // 2026-07-31: an address with no bookings must always read "no
        // account", never mutate into a throttle banner); otherwise stay on
        // the email step with the wait message. Only `otp-pending` below may
        // advance: the backend throws it AFTER the existence check, so a code
        // is genuinely in that inbox.
        if (result === 'throttled') {
            if (unknownEmails.has(normalized)) {
                setEmailError(dict.emailUnknown);
                emailRef.current?.focus();
            } else {
                setError(dict.throttledError);
            }
            return;
        }
        unknownEmails.drop(normalized);
        if (result === 'otp-pending') {
            setError(dict.throttledError);
            // Advance: a still-valid code is sitting in the inbox.
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
        const result = await verifyTravellerCodeClient(email.trim(), value);
        if (result.status !== 'ok') {
            setBusy(false);
            setCode('');
            // A lockout is not a verdict on the code they typed. Saying "that
            // code is wrong" would send them straight back to guess again,
            // when nothing they enter can work until the window passes.
            setError(
                result.status === 'locked'
                    ? dict.codeLockedError
                    : dict.codeError
            );
            return;
        }
        // Park the token in the first-party HttpOnly cookie BEFORE refreshing,
        // so the very next server render is already signed in.
        await storeTravelerSession(result.token);
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
                            <h1 className='mb-2 font-normal text-[26px] leading-[1.25] tracking-[-0.012em] text-it-heading'>
                                {dict.loginTitle}
                            </h1>
                            <p className='mb-7 text-[15px] leading-[1.6] text-it-text-muted'>
                                {dict.loginSubtitle}
                            </p>
                            {error && <ErrorNote>{error}</ErrorNote>}
                            <Field
                                label={dict.emailLabel}
                                htmlFor='traveller-email'>
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
                            <h1 className='mb-2 font-normal text-[26px] leading-[1.25] tracking-[-0.012em] text-it-heading'>
                                {dict.codeTitle}
                            </h1>
                            <p className='mb-7 text-[15px] leading-[1.6] text-it-text-muted'>
                                {dict.codeSentNote.replace(
                                    '{email}',
                                    email.trim()
                                )}
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
                                        if (value.length === 6)
                                            void submitCode(value);
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

            {/* The passwordless "forgot" story: there is no password to reset -
                the recoverable thing is WHICH email was used, and that is on
                the booking confirmation. Everything past that (lost inbox
                access) is deliberately support-only: a self-serve email change
                on a booking would be an account-takeover vector. */}
            <p className='mt-5 mb-0 text-center text-[13px] leading-[1.6] text-it-text-muted'>
                {dict.loginHelp}
                {whatsappHref && (
                    <>
                        {' '}
                        <a
                            href={whatsappHref}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='font-normal text-it-primary no-underline hover:opacity-80'>
                            {dict.whatsappUs}
                        </a>
                    </>
                )}
            </p>
        </div>
    );
}

