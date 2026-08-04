import { Reveal } from '@/components/frontend/reveal';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { ThankYouBooking } from '@/lib/thank-you/thank-you';
import { Fragment } from 'react';

type ThankYouDict = Dictionary['thankYou'];

/**
 * "What happens next" (design v2 .whatnext): the checkout-style step indicator
 * (34px outline circles on 2px connector lines - all neutral, every step is a
 * future event) above three per-step cards. On mobile the indicator hides and
 * each card carries its own 28px number circle instead. The payment-link step
 * only renders when an operator balance is actually due (email rule: hide
 * zero-amount facts).
 */
export function ThankYouNextSteps({
    booking,
    dict,
    flushBottom = false,
}: {
    booking: ThankYouBooking;
    dict: ThankYouDict;
    /**
     * Celebratory TYP: this section is followed by more white sections
     * (related tours), so its bottom padding is dropped to sit tight. In the
     * management view it is the LAST white section before the grey support
     * band, so it keeps normal bottom padding (else the step cards crowd the
     * boundary).
     */
    flushBottom?: boolean;
}) {
    const steps: { title: string; sub?: string }[] = [
        { title: dict.step1Title, sub: dict.step1Sub },
        ...(booking.payment.balance > 0
            ? [
                  {
                      title: dict.step2Title,
                      sub: dict.step2Sub
                          .replace('{operator}', booking.operatorName)
                          .replace('{date}', booking.payment.payBeforeShort),
                  },
              ]
            : []),
        {
            title: dict.step3Title,
            // Shipped with no body at all, so the last card rendered as a bare
            // heading on a blank panel (test report 2026-08-01 §Traveler.3).
            // The start time is a formatted label and can be empty when the
            // departure carries no time of day, hence the second string - a
            // sentence reading "Arrive at  and..." is worse than no time.
            sub: booking.startTimeLabel
                ? dict.step3Sub.replace('{time}', booking.startTimeLabel)
                : dict.step3SubNoTime,
        },
    ];

    return (
        <section
            className={`bg-it-white pt-14 ${flushBottom ? 'pb-2' : 'pb-14'}`}>
            <div className='it-wrap flex flex-col'>
                <Reveal>
                    <h2 className='m-0 mb-7 text-center font-it-display text-[clamp(20px,2.4vw,26px)] font-medium leading-[1.2] tracking-[-0.013em] text-it-ink'>
                        {dict.nextTitle}
                    </h2>
                </Reveal>
                {/* Desktop step indicator - equal outline circles, no active
                    state. Two steps (paid in full) get the longer connector. */}
                <Reveal>
                    <div
                        aria-hidden='true'
                        className='mb-[18px] hidden items-center justify-center md:flex'>
                        {steps.map((step, i) => (
                            <Fragment key={step.title}>
                                {i > 0 && (
                                    <span
                                        className={`h-0.5 bg-it-divider ${steps.length === 3 ? 'w-[120px]' : 'w-[150px]'}`}
                                    />
                                )}
                                <span className='grid size-[34px] place-items-center rounded-it-full border-2 border-it-border bg-it-white text-[14px] font-medium text-it-text-muted tabular-nums'>
                                    {i + 1}
                                </span>
                            </Fragment>
                        ))}
                    </div>
                </Reveal>
                <div
                    className={`grid gap-4 text-left ${
                        steps.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'
                    }`}>
                    {steps.map((step, i) => (
                        <Reveal key={step.title} listItem>
                            {/* .stepcard: white bordered card; on mobile the
                                number rides top-left as the outline circle. */}
                            <div className='relative h-full rounded-it-md border border-it-divider bg-it-white py-[18px] pl-[58px] pr-5 shadow-it-sm md:px-5'>
                                <span className='absolute top-4 left-4 grid size-7 place-items-center rounded-it-full border-2 border-it-border bg-it-white text-[12.5px] font-medium text-it-text-muted tabular-nums md:hidden'>
                                    {i + 1}
                                </span>
                                <b className='block text-[14.5px] font-medium leading-[1.5] text-it-ink'>
                                    {step.title}
                                </b>
                                {step.sub && (
                                    <p className='m-0 mt-1.5 text-[13px] leading-[1.55] text-it-text-muted'>
                                        {step.sub}
                                    </p>
                                )}
                            </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
}

