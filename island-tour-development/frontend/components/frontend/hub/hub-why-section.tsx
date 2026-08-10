'use client';

import { Reveal } from '../reveal';

/**
 * Activity Hub "Why {hub}" section (Figma node 48024:11174 desktop /
 * 48539:15988 mobile, layout corrected per mck-16 §3).
 *
 * Three levels, not one bold slab: the heading, then the opening sentence as
 * its own paragraph in the display face (one step larger and bold - a
 * different register, not just a heavier one), then normal-weight body copy.
 * The lead-in is split off the first paragraph here because the editorial
 * content arrives as plain text - authors don't reliably give the hook its own
 * paragraph.
 *
 * Desktop shows the full body and never clamps (the same ~95 words cost about
 * a fifth of the screen there; a "Learn more" would trade a click for it).
 * Mobile keeps the intro short: the lead-in always renders in full, then about
 * two lines of body, and "Learn more" runs on inline directly after the
 * ellipsis - never on its own line, and the hook is never inside the cut. The
 * link goes somewhere, as those words mean everywhere else on the platform: it
 * scrolls to the Discover section, which already carries the long read.
 */

// The lead-in must be a real sentence, not an abbreviation's dot - require a
// minimum run before the terminator.
const LEAD_IN_RE = /^(.{10,}?[.!?…])\s+(\S[\s\S]*)$/;

// ~2 lines of 14.5px body copy in a small-phone measure.
const MOBILE_CLAMP_CHARS = 150;

/** Cut at a word boundary at or before `max`, dropping trailing punctuation. */
function truncateAtWord(text: string, max: number): string {
    if (text.length <= max) return text;
    const slice = text.slice(0, max + 1);
    const cut = slice.lastIndexOf(' ');
    return (cut > 0 ? slice.slice(0, cut) : slice).replace(/[\s,;:.]+$/, '');
}

export function HubWhySection({
    title,
    paragraphs,
    learnMoreLabel,
    learnMoreTargetId = 'hub-section-discover',
}: {
    title: string;
    paragraphs: string[];
    learnMoreLabel: string;
    /** Element id the mobile "Learn more" smooth-scrolls to (the long read). */
    learnMoreTargetId?: string;
}) {
    // Split the opening sentence off the first paragraph. No match means the
    // first paragraph IS a single sentence - it becomes the lead-in whole.
    const first = paragraphs[0] ?? '';
    const match = first.match(LEAD_IN_RE);
    const leadIn = match ? match[1] : first;
    const body = match ? [match[2], ...paragraphs.slice(1)] : paragraphs.slice(1);

    const mobileBody = truncateAtWord(body[0] ?? '', MOBILE_CLAMP_CHARS);
    const mobileCut =
        body.length > 1 || (body[0] ?? '').length > MOBILE_CLAMP_CHARS;

    const handleLearnMore = () => {
        // The Discover panel renders stacked inside the trips section with a
        // stable id + scroll-mt, so plain scrollIntoView lands it below the
        // fixed navbar (same pattern as the hero's Check Availability).
        document
            .getElementById(learnMoreTargetId)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        // Mobile py 32px (vs the it-section 64px default); desktop keeps 130px.
        <section className='bg-it-white pt-16 pb-2.5 max-md:pt-8'>
            <div className='it-container'>
                <Reveal className='flex flex-col gap-3.5'>
                    <h2 className='m-0 font-it-display text-[clamp(22px,2.8vw,30px)] font-bold leading-[1.2] tracking-[-0.015em] text-it-ink'>
                        {title}
                    </h2>

                    <div className='flex max-w-[720px] flex-col gap-3'>
                        {/* Lead-in: always in full, on every screen. */}
                        <p className='m-0 font-it-display text-[17px] font-bold leading-[1.6] tracking-[-0.01em] text-it-ink md:text-[19px]'>
                            {leadIn}
                        </p>

                        {/* Desktop: the full body, never clamped. */}
                        {body.map((paragraph, i) => (
                            <p
                                key={i}
                                className='m-0 hidden text-[15.5px] leading-[1.7] text-it-ink md:block'>
                                {paragraph}
                            </p>
                        ))}

                        {/* Mobile: about two lines, then Learn more inline
                            right after the cut - the link never costs a row. */}
                        {body.length > 0 && (
                            <p className='m-0 text-[14.5px] leading-[1.6] text-it-ink md:hidden'>
                                {mobileBody}
                                {mobileCut && '…'}{' '}
                                <button
                                    type='button'
                                    onClick={handleLearnMore}
                                    className='inline cursor-pointer whitespace-nowrap border-none bg-transparent p-0 text-[14px] font-normal leading-[1.6] tracking-[-0.012em] text-it-heading underline decoration-1 underline-offset-[3px] transition-colors hover:text-it-primary'>
                                    {learnMoreLabel}
                                </button>
                            </p>
                        )}
                    </div>
                </Reveal>
            </div>
        </section>
    );
}
