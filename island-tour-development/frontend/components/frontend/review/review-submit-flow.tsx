'use client';

import {
    enrichReview,
    sendPrivateFeedback,
    startReview,
} from '@/lib/api/review-submit';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { springPop } from '@/lib/motion';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { MotionButton } from '../motion-primitives';
import { ReviewPhotoUploader } from './review-photo-uploader';

type Dict = Dictionary['reviewSubmit'];

type GuestType = 'COUPLE' | 'FAMILY' | 'FRIENDS' | 'SOLO';

const GUEST_TYPES: { value: GuestType; labelKey: keyof Dict }[] = [
    { value: 'COUPLE', labelKey: 'guestCouple' },
    { value: 'FAMILY', labelKey: 'guestFamily' },
    { value: 'FRIENDS', labelKey: 'guestFriends' },
    { value: 'SOLO', labelKey: 'guestSolo' },
];

/** A low score opens the private recovery prompt IN ADDITION to step 4. */
const LOW_RATING = 3;

/**
 * The post-tour review flow (requirements §4.2).
 *
 * ## Progressive disclosure, and why step 1 commits on tap
 * The rating POSTs the moment a star is pressed. Everything after it is optional,
 * independently saved, and skippable - so a guest who taps one star and closes
 * the tab has still left a real, countable review. Completion rate is the whole
 * design: a form that only counts when submitted at the end would throw away most
 * of the reviews this flow exists to collect.
 *
 * ## Step 4 is NEUTRAL, and that is not a style choice
 * The Trustpilot invitation is shown to EVERY guest on the same basis, whatever
 * they scored. Routing only happy customers to a third-party platform is review
 * gating: it breaches Trustpilot's own guidelines and is the conduct the Italian
 * AGCM fined Trustpilot 4 million euro over (PS12962). On a low score the private
 * recovery prompt appears ALONGSIDE it, never instead of it, and the public
 * review is published in full either way.
 */
