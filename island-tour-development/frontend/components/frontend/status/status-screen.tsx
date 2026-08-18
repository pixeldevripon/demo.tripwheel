import type { ReactNode } from 'react';

import { MotionSpan } from '@/components/frontend/motion-primitives';
import { springPop } from '@/lib/motion';

/**
 * The shared shell behind every status screen - the public 404, the public
 * error boundary, the root 404 and the last-resort error page. One composition
 * so a traveler who hits any dead end sees the same, recognisably Island Tours
 * surface: branded medallion, one sentence of plain language, and two ways out.
 *
 * Presentational and server-safe (motion comes from the shared client
 * primitives), so it renders from a server `not-found.tsx` and from a
 * `'use client'` error boundary alike.
 */

/**
 * Medallion tone. `coral` is the brand accent and carries wayfinding (a wrong
 * turn, nothing is broken); `amber` marks something that actually failed -
 * warm enough not to alarm a traveler mid-trip, distinct enough not to be
 * mistaken for the 404.
 *
 * Both are TINTS on white, never solid fills. The public site is white and
 * airy with coral as its single accent, so a saturated disc reads as foreign
 * here - and a large-format gradient (the hub hero) collapses into mud once
 * it is scaled down to a 88px circle, because all you see is the middle of
 * the blend. Tint + matching stroke survives any size.
 */
export type StatusTone = 'coral' | 'amber';

const TONE = {
    coral: {
        disc: 'bg-it-primary-subtle text-it-primary border-it-primary/15',
        marker: 'bg-it-primary',
    },
    amber: {
        disc: 'bg-it-warning-subtle text-it-warning border-it-warning/15',
        marker: 'bg-it-warning',
    },
} as const satisfies Record<StatusTone, Record<string, string>>;

/**
 * Eyebrow badge. `error` is the soft-red status-code treatment - pale red fill
 * with the `--it-error` glyph on top, which is how a red stays legible without
 * becoming an alarm. `neutral` is the default: the label is only a caption and
 * should not compete with the medallion.
 */
const EYEBROW = {
    neutral: 'bg-it-surface text-it-ink-secondary',
    error: 'bg-it-error-subtle text-it-error',
} as const;

export function StatusScreen({
    tone,
    icon,
    eyebrow,
    eyebrowTone = 'neutral',
    title,
    description,
    actions,
    footer,
    /** `viewport` fills the screen (no navbar/footer around it); `section` sits
     *  inside the site chrome and only claims most of the fold. */
    fill = 'section',
}: {
    tone: StatusTone;
    /** Rendered inside the medallion - sized by the caller, inherits the tint. */
    icon: ReactNode;
    eyebrow: string;
    /** `error` gives the label the soft-red status-code badge. */
    eyebrowTone?: keyof typeof EYEBROW;
    title: string;
    description: string;
    /** The two ways out. Always render a primary and a secondary. */
    actions: ReactNode;
    /** Optional recovery rail under the actions (island chips, error ref). */
    footer?: ReactNode;
    fill?: 'section' | 'viewport';
}) {
    const t = TONE[tone];

    return (
        <section
            className={`it-status-surface flex items-center ${
                fill === 'viewport' ? 'min-h-svh' : 'min-h-[72svh]'
            }`}>
            <div className='it-container flex w-full flex-col items-center py-20 text-center md:py-28'>
                {/* Medallion - a locator ring reduced to its two legible parts:
                    a dashed sweep and a bearing marker. Pure CSS, so it stays
                    crisp at any size and costs no request.
                    NOTE: `rounded-full`, not `rounded-it-full` - the token is a
                    fixed 50px pill radius, which on a box this wide rounds into
                    a squircle instead of a circle. */}
                <div className='relative mb-10 flex size-35 items-center justify-center md:mb-12 md:size-40'>
                    <span
                        aria-hidden
                        className='absolute inset-0 rounded-full border border-dashed border-it-border-subtle'
                    />
                    <span
                        aria-hidden
                        className={`absolute top-0 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ${t.marker}`}
                    />
                    <MotionSpan
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ ...springPop, delay: 0.15 }}
                        className={`relative grid size-22 place-items-center rounded-full border md:size-26 ${t.disc}`}>
                        {icon}
                    </MotionSpan>
                </div>

                {/* Sentence case, tracked like the rest of the public site: the
                    uppercase + wide-tracking label is a DASHBOARD convention and
                    appears nowhere on the traveler-facing pages. */}
                <span
                    className={`mb-5 inline-flex items-center rounded-it-full px-4 py-2 text-[12px] font-bold uppercase leading-none tracking-[0.1em] ${EYEBROW[eyebrowTone]}`}>
                    {eyebrow}
                </span>

                <h1 className='m-0 max-w-175 font-it-display text-[clamp(30px,4vw,46px)] leading-[1.15] tracking-[-0.012em] text-it-heading font-medium'>
                    {title}
                </h1>

                <p className='m-0 mt-4 max-w-[54ch] text-[16px] md:text-[18px] leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
                    {description}
                </p>

                <div className='mt-10 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-4'>
                    {actions}
                </div>

                {footer && (
                    <div className='mt-14 flex w-full flex-col items-center border-t border-it-border-subtle pt-10 md:mt-16'>
                        {footer}
                    </div>
                )}
            </div>
        </section>
    );
}

/**
 * Shared action styling. Both are pills on the sitewide CTA geometry; hovers
 * are colour-only (no lift, no scale-up) and the press squash comes from
 * `whileTap` on the caller's MotionLink/MotionButton.
 */
export const statusPrimaryClass =
    'inline-flex cursor-pointer items-center justify-center gap-[9px] rounded-it-sm border-none bg-it-primary px-[22px] py-3.5 text-[15.5px] font-medium leading-none text-it-white no-underline shadow-it-sm transition-all duration-(--it-duration-sm) ease-(--it-ease) hover:-translate-y-px hover:bg-it-primary-hover';

export const statusSecondaryClass =
    'inline-flex cursor-pointer items-center justify-center gap-[9px] rounded-it-sm border border-it-border bg-it-white px-[22px] py-3.5 text-[15.5px] font-medium leading-none text-it-heading no-underline transition-colors duration-(--it-duration-sm) ease-(--it-ease) hover:bg-it-bg';

