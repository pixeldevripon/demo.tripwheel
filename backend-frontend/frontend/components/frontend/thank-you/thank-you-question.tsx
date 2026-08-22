import { Reveal } from '@/components/frontend/reveal';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { ThankYouBooking } from '@/lib/thank-you/thank-you';
import Image from 'next/image';

type ThankYouDict = Dictionary['thankYou'];

/**
 * Tappable contact value (mailto/tel).
 *
 * Figma sets these in plain ink at body size, not as orange underlined links -
 * on this panel the whole point is the address itself, and six orange
 * underlines in a support box read as a list of things to click rather than as
 * the operator's details. They stay real links; the underline arrives on hover.
 */
const contactLink =
    'text-it-heading underline-offset-2 transition-colors hover:text-it-primary hover:underline tracking-[-0.012em]';

/**
 * Support panel (Figma 47745:12376): a full-width white radius-16 card split
 * down the middle by a vertical hairline - the operator's own contact on the
 * left ("talk to the locals running it"), the Island Tours fallback for
 * booking/payment issues on the right, with the booking ref inline.
 *
 * The BAND is the #f8f8f8 surface and the card on it is white - that contrast
 * is the only thing separating the two now that the card carries no border.
 * White-on-white left it invisible.
 *
 * It was a single 560px centred card with the two halves stacked and a
 * horizontal rule between them. Side by side is the point: the two are
 * alternatives, not steps, and stacking them made the platform address look
 * like the escalation you reach after the operator fails to reply.
 */
export function ThankYouQuestion({
    booking,
    dict,
}: {
    booking: ThankYouBooking;
    dict: ThankYouDict;
}) {
    // "Email {email} and include your ref ({ref})" - the support address
    // becomes a mailto link and the ref renders mono, inside the sentence.
    const [issueBefore, issueAfterRaw = ''] = dict.issueBody.split('{email}');
    const [afterBeforeRef, afterAfterRef = ''] = issueAfterRaw.split('{ref}');
    // "...and include your ref (X)" only makes sense for someone who HAS a
    // reference. The masked (shared-link) payload withholds it, so the whole
    // clause goes - printing the copy around an absent ref would leave an
    // empty pair of brackets. The sentence still reads as a sentence: it just
    // ends at the support address.
    const hasRefToken = issueAfterRaw.includes('{ref}');
    const showRef = hasRefToken && Boolean(booking.displayRef);
    const dropRefClause = hasRefToken && !showRef;
    const tailBefore = dropRefClause ? '' : afterBeforeRef;
    const tailAfter = dropRefClause ? '' : afterAfterRef;

    return (
        <section className='bg-it-surface pt-14 pb-[72px]'>
            <div className='it-container flex flex-col gap-8 md:gap-12'>
                <Reveal>
                    <h2 className='m-0 font-it-display it-h2 leading-[1.2] text-it-heading font-medium '>
                        {dict.questionTitle}
                    </h2>
                </Reveal>
                <Reveal>
                    {/* One card, two halves. The divider is a border on the
                        second column rather than an absolute line, so it is
                        exactly as tall as the taller half and disappears by
                        itself when the columns stack on mobile. */}
                    <div className='grid overflow-hidden rounded-[16px] bg-it-white md:grid-cols-2'>
                        <div className='flex flex-col gap-5 p-6 md:gap-7 md:p-8'>
                            <h3 className='m-0 text-[14.5px] font-medium leading-[1.6] tracking-[-0.012em] text-it-heading md:text-[18px]'>
                                {dict.talkLocals}
                            </h3>
                            <div className='flex flex-col gap-4'>
                                <p className='m-0 it-text text-it-text-muted '>
                                    {booking.operatorName}
                                </p>
                                <div className='flex flex-col gap-1 it-text '>
                                    {booking.operatorEmail && (
                                        <a
                                            href={`mailto:${booking.operatorEmail}`}
                                            className='flex w-fit items-center gap-2.5'>
                                            <Image
                                                src='/icons/thank-you/detail-sms.svg'
                                                alt=''
                                                width={24}
                                                height={24}
                                                className='size-5 shrink-0 md:size-6'
                                            />
                                            <span className={contactLink}>
                                                {booking.operatorEmail}
                                            </span>
                                        </a>
                                    )}
                                    {booking.operatorPhone && (
                                        <a
                                            href={`tel:${booking.operatorPhone}`}
                                            className='flex w-fit items-center gap-2.5'>
                                            <Image
                                                src='/icons/thank-you/detail-call.svg'
                                                alt=''
                                                width={24}
                                                height={24}
                                                className='size-5 shrink-0 md:size-6'
                                            />
                                            <span className={contactLink}>
                                                {booking.operatorPhone}
                                            </span>
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className='flex flex-col gap-5 border-it-divider p-6 max-md:border-t md:gap-7 md:border-l md:p-8'>
                            <h3 className='m-0 text-[14.5px] font-medium leading-[1.6] tracking-[-0.012em] text-it-heading md:text-[18px]'>
                                {dict.issueTitle}
                            </h3>
                            <div className='flex flex-col gap-2 it-text text-it-text-muted '>
                                <p className='m-0'>
                                    {issueBefore}
                                    <a
                                        href={`mailto:${booking.supportEmail}`}
                                        className={`font-medium ${contactLink}`}>
                                        {booking.supportEmail}
                                    </a>
                                    {tailBefore}
                                    {showRef && (
                                        <span className='font-medium tracking-[-0.012em] text-it-heading tabular-nums'>
                                            {booking.displayRef}
                                        </span>
                                    )}
                                    {tailAfter}
                                </p>
                                <p className='m-0'>{dict.replyTime}</p>
                            </div>
                        </div>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}
