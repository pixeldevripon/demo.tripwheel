import { ExpandableText } from '../expandable-text';
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
 * a fifth of the screen there; a toggle would trade a click for it). Mobile
 * keeps the intro short: the lead-in always renders in full, then about two
 * lines of body, and "Read more" runs on inline directly after the cut -
 * never on its own line, and the hook is never inside the cut. The toggle
 * expands the rest of the text IN PLACE and flips to "Show less" (client
 * feedback on mck-16 §3: the reader wants the rest of the paragraph, not a
 * jump to another part of the page - this supersedes the earlier
 * scroll-to-Discover behaviour). Same shared `ExpandableText` control as the
 * review snippets.
 */

// The lead-in must be a real sentence, not an abbreviation's dot - require a
// minimum run before the terminator.
const LEAD_IN_RE = /^(.{10,}?[.!?…])\s+(\S[\s\S]*)$/;

// ~2 lines of 14.5px body copy in a small-phone measure.
const MOBILE_CLAMP_CHARS = 150;

export function HubWhySection({
    title,
    paragraphs,
    readMoreLabel,
    showLessLabel,
}: {
    title: string;
    paragraphs: string[];
    readMoreLabel: string;
    showLessLabel: string;
}) {
    // Split the opening sentence off the first paragraph. No match means the
    // first paragraph IS a single sentence - it becomes the lead-in whole.
    const first = paragraphs[0] ?? '';
    const match = first.match(LEAD_IN_RE);
    const leadIn = match ? match[1] : first;
    const body = match ? [match[2], ...paragraphs.slice(1)] : paragraphs.slice(1);

    return (
        // Mobile py 32px (vs the it-section 64px default); desktop keeps 130px.
        <section className='bg-it-white pt-16 pb-2.5 max-md:pt-8'>
            <div className='it-container'>
                <Reveal className='flex flex-col gap-3.5'>
                    <h2 className='m-0 text-[24px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading font-medium'>
                        {title}
                    </h2>

                    <div className='flex max-w-[720px] flex-col gap-3'>
                        {/* Lead-in: always in full, on every screen. */}
                        <p className='m-0 font-it-display text-[17px] font-medium leading-[1.6] tracking-[-0.012em] text-it-heading md:text-[19px]'>
                            {leadIn}
                        </p>

                        {/* Desktop: the full body, never clamped. */}
                        {body.map((paragraph, i) => (
                            <p
                                key={i}
                                className='m-0 hidden text-[14px] md:text-[16px] leading-[1.6] text-it-text-muted md:block tracking-[-0.012em]'>
                                {paragraph}
                            </p>
                        ))}

                        {/* Mobile: about two lines, then Read more inline right
                            after the cut - the toggle never costs a row, and
                            expanding keeps paragraph breaks via pre-line. */}
                        {body.length > 0 && (
                            <ExpandableText
                                text={body.join('\n\n')}
                                moreLabel={readMoreLabel}
                                lessLabel={showLessLabel}
                                limit={MOBILE_CLAMP_CHARS}
                                className='m-0 whitespace-pre-line text-[14.5px] leading-[1.6] text-it-heading md:hidden tracking-[-0.012em]'
                                buttonClassName='inline cursor-pointer whitespace-nowrap border-none bg-transparent p-0 text-[14px] font-medium leading-[1.6] tracking-[-0.012em] text-it-primary underline decoration-1 underline-offset-[3px]'
                            />
                        )}
                    </div>
                </Reveal>
            </div>
        </section>
    );
}
