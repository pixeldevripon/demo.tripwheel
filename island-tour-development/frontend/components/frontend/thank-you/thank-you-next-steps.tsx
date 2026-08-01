import { Reveal } from '@/components/frontend/reveal';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { ThankYouBooking } from '@/lib/thank-you/thank-you';

type ThankYouDict = Dictionary['thankYou'];

/**
 * "What happens next" strip (Figma 47745-11649): three numbered circles on a
 * shared connector line. The payment-link step only renders when an operator
 * balance is actually due (email rule: hide zero-amount facts).
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
     * (related tours), so its bottom padding is dropped to sit flush. In the
     * management view it is the LAST white section before the grey support
     * band, so it keeps normal bottom padding (else the step labels crowd the
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
                      sub: dict.step2Sub.replace(
                          '{date}',
                          booking.payment.payBeforeShort,
                      ),
                  },
              ]
            : []),
        { title: dict.step3Title },
    ];

    return (
        <section
            className={`it-section bg-it-white ${flushBottom ? '!pb-0' : ''}`}>
            <div className='it-container flex flex-col items-center gap-12'>
                <Reveal>
                    <h2 className='m-0 text-center font-it-display text-[clamp(20px,2.4vw,26px)] font-bold leading-[1.2] tracking-[-0.013em] text-it-ink'>
                        {dict.nextTitle}
                    </h2>
                </Reveal>
                <div className='relative w-full'>
                    <span className='absolute left-1/2 top-8 hidden h-px w-full max-w-[800px] -translate-x-1/2 bg-[#d9d9d9] md:block' />
                    <div
                        className={`relative grid gap-4 ${
                            steps.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'
                        }`}>
                        {steps.map((step, i) => (
                            <Reveal key={step.title} listItem>
                                {/* .stepcard: white bordered card; the number
                                    rides top-left as the outline circle. */}
                                <div className='relative flex h-full flex-col gap-1.5 rounded-it-md border border-it-divider bg-it-white py-[18px] pl-[58px] pr-5 text-left shadow-it-sm'>
                                    <span className='absolute top-4 left-4 grid size-7 place-items-center rounded-it-full border-2 border-it-border bg-it-white text-[12.5px] font-extrabold text-it-text-muted tabular-nums'>
                                        {i + 1}
                                    </span>
                                    <span className='text-[14.5px] font-bold leading-[1.5] text-it-ink'>
                                        {step.title}
                                    </span>
                                    {step.sub && (
                                        <span className='text-[13px] leading-[1.55] text-it-text-muted'>
                                            {step.sub}
                                        </span>
                                    )}
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
