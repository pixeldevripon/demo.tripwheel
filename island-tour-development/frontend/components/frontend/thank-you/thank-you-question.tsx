import { Reveal } from '@/components/frontend/reveal';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { ThankYouBooking } from '@/lib/thank-you/thank-you';
import Image from 'next/image';

type ThankYouDict = Dictionary['thankYou'];

/** Deep-orange tappable contact value (mailto/tel). */
const contactLink =
    'font-semibold text-it-primary-hover underline underline-offset-2 transition-opacity hover:opacity-80';

/**
 * Support card (design v2 .supportcard): a single 560px centred white card -
 * operator contact first ("talk to the locals running it"), a hairline
 * divider, then the Island Tours fallback for booking/payment issues with the
 * mono booking ref inline.
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
        <section className='bg-it-white pt-14 pb-[72px]'>
            <div className='it-wrap'>
                <Reveal className='mx-auto w-full max-w-[560px]'>
                    <div className='rounded-it-lg border border-it-divider bg-it-white px-5 py-[22px] shadow-it-sm md:px-8 md:py-7'>
                        <h3 className='m-0 font-it-display text-[19px] font-bold leading-[1.3] tracking-[-0.01em] text-it-ink'>
                            {dict.questionTitle}
                        </h3>
                        <p className='m-0 mt-1.5 text-[14px] leading-[1.6] text-it-text-muted'>
                            {dict.talkLocals}
                        </p>
                        <div className='mt-4'>
                            <b className='mb-1.5 block text-[15px] font-bold leading-[1.6] text-it-ink'>
                                {booking.operatorName}
                            </b>
                            {/* Operator contact is withheld on the unverified
                                (masked) payload - render each link only when
                                present so the shared-link view stays clean. */}
                            {booking.operatorEmail && (
                                <a
                                    href={`mailto:${booking.operatorEmail}`}
                                    className='flex w-fit items-center gap-[9px] py-1 text-[14px] leading-[1.6]'>
                                    <Image
                                        src='/icons/thank-you/detail-sms.svg'
                                        alt=''
                                        width={24}
                                        height={24}
                                        className='size-4 shrink-0'
                                    />
                                    <span className={contactLink}>
                                        {booking.operatorEmail}
                                    </span>
                                </a>
                            )}
                            {booking.operatorPhone && (
                                <a
                                    href={`tel:${booking.operatorPhone.replace(/\s/g, '')}`}
                                    className='flex w-fit items-center gap-[9px] py-1 text-[14px] leading-[1.6]'>
                                    <Image
                                        src='/icons/thank-you/detail-call.svg'
                                        alt=''
                                        width={24}
                                        height={24}
                                        className='size-4 shrink-0'
                                    />
                                    <span className={contactLink}>
                                        {booking.operatorPhone}
                                    </span>
                                </a>
                            )}
                        </div>
                        <div className='my-[18px] border-t border-it-divider' />
                        <b className='block text-[14px] font-bold leading-[1.6] text-it-ink'>
                            {dict.issueTitle}
                        </b>
                        <p className='m-0 mt-1 text-[13.5px] leading-[1.6] text-it-text-muted'>
                            {issueBefore}
                            <a
                                href={`mailto:${booking.supportEmail}`}
                                className={contactLink}>
                                {booking.supportEmail}
                            </a>
                            {tailBefore}
                            {showRef && (
                                <code className='font-mono text-[12.5px] font-bold text-it-ink'>
                                    {booking.displayRef}
                                </code>
                            )}
                            {tailAfter}
                        </p>
                        <p className='m-0 mt-1 text-[13.5px] leading-[1.6] text-it-text-muted'>
                            {dict.replyTime}
                        </p>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

