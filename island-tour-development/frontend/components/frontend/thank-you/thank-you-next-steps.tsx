import { Reveal } from '@/components/frontend/reveal';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { ThankYouBooking } from '@/lib/thank-you/thank-you';

type ThankYouDict = Dictionary['thankYou'];

/**
 * "What happens next" (Figma 47745:11792): three columns, each a 64px outline
 * circle over a centred bullet list, joined by a single hairline behind the
 * circles. All neutral - every step is a future event, so none is "active".
 *
 * The payment-link step only renders when an operator balance is actually due
 * (email rule: hide zero-amount facts), which is why the connector has to know
 * whether it is spanning three columns or two.
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
            <div className='it-container flex flex-col gap-10 md:gap-12'>
                <Reveal>
                    <h2 className='m-0 text-center font-it-display it-h2 leading-[1.2] text-it-heading font-medium '>
                        {dict.nextTitle}
                    </h2>
                </Reveal>
                {/* Figma 47745:11791: three columns, each a 64px outline circle
                    over a centred bullet list - no cards. The step cards are
                    gone: a card draws a box around every step and turns a
                    three-beat timeline into three unrelated panels.

                    The connector is ONE hairline behind the circle row, run
                    between the first and last circle's centres. In a 3-column
                    grid those centres are at 1/6 and 5/6; in a 2-column grid
                    (paid in full, no payment-link step) they are at 1/4 and
                    3/4. The circles paint over it because they carry a white
                    fill and come later in the DOM. */}
                <div
                    className={`relative grid gap-10 md:gap-6 ${
                        steps.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'
                    }`}>
                    <span
                        aria-hidden='true'
                        className={`absolute top-6 hidden h-px bg-it-divider md:block ${
                            steps.length === 3
                                ? 'left-1/6 right-1/6'
                                : 'left-1/4 right-1/4'
                        }`}
                    />
                    {steps.map((step, i) => (
                        <Reveal
                            key={step.title}
                            listItem
                            className='relative flex flex-col items-center gap-6 text-center md:gap-8'>
                            <span className='grid size-11 shrink-0 place-items-center rounded-it-full border border-it-border bg-it-white it-h2 font-medium leading-[1.2] text-it-heading tabular-nums md:size-12 '>
                                {i + 1}
                            </span>
                            {/* A real list: two facts about one step, which is
                                what the discs in the mockup are saying. */}
                            <ul className='m-0 flex list-disc flex-col gap-1.5 ps-6 text-left it-text font-medium leading-[1.4] text-it-heading '>
                                <li>{step.title}</li>
                                {step.sub && <li>{step.sub}</li>}
                            </ul>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
}
