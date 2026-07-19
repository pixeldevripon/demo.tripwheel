import { Reveal } from '@/components/frontend/reveal';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { ThankYouBooking } from '@/lib/thank-you/thank-you';
import Image from 'next/image';

type ThankYouDict = Dictionary['thankYou'];

const contactText =
    'text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading';

/**
 * "Got a question about tour?" support card (Figma 47745-12375): operator
 * contact on the left, platform booking/payment support on the right, split
 * by a vertical divider on desktop.
 */
export function ThankYouQuestion({
    booking,
    dict,
}: {
    booking: ThankYouBooking;
    dict: ThankYouDict;
}) {
    // "Email {email} and include your ref ({ref})" - the support address
    // becomes a mailto link inside the sentence.
    const [issueBefore, issueAfterRaw = ''] = dict.issueBody.split('{email}');
    const issueAfter = issueAfterRaw.replace('{ref}', booking.displayRef);

    return (
        <section className='it-section bg-it-surface'>
            <div className='it-container flex flex-col gap-12'>
                <Reveal>
                    <h2 className='m-0 font-medium text-[28px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                        {dict.questionTitle}
                    </h2>
                </Reveal>
                <Reveal>
                    <div className='relative grid rounded-[16px] bg-it-white lg:min-h-[222px] lg:grid-cols-2'>
                        <span className='absolute inset-y-0 left-1/2 hidden w-px bg-[#d9d9d9] lg:block' />
                        <div className='flex flex-col gap-7 p-6 lg:p-8'>
                            <h3 className='m-0 max-w-[418px] font-medium text-[20px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                {dict.talkLocals}
                            </h3>
                            <div className='flex flex-col gap-4'>
                                <span className='text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                    {booking.operatorName}
                                </span>
                                {/* Operator contact is withheld on the unverified
                                    (masked) payload - render each link only when
                                    present so the shared-link view stays clean. */}
                                <div className='flex flex-col gap-1'>
                                    {booking.operatorEmail && (
                                        <a
                                            href={`mailto:${booking.operatorEmail}`}
                                            className='flex w-fit items-center gap-2.5'>
                                            <Image
                                                src='/icons/thank-you/contact-sms.svg'
                                                alt=''
                                                width={24}
                                                height={24}
                                                className='size-6'
                                            />
                                            <span className={contactText}>
                                                {booking.operatorEmail}
                                            </span>
                                        </a>
                                    )}
                                    {booking.operatorPhone && (
                                        <a
                                            href={`tel:${booking.operatorPhone.replace(/\s/g, '')}`}
                                            className='flex w-fit items-center gap-2.5'>
                                            <Image
                                                src='/icons/thank-you/contact-call.svg'
                                                alt=''
                                                width={24}
                                                height={24}
                                                className='size-6'
                                            />
                                            <span className={contactText}>
                                                {booking.operatorPhone}
                                            </span>
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className='flex flex-col gap-7 p-6 lg:py-8 lg:pl-[61px] lg:pr-8'>
                            <h3 className='m-0 font-medium text-[20px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                {dict.issueTitle}
                            </h3>
                            <div className='flex flex-col gap-2'>
                                <p className='m-0 max-w-[488px] text-[16px] leading-[1.6] tracking-[-0.012em] text-it-ink/60'>
                                    {issueBefore}
                                    <a href={`mailto:${booking.supportEmail}`}>
                                        {booking.supportEmail}
                                    </a>
                                    {issueAfter}
                                </p>
                                <p className='m-0 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-ink'>
                                    {dict.replyTime}
                                </p>
                            </div>
                        </div>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}
