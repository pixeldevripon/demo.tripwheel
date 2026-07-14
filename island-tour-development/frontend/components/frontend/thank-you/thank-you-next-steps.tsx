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
}: {
    booking: ThankYouBooking;
    dict: ThankYouDict;
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
        <section className='it-section !pb-0 bg-it-white'>
            <div className='it-container flex flex-col items-center gap-12'>
                <Reveal>
                    <h2 className='m-0 text-center font-medium text-[28px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                        {dict.nextTitle}
                    </h2>
                </Reveal>
                <div className='relative w-full'>
                    <span className='absolute left-1/2 top-8 hidden h-px w-full max-w-[800px] -translate-x-1/2 bg-[#d9d9d9] md:block' />
                    <div
                        className={`relative grid gap-6 ${
                            steps.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'
                        }`}>
                        {steps.map((step, i) => (
                            <Reveal key={step.title} delay={0.2 + i * 0.12}>
                                <div className='flex flex-col items-center gap-8'>
                                    <span className='flex size-16 items-center justify-center rounded-full border border-[#d9d9d9] bg-it-white'>
                                        <span className='font-medium text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                                            {i + 1}
                                        </span>
                                    </span>
                                    <span className='flex h-[72px] w-full max-w-[352px] flex-col items-center justify-center gap-1.5'>
                                        <span className='text-center font-medium text-[16px] leading-[1.4] tracking-[-0.012em] text-it-heading'>
                                            {step.title}
                                        </span>
                                        {step.sub && (
                                            <span className='text-center font-medium text-[16px] leading-[1.4] tracking-[-0.012em] text-it-heading'>
                                                {step.sub}
                                            </span>
                                        )}
                                    </span>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
