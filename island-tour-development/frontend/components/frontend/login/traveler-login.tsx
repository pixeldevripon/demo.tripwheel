'use client';

import { MountReveal } from '@/components/frontend/mount-reveal';
import {
    lookupBookingClient,
    recoverReferenceClient,
} from '@/lib/api/bookings-lookup';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { swapFade } from '@/lib/motion';
import {
    clearJustBooked,
    readTravelerBooking,
    saveTravelerBooking,
    storeTravelerSession,
    travelerBookingPath,
} from '@/lib/traveler-booking';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Mail } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LoginLocaleSwitch } from './login-locale-switch';
import {
    ErrorNote,
    Field,
    inputClass,
    primaryBtn,
    quietLink,
} from './login-ui';

/**
 * Traveler surface `/bookings` (spec 2). Email + booking-reference pair login -
 * no passwords, no sign-up. Takeover chrome (checkout family): logo, WhatsApp,
 * language switch, minimal footer. Two panels: the login card and the
 * lost-reference recovery card.
 *
 * A successful lookup (POST /bookings/lookup) saves the booking's TYP path in
 * the traveller cookie - the navbar account icon reuses it - and redirects to
 * the thank-you page with the booking details. There is no interstitial
 * success screen: the submit button itself narrates the flow (Checking ->
 * Redirecting, spinner + swapFade label). Failures show the enumeration-proof
 * generic error. The lost-reference panel posts to
 * /bookings/lookup/recover-reference and always shows the same "on its way"
 * note (the backend acks identically whether or not the email has bookings).
 */
