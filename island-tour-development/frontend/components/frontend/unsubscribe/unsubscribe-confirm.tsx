'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

import { MotionLink } from '@/components/frontend/motion-link';
import { confirmUnsubscribe } from '@/lib/api/unsubscribe-submit';
import type { UnsubscribeStream } from '@/lib/api/public/unsubscribe';
import { springPop } from '@/lib/motion';

/**
 * The strings this component needs - a typed slice of `dict.unsubscribe`
 * (the `SavedEmailDict` pattern), so the server passes words, not the whole
 * dictionary, across the client boundary.
 */
export type UnsubscribeConfirmDict = {
    /** Shared invalid state - unknown and malformed tokens alike (no oracle). */
    invalidTitle: string;
    invalidBody: string;
    invalidBrowse: string;
    /** "Unsubscribe from setup emails?" */
    titleLifecycle: string;
    /** "Unsubscribe from travel ideas and offers?" */
    titleMarketing: string;
    /** What the LIFECYCLE stream is: the operator setup/onboarding emails. */
    bodyLifecycle: string;
    /** What the MARKETING stream is: the traveller ideas-and-offers emails. */
    bodyMarketing: string;
    /** "This applies to {email}." - {email} is replaced with the masked address. */
    emailLine: string;
    confirm: string;
    working: string;
    alreadyTitle: string;
    alreadyBody: string;
    successTitle: string;
    /** "You won't get these emails anymore." */
    successBody: string;
    /** The promise that transactional mail is untouched - booking emails always arrive. */
    transactionalNote: string;
    error: string;
    retry: string;
    browse: string;
};

/** What the server resolved the token to - `null` when the link is dead. */
export type UnsubscribeInfoProps = {
    /** Masked by the backend (`j***@host`) - never the full address. */
    email: string;
    stream: UnsubscribeStream;
    optedOut: boolean;
};

type Status = 'idle' | 'working' | 'done' | 'error';

/**
 * The unsubscribe card: one button, one POST.
 *
 * The recipient clicked a footer link on a phone - the page must need
 * exactly one decision. A GET must never opt anyone out (link scanners
 * prefetch), so the server resolve only ever renders this explicit confirm,
 * and only the button's POST writes. `info.optedOut` (from the resolve) and
 * the post-POST success state share the "done" rendering deliberately: the
 * backend is idempotent and the truthful answer in both cases is "these
 * emails stop; your booking emails don't".
 *
 * The invalid state lives HERE rather than in the page so every rendering
 * of the card sits behind one hydration marker: the page streams this
 * content through a Suspense boundary, and React's streaming SSR parks a
 * second, hidden copy in the DOM as its holding pen - `data-hydrated` marks
 * the live one for the e2e suite (the `#tour-reviews` precedent).
 */