export function ReviewSubmitFlow({
    token,
    tourName,
    guestFirstName,
    heroImage,
    tourHref,
    trustpilotUrl,
    dict,
}: {
    token: string;
    tourName: string;
    guestFirstName: string | null;
    heroImage: string | null;
    tourHref: string | null;
    /** Absent until the Trustpilot profile exists - step 4 then hides itself. */
    trustpilotUrl: string | null;
    dict: Dict;
}) {
    const [rating, setRating] = useState<number | null>(null);
    const [hovered, setHovered] = useState<number | null>(null);
    const [comment, setComment] = useState('');
    const [photos, setPhotos] = useState<string[]>([]);
    const [guestType, setGuestType] = useState<GuestType | null>(null);
    const [feedback, setFeedback] = useState('');
    const [feedbackSent, setFeedbackSent] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    const committed = rating !== null;
    const isLow = committed && rating <= LOW_RATING;

    /**
     * Step 1. Commits on press - and stays correctable.
     *
     * Committing on press is what makes a one-tap review count, but it also
     * means a mistap would otherwise be permanent. So a second press re-rates:
     * the first call CREATES the review, every later one PATCHES it, which the
     * backend accepts for as long as the review is still pending moderation.
     */
    async function commitRating(value: number) {
        if (busy || value === rating) return;
        setBusy(true);
        setError(null);
        try {
            if (committed) {
                await enrichReview(token, { rating: value });
            } else {
                await startReview(token, value);
            }
            setRating(value);
        } catch {
            setError(dict.error);
        } finally {
            setBusy(false);
        }
    }

    /** Each optional step saves on its own, so an abandon keeps what came before. */
    async function save(patch: Parameters<typeof enrichReview>[1]) {
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            await enrichReview(token, patch);
        } catch {
            setError(dict.error);
        } finally {
            setBusy(false);
        }
    }

    async function sendFeedback() {
        if (busy || !feedback.trim()) return;
        setBusy(true);
        try {
            await sendPrivateFeedback(token, feedback.trim());
            setFeedbackSent(true);
        } catch {
            setError(dict.error);
        } finally {
            setBusy(false);
        }
    }

    if (done) {
        return (
            <Card>
                <h1 className='m-0 font-normal text-[24px] leading-[1.3] tracking-[-0.012em] text-it-heading'>
                    {dict.thanksTitle}
                </h1>
                <p className='mt-2.5 mb-0 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                    {dict.thanksBody}
                </p>
                {tourHref && (
                    <Link
                        href={tourHref}
                        className='mt-5 inline-block w-fit rounded-[10px] bg-it-primary px-4.5 py-2.75 font-normal text-[14px] leading-[1.2] text-it-white no-underline transition-colors duration-300 hover:bg-it-primary-hover'>
                        {dict.thanksCta}
                    </Link>
                )}
            </Card>
        );
    }

    return (
        <Card>
            {heroImage && (
                <div className='relative mb-6 h-48 w-full overflow-hidden rounded-[12px] bg-it-border sm:h-56'>
                    <Image
                        src={heroImage}
                        alt=''
                        fill
                        sizes='(max-width: 768px) 100vw, 768px'
                        className='object-cover'
                    />
                </div>
            )}

            {/* The ask is centred: this is one question, and a left-aligned
                heading over a wide card reads as the first field of a long form. */}
            <div className='text-center'>
                <h1 className='m-0 font-normal text-[26px] leading-[1.25] tracking-[-0.012em] text-it-heading sm:text-[30px]'>
                    {guestFirstName ? `${guestFirstName}, ` : ''}
                    {dict.step1Header}
                </h1>
                <p className='mt-2 mb-0 text-[15px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                    {tourName}
                </p>
            </div>

            {/* STEP 1 - required, one tap, commits immediately. Big and centred:
                it is the only thing on the page that must happen, and a 44px
                target is a comfortable thumb tap on a phone. */}
            <div className='mt-6 flex items-center justify-center gap-2 sm:gap-3'>
                {[1, 2, 3, 4, 5].map(star => {
                    const filled = (hovered ?? rating ?? 0) >= star;
                    return (
                        <MotionButton
                            key={star}
                            type='button'
                            aria-label={`${star}`}
                            disabled={busy}
                            onMouseEnter={() => setHovered(star)}
                            onMouseLeave={() => setHovered(null)}
                            onClick={() => void commitRating(star)}
                            whileTap={{ scale: 0.9 }}
                            transition={springPop}
                            className='cursor-pointer border-0 bg-transparent p-0 disabled:cursor-default'>
                            <Image
                                src={
                                    filled
                                        ? '/icons/star-listings.svg'
                                        : '/icons/star-empty.svg'
                                }
                                alt=''
                                width={44}
                                height={44}
                                className='size-10 shrink-0 transition-transform duration-200 sm:size-11'
                            />
                        </MotionButton>
                    );
                })}
            </div>
            {!committed && (
                <p className='mt-3 mb-0 text-center text-[14px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                    {dict.step1Hint}
                </p>
            )}
            {committed && (
                <p className='mt-3 mb-0 flex items-center justify-center gap-2 text-[14px] leading-[1.6] tracking-[-0.012em] text-it-primary'>
                    <Image
                        src='/icons/review-verified.svg'
                        alt=''
                        width={16}
                        height={16}
                        className='size-4 shrink-0'
                    />
                    {dict.savedNote}
                </p>
            )}

            {error && (
                <p className='mt-3 mb-0 text-[14px] leading-[1.6] text-[#c0392b]'>
                    {error}
                </p>
            )}

            {/* Everything below unlocks only once the rating is safely stored. */}
            {committed && (
                <>
                    <Step header={dict.step2Header} helper={dict.step2Helper}>
                        <textarea
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            onBlur={() =>
                                comment.trim().length >= 10 &&
                                void save({ comment: comment.trim() })
                            }
                            rows={5}
                            placeholder={dict.step2Placeholder}
                            className='w-full resize-y rounded-[10px] border border-it-border bg-it-white p-3 text-[15px] leading-[1.6] tracking-[-0.012em] text-it-heading outline-none focus:border-it-primary'
                        />
                    </Step>

                    <Step header={dict.step3Header} helper={dict.step3Helper}>
                        <ReviewPhotoUploader
                            token={token}
                            photos={photos}
                            onChange={setPhotos}
                            dict={dict}
                        />
                    </Step>

                    <Step header={dict.step3bHeader}>
                        <div className='flex flex-wrap gap-2'>
                            {GUEST_TYPES.map(g => (
                                <MotionButton
                                    key={g.value}
                                    type='button'
                                    whileTap={{ scale: 0.95 }}
                                    transition={springPop}
                                    onClick={() => {
                                        setGuestType(g.value);
                                        void save({ reviewerType: g.value });
                                    }}
                                    className={`cursor-pointer rounded-it-full border px-5 py-2.5 text-[15px] leading-[1.2] transition-colors ${
                                        guestType === g.value
                                            ? 'border-it-primary bg-it-primary text-it-white'
                                            : 'border-it-border bg-it-white text-it-heading hover:border-it-primary'
                                    }`}>
                                    {dict[g.labelKey]}
                                </MotionButton>
                            ))}
                        </div>
                    </Step>

                    {/* STEP 4 - the PLATFORM question, kept visually and verbally
                        separate from the tour question above. Shown to everyone. */}
                    {trustpilotUrl && (
                        <div className='mt-7 rounded-[12px] border border-it-border bg-it-surface p-5'>
                            <span className='font-normal text-[17px] leading-[1.4] tracking-[-0.012em] text-it-heading'>
                                {dict.step4Header}
                            </span>
                            <p className='mt-1.5 mb-0 text-[14px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                {dict.step4Body}
                            </p>
                            <div className='mt-4 flex flex-wrap items-center gap-3'>
                                <a
                                    href={trustpilotUrl}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='rounded-[10px] bg-it-heading px-4.5 py-2.75 font-normal text-[14px] leading-[1.2] text-it-white no-underline transition-opacity duration-300 hover:opacity-90'>
                                    {dict.step4Cta}
                                </a>
                                <button
                                    type='button'
                                    onClick={() => setDone(true)}
                                    className='cursor-pointer border-0 bg-transparent p-0 text-[14px] leading-[1.2] text-it-text-muted underline'>
                                    {dict.step4Skip}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Service recovery - ALONGSIDE step 4 on a low score, never
                        instead of it. Gating the platform invitation on sentiment
                        is review gating and is not lawful. */}
                    {isLow && !feedbackSent && (
                        <div className='mt-4 rounded-[12px] border border-it-border bg-it-white p-5'>
                            <span className='font-normal text-[17px] leading-[1.4] tracking-[-0.012em] text-it-heading'>
                                {dict.recoveryHeader}
                            </span>
                            <p className='mt-1.5 mb-0 text-[14px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                {dict.recoveryBody}
                            </p>
                            <textarea
                                value={feedback}
                                onChange={e => setFeedback(e.target.value)}
                                rows={3}
                                placeholder={dict.recoveryPlaceholder}
                                className='mt-3 w-full resize-y rounded-[10px] border border-it-border bg-it-white p-3 text-[15px] leading-[1.6] tracking-[-0.012em] text-it-heading outline-none focus:border-it-primary'
                            />
                            <MotionButton
                                type='button'
                                disabled={busy || !feedback.trim()}
                                whileTap={{ scale: 0.97 }}
                                transition={springPop}
                                onClick={() => void sendFeedback()}
                                className='mt-3 cursor-pointer rounded-[10px] border-[1.5px] border-it-heading/20 bg-transparent px-4.5 py-2.75 font-normal text-[14px] leading-[1.2] text-it-heading transition-colors duration-300 hover:border-it-heading/40 disabled:opacity-50'>
                                {busy ? dict.saving : dict.recoverySend}
                            </MotionButton>
                        </div>
                    )}
                    {feedbackSent && (
                        <p className='mt-4 mb-0 text-[14px] leading-[1.6] tracking-[-0.012em] text-it-primary'>
                            {dict.recoverySent}
                        </p>
                    )}

                    <MotionButton
                        type='button'
                        whileTap={{ scale: 0.97 }}
                        transition={springPop}
                        onClick={() => setDone(true)}
                        className='mt-7 w-full cursor-pointer rounded-[10px] bg-it-primary px-4.5 py-3 font-normal text-[15px] leading-[1.2] text-it-white transition-colors duration-300 hover:bg-it-primary-hover'>
                        {dict.save}
                    </MotionButton>

                    <p className='mt-4 mb-0 text-[13px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                        {dict.verifiedNote}
                    </p>
                </>
            )}
        </Card>
    );
}

function Card({ children }: { children: React.ReactNode }) {
    return (
        <div className='w-full max-w-xl rounded-[16px] bg-it-white p-6 shadow-[0_26px_70px_-20px_rgba(0,0,0,0.25)] sm:p-8'>
            {children}
        </div>
    );
}

function Step({
    header,
    helper,
    children,
}: {
    header: string;
    helper?: string;
    children: React.ReactNode;
}) {
    return (
        <div className='mt-7 border-t border-it-border/70 pt-7'>
            <span className='font-normal text-[17px] leading-[1.4] tracking-[-0.012em] text-it-heading'>
                {header}
            </span>
            {helper && (
                <p className='mt-1.5 mb-2.5 text-[14px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                    {helper}
                </p>
            )}
            <div className={helper ? '' : 'mt-2.5'}>{children}</div>
        </div>
    );
}