export function TravelerLogin({
    logo,
    siteName,
    locale,
    dict,
    whatsappHref,
}: {
    /** Dashboard-managed logo URL; falls back to the bundled asset. */
    logo?: string | null;
    siteName?: string | null;
    /** Path locale - keys the card swap so locale changes animate smoothly. */
    locale: Locale;
    /** `travelerLogin` dictionary slice, locale-resolved by the page. */
    dict: Dictionary['travelerLogin'];
    /** wa.me deep link (buildWhatsappUrl); null hides the button entirely. */
    whatsappHref?: string | null;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [panel, setPanel] = useState<'login' | 'lost'>('login');
    const [email, setEmail] = useState('');
    const [reference, setReference] = useState('');
    const [phase, setPhase] = useState<'idle' | 'checking' | 'redirecting'>(
        'idle'
    );
    const [failed, setFailed] = useState(false);
    const [lostEmail, setLostEmail] = useState('');
    const [recovering, setRecovering] = useState(false);
    const [recoverySent, setRecoverySent] = useState(false);
    const [recoveryUnknown, setRecoveryUnknown] = useState(false);

    // A previous successful lookup left its search record in the cookie -
    // prefill the form with it (the "My bookings" dropdown item lands here).
    useEffect(() => {
        const saved = readTravelerBooking();
        if (saved) {
            setEmail(prev => prev || saved.email);
            setReference(prev => prev || saved.ref);
        }
    }, []);

    // Coming BACK after the redirect must not show a frozen "Redirecting"
    // button. Two restore paths, two signals:
    // - soft (in-app) back: the router revives the cached page tree with its
    //   React state intact and no remount - but `pathname` flips back to
    //   /bookings, so this effect fires and resets the phase. During the
    //   redirect itself the pathname is the TYP path, so the button keeps
    //   its "Redirecting" state until the page actually swaps.
    // - hard back (bfcache snapshot): no React signal at all, but the
    //   browser fires `pageshow`.
    useEffect(() => {
        function reset() {
            setPhase('idle');
            setRecovering(false);
        }
        if (pathname.endsWith('/bookings')) reset();
        window.addEventListener('pageshow', reset);
        return () => window.removeEventListener('pageshow', reset);
    }, [pathname]);

    async function handleRecover(e: React.FormEvent) {
        e.preventDefault();
        if (recovering) return;
        setRecovering(true);
        setRecoveryUnknown(false);
        const result = await recoverReferenceClient(lostEmail);
        setRecovering(false);
        // No bookings under this address -> no email was sent; say so instead
        // of promising a reference that can never arrive (founder 2026-07-31).
        if (result === 'unknown') {
            setRecoverySent(false);
            setRecoveryUnknown(true);
            return;
        }
        setRecoverySent(true);
    }

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        if (phase !== 'idle') return;
        setPhase('checking');
        setFailed(false);

        const result = await lookupBookingClient(email, reference);
        if (!result) {
            setFailed(true);
            setPhase('idle');
            return;
        }

        saveTravelerBooking({
            destinationSlug: result.destinationSlug,
            publicRef: result.publicRef,
            email,
            displayRef: result.displayRef,
        });
        // Reaching the TYP through the login door is a deliberate "manage my
        // booking" visit - retire the one-time celebratory signal so the page
        // renders the management view, not the "you're booked!" hero left over
        // from a checkout in the last 15 min.
        clearJustBooked();
        // Move the session token into the HttpOnly cookie BEFORE navigating,
        // so the TYP's first server render is already verified (unmasked).
        if (result.sessionToken) {
            await storeTravelerSession(result.sessionToken);
        }
        // Stay on 'redirecting' until the TYP page takes over - the router
        // keeps this screen mounted while the destination loads.
        setPhase('redirecting');
        // A guarded surface (the /cancel page) may have sent us here to
        // verify; send the traveller straight back. Same-app paths only -
        // the strict shape check makes an open redirect impossible. Read at
        // submit time (not useSearchParams) so the page stays prerenderable.
        const returnTo = new URLSearchParams(window.location.search).get(
            'returnTo'
        );
        const safeReturn =
            returnTo &&
            /^\/(?:[a-z0-9-]+\/thank-you|cancel)\/[A-Za-z0-9-]+$/.test(returnTo)
                ? returnTo
                : null;
        router.push(
            safeReturn ??
                travelerBookingPath(result.destinationSlug, result.publicRef)
        );
    }

    return (
        <div className='flex min-h-screen flex-col bg-it-bg'>
            {/* ── Takeover top bar ─────────────────────────────────────────── */}
            <header className='flex items-center justify-between px-7 py-5'>
                <Link
                    href={localizeHref(locale, '/')}
                    aria-label='Island Tours home'
                    className='shrink-0'>
                    <Image
                        src={logo || '/logo/logo.png'}
                        alt={siteName || 'Island Tours'}
                        width={68}
                        height={50}
                        priority
                        className='h-11 w-auto object-contain'
                    />
                </Link>
                <div className='flex items-center gap-2'>
                    <LoginLocaleSwitch />
                    {whatsappHref && (
                        <a
                            href={whatsappHref}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='flex items-center gap-2 rounded-full bg-it-green px-3.5 py-2 text-[13px] font-medium text-it-white transition-colors hover:bg-it-green/90 tracking-[-0.012em]'>
                            <Image
                                src='/icons/whatsapp.svg'
                                alt=''
                                width={24}
                                height={24}
                                className='size-4.5 shrink-0'
                            />
                            {dict.whatsapp}
                        </a>
                    )}
                </div>
            </header>

            {/* ── Centered card ────────────────────────────────────────────── */}
            <main className='flex flex-1 justify-center px-5 pb-10 pt-[5vh]'>
                <div className='h-fit w-full max-w-110 rounded-[16px] border border-it-border bg-it-white px-7.5 pb-7 pt-8 shadow-it-md'>
                    <MountReveal key={`${locale}:${panel}`}>
                        {panel === 'login' ? (
                            <>
                                <h1 className='m-0 font-it-display text-[22.5px] font-medium tracking-[-0.01em] text-it-heading'>
                                    {dict.title}
                                </h1>
                                <p className='mb-6 mt-2 text-[13.5px] text-it-text-muted tracking-[-0.012em]'>
                                    {dict.subtitle}
                                </p>

                                {failed && (
                                    <ErrorNote>
                                        {dict.errorBefore}{' '}
                                        {whatsappHref ? (
                                            <a
                                                href={whatsappHref}
                                                target='_blank'
                                                rel='noopener noreferrer'
                                                className='underline'>
                                                {dict.errorLink}
                                            </a>
                                        ) : (
                                            dict.errorLink
                                        )}{' '}
                                        {dict.errorAfter}
                                    </ErrorNote>
                                )}

                                <form onSubmit={handleLogin}>
                                    <Field
                                        label={dict.emailLabel}
                                        htmlFor='t-email'>
                                        <input
                                            id='t-email'
                                            type='email'
                                            name='email'
                                            autoComplete='email'
                                            inputMode='email'
                                            placeholder='you@example.com'
                                            required
                                            value={email}
                                            onChange={e =>
                                                setEmail(e.target.value)
                                            }
                                            className={inputClass}
                                        />
                                    </Field>
                                    <Field
                                        label={dict.refLabel}
                                        htmlFor='t-ref'>
                                        <input
                                            id='t-ref'
                                            type='text'
                                            name='reference'
                                            autoComplete='off'
                                            autoCapitalize='characters'
                                            spellCheck={false}
                                            placeholder='IT-2026-K3M9P'
                                            required
                                            value={reference}
                                            onChange={e =>
                                                setReference(e.target.value)
                                            }
                                            className={inputClass}
                                        />
                                        <p className='mt-1.5 text-[11.5px] text-it-text-muted tracking-[-0.012em]'>
                                            {dict.refHint}
                                        </p>
                                    </Field>
                                    <button
                                        type='submit'
                                        disabled={phase !== 'idle'}
                                        className={`${primaryBtn} ${phase !== 'idle' ? 'opacity-80' : ''}`}>
                                        <AnimatePresence
                                            mode='wait'
                                            initial={false}>
                                            <motion.span
                                                key={phase}
                                                initial={{ opacity: 0, y: 6 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -6 }}
                                                transition={swapFade}
                                                className='inline-flex items-center justify-center gap-2'>
                                                {phase !== 'idle' && (
                                                    <span
                                                        aria-hidden
                                                        className='inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent'
                                                    />
                                                )}
                                                {phase === 'checking'
                                                    ? dict.checking
                                                    : phase === 'redirecting'
                                                      ? dict.redirecting
                                                      : dict.submit}
                                            </motion.span>
                                        </AnimatePresence>
                                    </button>
                                </form>

                                <div className='mt-4.5 flex justify-center'>
                                    <button
                                        type='button'
                                        onClick={() => setPanel('lost')}
                                        className={quietLink}>
                                        {dict.lostLink}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <button
                                    type='button'
                                    onClick={() => setPanel('login')}
                                    className='mb-3.5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-it-text-muted transition-colors hover:text-it-heading tracking-[-0.012em]'>
                                    <ArrowLeft
                                        className='size-3.5'
                                        strokeWidth={1.5}
                                    />
                                    {dict.back}
                                </button>
                                <h1 className='m-0 font-it-display text-[22.5px] font-medium tracking-[-0.01em] text-it-heading'>
                                    {dict.lostTitle}
                                </h1>
                                <p className='mb-6 mt-2 text-[13.5px] text-it-text-muted tracking-[-0.012em]'>
                                    {dict.lostSubtitle}
                                </p>
                                <form onSubmit={handleRecover}>
                                    <Field
                                        label={dict.emailLabel}
                                        htmlFor='t-lost-email'>
                                        <input
                                            id='t-lost-email'
                                            type='email'
                                            name='email'
                                            autoComplete='email'
                                            inputMode='email'
                                            placeholder='you@example.com'
                                            required
                                            value={lostEmail}
                                            onChange={e =>
                                                setLostEmail(e.target.value)
                                            }
                                            className={inputClass}
                                        />
                                    </Field>
                                    <button
                                        type='submit'
                                        disabled={recovering}
                                        className={`${primaryBtn} ${recovering ? 'opacity-60' : ''}`}>
                                        {recovering
                                            ? `${dict.sending}...`
                                            : dict.lostSubmit}
                                    </button>
                                </form>
                                {recoveryUnknown && (
                                    <p
                                        role='alert'
                                        className='mt-3 mb-0 text-[12px] leading-[1.6] text-it-error tracking-[-0.012em]'>
                                        {dict.lostUnknown}
                                    </p>
                                )}
                                {recoverySent && (
                                    <div className='mt-4 flex gap-2 rounded-[10px] bg-it-surface px-3.5 py-2.5 text-[12px] text-it-text-muted tracking-[-0.012em]'>
                                        <Mail
                                            className='mt-0.5 size-4 shrink-0'
                                            strokeWidth={1.5}
                                        />
                                        {dict.sentNote}
                                    </div>
                                )}
                            </>
                        )}
                    </MountReveal>
                </div>
            </main>

            {/* ── Minimal footer ───────────────────────────────────────────── */}
            <footer className='flex flex-col items-center gap-2 px-5 pb-8.5 pt-6.5 text-[11.5px] text-it-text-muted tracking-[-0.012em]'>
                <div className='font-it-display text-[14px] font-bold text-it-heading tracking-[-0.012em]'>
                    {dict.tagline}
                </div>
                <div className='flex gap-3.5'>
                    <Link
                        href={localizeHref(locale, '/terms')}
                        className='transition-colors hover:text-it-primary tracking-[-0.012em]'>
                        {dict.terms}
                    </Link>
                    <Link
                        href={localizeHref(locale, '/privacy-policy')}
                        className='transition-colors hover:text-it-primary tracking-[-0.012em]'>
                        {dict.privacy}
                    </Link>
                    {/* No help page yet, so Help routes to WhatsApp (founder
                        2026-07-30) - the same dashboard-managed number as the
                        header pill. Plain text when the chat is disabled. */}
                    {whatsappHref ? (
                        <a
                            href={whatsappHref}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='transition-colors hover:text-it-primary tracking-[-0.012em]'>
                            {dict.help}
                        </a>
                    ) : (
                        <span className='cursor-default'>{dict.help}</span>
                    )}
                </div>
            </footer>
        </div>
    );
}

