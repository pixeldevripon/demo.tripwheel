import { BookingRefPill } from '@/components/frontend/thank-you/booking-ref-pill';
import { MountReveal } from '@/components/frontend/mount-reveal';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { TriangleAlert } from 'lucide-react';

type ThankYouDict = Dictionary['thankYou'];

/**
 * The rule #22 error render: shown when the backend reports that this CONFIRMED
 * booking carries a null `commission_amount` (`dataError: 'NULL_COMMISSION'`).
 *
 * WHY A BANNER AND NOT A THROWN ERROR. The master requires "render an error and
 * fire no conversion - never a silent fallback" (TRACKING-AND-ANALYTICS §8.2).
 * The fault is in the booking's REPORTING value, not in the booking: the
 * traveller has paid and holds a valid, confirmed reservation, and their tour
 * date, meeting point and operator contact are the reason they opened this page.
 * Blanking that behind an error screen would turn an internal accounting defect
 * into a customer-facing outage. So the page still renders, headed by an
 * unmissable banner that names the booking reference and routes the traveller to
 * support - and no conversion fires on any platform.
 *
 * The banner is also the ops signal: it appears on EVERY render until the record
 * is repaired (the corruption path deliberately never burns the mark-first
 * guard), and each render logs `data corruption` on the backend.
 *
 * The copy tells the traveller to contact us quoting their reference, so both
 * halves of that instruction are affordances here rather than plain text: the
 * shared `BookingRefPill` (tap to copy - this is the one surface that ASKS for
 * the ref, so it must not be the one place you cannot copy it) and a mailto to
 * the same support address the card further down the page uses.
 */
export function ThankYouRecordIssueNotice({
    displayRef,
    supportEmail,
    dict,
}: {
    /** Customer-facing reference. Null only on a masked payload, where this
     *  notice does not render anyway - the ref pill is simply omitted. */
    displayRef: string | null;
    supportEmail: string;
    dict: ThankYouDict;
}) {
    return (
        <section className='it-section bg-it-white'>
            <div className='it-container'>
                <MountReveal>
                    <div
                        role='alert'
                        className='flex flex-col items-start gap-4 rounded-[16px] border border-it-error/25 bg-it-error-subtle p-6 sm:flex-row sm:items-start'>
                        <span className='flex size-10 shrink-0 items-center justify-center rounded-full bg-it-error/10'>
                            <TriangleAlert className='size-5 text-it-error' />
                        </span>
                        <div className='flex flex-col items-start gap-3'>
                            <div className='flex flex-col gap-1'>
                                <p className='m-0 font-normal text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                    {dict.recordIssueTitle}
                                </p>
                                <p className='m-0 text-[14px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                    {dict.recordIssueBody}{' '}
                                    <a
                                        href={`mailto:${supportEmail}`}
                                        className='font-semibold text-it-primary-hover underline underline-offset-2 transition-opacity hover:opacity-80'>
                                        {supportEmail}
                                    </a>
                                </p>
                            </div>
                            {displayRef && (
                                <BookingRefPill
                                    displayRef={displayRef}
                                    dict={dict}
                                />
                            )}
                        </div>
                    </div>
                </MountReveal>
            </div>
        </section>
    );
}