export function UnsubscribeConfirm({
    token,
    info,
    browseHref,
    dict,
}: {
    token: string;
    info: UnsubscribeInfoProps | null;
    browseHref: string;
    dict: UnsubscribeConfirmDict;
}) {
    const [status, setStatus] = useState<Status>('idle');
    const [hydrated, setHydrated] = useState(false);

    // The holding-pen copy never hydrates, so this attribute marks the live
    // card unambiguously - and waiting on it also waits for interactivity,
    // which the confirm-click test needs regardless.
    useEffect(() => {
        setHydrated(true);
    }, []);

    async function handleConfirm() {
        if (status === 'working') return;
        setStatus('working');
        try {
            await confirmUnsubscribe(token);
            setStatus('done');
        } catch {
            setStatus('error');
        }
    }

    const browseLabel = info ? dict.browse : dict.invalidBrowse;
    const browseLink = (
        <MotionLink
            href={browseHref}
            whileTap={{ scale: 0.98 }}
            transition={springPop}
            className='mt-8 inline-flex items-center justify-center rounded-it-full border border-it-border bg-it-white px-8 py-[13px] font-medium text-[15px] leading-[1.6] tracking-[-0.012em] text-it-heading no-underline transition-colors hover:border-it-heading'>
            {browseLabel}
        </MotionLink>
    );

    let body: React.ReactNode;

    if (!info) {
        // Unknown and malformed tokens land here together: the backend does
        // not distinguish them (400 and 404 are the same empty hands), and
        // neither does the page - one shared state, no oracle.
        body = (
            <>
                <h1 className='mx-auto mb-0 max-w-md text-[24px] leading-[1.25] tracking-[-0.012em] text-it-heading sm:text-[28px] font-medium'>
                    {dict.invalidTitle}
                </h1>
                <p className='mx-auto mt-3 mb-0 max-w-md text-[15px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                    {dict.invalidBody}
                </p>
                {/* A dead end is where people leave - give them somewhere to
                    go (the review page's rule). */}
                {browseLink}
            </>
        );
    } else if (info.optedOut || status === 'done') {
        // Resolved-as-already-done and just-confirmed share one rendering -
        // see the component doc. Only the words differ, so a returning
        // visitor is not told "you're unsubscribed" as if their earlier
        // click didn't count.
        body = (
            <>
                <h1 className='mx-auto mb-0 max-w-md text-[24px] leading-[1.25] tracking-[-0.012em] text-it-heading sm:text-[28px] font-medium'>
                    {info.optedOut ? dict.alreadyTitle : dict.successTitle}
                </h1>
                <p className='mx-auto mt-3 mb-0 max-w-md text-[15px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                    {info.optedOut ? dict.alreadyBody : dict.successBody}
                </p>
                {/* The line that keeps this page from scaring people off
                    their own bookings: opting out never touches booking
                    email. */}
                <p className='mx-auto mt-3 mb-0 max-w-md text-[15px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                    {dict.transactionalNote}
                </p>
                {browseLink}
            </>
        );
    } else {
        body = (
            <>
                <h1 className='mx-auto mb-0 max-w-md text-[24px] leading-[1.25] tracking-[-0.012em] text-it-heading sm:text-[28px] font-medium'>
                    {info.stream === 'LIFECYCLE'
                        ? dict.titleLifecycle
                        : dict.titleMarketing}
                </h1>
                <p className='mx-auto mt-3 mb-0 max-w-md text-[15px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                    {info.stream === 'LIFECYCLE'
                        ? dict.bodyLifecycle
                        : dict.bodyMarketing}
                </p>
                <p className='mx-auto mt-4 mb-0 max-w-md text-[15px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                    {dict.emailLine.replace('{email}', info.email)}
                </p>

                <motion.button
                    type='button'
                    onClick={handleConfirm}
                    disabled={status === 'working'}
                    whileTap={{ scale: 0.98 }}
                    transition={springPop}
                    className='mx-auto mt-8 inline-flex cursor-pointer items-center justify-center gap-2 rounded-it-full border-none bg-it-primary px-8 py-[13px] font-medium text-[15px] leading-[1.6] tracking-[-0.012em] text-it-white transition-colors hover:bg-it-primary-hover disabled:cursor-default disabled:opacity-70'>
                    {status === 'working' && (
                        // Same spinner the checkout submit uses - a ring on
                        // the button's own ink, so the two read as one system.
                        <span
                            className='size-4 shrink-0 animate-spin rounded-full border-2 border-it-white/30 border-t-it-white'
                            aria-hidden='true'
                        />
                    )}
                    {status === 'working' ? dict.working : dict.confirm}
                </motion.button>

                {/* Visible error line; the announcement itself comes from the
                    card's persistent live region below, and the button above
                    stays so "try again" is the same tap that failed. */}
                {status === 'error' && (
                    <p className='mx-auto mt-3 mb-0 max-w-md text-[13px] font-medium leading-[1.5] text-it-error tracking-[-0.012em]'>
                        {dict.error} {dict.retry}
                    </p>
                )}
            </>
        );
    }

    // One PERSISTENTLY-MOUNTED live region for every outcome: a region that
    // appears together with its content is typically not announced (the
    // saved-email-box precedent keeps the region mounted and swaps text).
    // It is visually hidden - the visible branches above carry the same
    // words for sighted users.
    const liveText =
        status === 'error'
            ? `${dict.error} ${dict.retry}`
            : status === 'working'
              ? dict.working
              : status === 'done' && info
                ? info.optedOut
                    ? dict.alreadyBody
                    : dict.successBody
                : '';

    return (
        <div
            id='unsubscribe-card'
            data-hydrated={hydrated || undefined}
            className='w-full max-w-xl rounded-[16px] bg-it-white p-8 text-center shadow-[0_26px_70px_-20px_rgba(0,0,0,0.25)] sm:p-12'>
            {body}
            <p aria-live='polite' className='sr-only'>
                {liveText}
            </p>
        </div>
    );
}
