import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { LegalPageShell } from '@/components/frontend/legal/legal-page-shell';
import { isLocale } from '@/lib/constants/locales';
import { buildAlternates } from '@/lib/seo/alternates';

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const title = 'Cancellation and Refund Policy';
    if (!isLocale(locale)) return { title };
    return {
        title,
        alternates: buildAlternates(locale, '/cancellation-policy'),
    };
}

/**
 * Global legal page - text is the verbatim handover copy from
 * public/Legal Pages (change it only through Denley, per the README).
 */
export default async function CancellationPolicyPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();

    return (
        <LegalPageShell locale={locale} title='Cancellation and Refund Policy'>
            <h2>In short</h2>
            <p>
                Plans change, and we keep this simple. Every tour on Island
                Tours can be cancelled for free up to a cut-off time before it
                starts. How late you can cancel is set per tour and shown on the
                tour page and in your confirmation email. Cancel in time and you
                get a full refund of what you paid. What you paid to us comes
                back from us, fast. If you already paid the balance to the
                operator, the operator refunds that part. The sections below
                explain exactly who refunds what, when, and how, and your rights
                if the operator has to cancel. This summary is here to help; the
                numbered sections are what applies.
            </p>

            <h2>1. How cancellation works on Island Tours</h2>
            <p>
                Every tour on the platform comes with free cancellation. That is
                a requirement we place on every operator, so it is true for
                every tour. What changes from tour to tour is how late you can
                cancel: the cut-off is set per tour by the operator and is shown
                on the tour page, in the booking step, and in your confirmation
                email. There is one cut-off per tour, and it governs both your
                free cancellation and, where there is a balance to pay, your
                balance deadline.
            </p>

            <h2>2. The free-cancellation window</h2>
            <p>
                You can cancel for free at any time up to the cut-off for your
                tour. The cut-off is a number of hours before your tour starts,
                shown to you before you book and in your confirmation email, and
                it is always stated in the local time of the tour.
            </p>
            <ul>
                <li>
                    Up to the cut-off: you can cancel for a full refund of any
                    amount you have paid. No forms, no questions asked.
                </li>
                <li>
                    After the cut-off: the booking is locked and the deposit is
                    not refundable. If you had not yet paid the balance, you do
                    not owe it once your place is released. If the operator has
                    to cancel, you are still covered (see section 7).
                </li>
            </ul>

            <h2>3. How to cancel</h2>
            <p>
                You cancel from the link in your confirmation email, or from
                your booking in your account at www.island.tours (you log in
                with your email and your booking reference). The link opens a
                short confirmation page, you confirm, and we email you once the
                cancellation is processed. We judge your cancellation against
                the cut-off using the time you send the request, not the time we
                process it, so a request sent in time is treated as in time even
                if we confirm it the next morning. If you have any trouble,
                contact us at{' '}
                <a href='mailto:reservations@island.tours'>
                    reservations@island.tours
                </a>{' '}
                or on WhatsApp.
            </p>

            <h2>4. Refunds: who refunds what, when, and how</h2>
            <p>
                This is the part travelers ask about most, because a tour can
                involve two payments: a deposit you pay to us when you book, and
                a balance you may pay later. So a refund can come from two
                places. Here is exactly how it works.
            </p>
            <p>
                Money you paid to us, refunded by us. Tours use one of three
                payment models, shown to you when you book: on most, you pay a
                deposit to us at booking and the balance later; on some, you pay
                the full price to us at booking; and on some, the operator
                collects the whole price and we collect nothing. Wherever we
                hold your money, whether a deposit or the full price, we refund
                it to your original payment method, normally within 3 to 5
                business days. It is collected by our payment partner Site Bar
                B.V. through Stripe, so the refund returns to that same charge
                on your statement. This is the fast, predictable part.
            </p>
            <p>
                Your balance, refunded depending on how you paid it. How the
                balance is refunded depends on the payment model of your tour,
                which was shown to you when you booked:
            </p>
            <table>
                <thead>
                    <tr>
                        <th>How you paid</th>
                        <th>What happens to the balance</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            The operator sent you a secure link and you paid
                            online
                        </td>
                        <td>
                            The operator refunds the balance to that payment. If
                            it is slow, message us and we will chase it for you.
                        </td>
                    </tr>
                    <tr>
                        <td>
                            You were going to pay on arrival and had not paid
                            yet
                        </td>
                        <td>
                            There is nothing to refund, because you had not paid
                            the balance.
                        </td>
                    </tr>
                    <tr>
                        <td>You paid the full price to us at booking</td>
                        <td>
                            We refund the full amount to your original payment
                            method, normally within 3 to 5 business days.
                        </td>
                    </tr>
                    <tr>
                        <td>
                            You paid the whole price to the operator and we took
                            no deposit
                        </td>
                        <td>
                            Nothing was paid to us, so there is nothing for us
                            to refund. If you already paid the operator, the
                            operator refunds you directly.
                        </td>
                    </tr>
                </tbody>
            </table>
            <p>
                Every operator on Island Tours is required to refund a balance
                they collected within 10 business days when you cancel in time,
                or when they cancel a departure. If an operator does not,
                contact us with your booking reference and we will pursue it for
                you.
            </p>
            <p>
                Two things to expect. First, where a refund comes partly from us
                and partly from the operator, the two parts can arrive on
                different timelines, and that is normal. Our part is fast; the
                operator&apos;s part should reach you within 10 business days.
                Second, if the operator&apos;s part of your refund has not
                arrived within 10 business days, message us with your booking
                reference and we will chase it.
            </p>
            <p>
                Refunds are made to the original payment method, in the currency
                you were charged in. Your bank or card provider may apply its
                own conversion or fees on a refund, which are outside our
                control.
            </p>

            <h2>5. If you do not pay the balance, and no-shows</h2>
            <p>
                If your tour has a balance to pay before the deadline and you do
                not pay it, the operator may treat the booking as cancelled and
                your place may be released. After the cut-off the booking is
                locked and the deposit is not refundable. This is never
                automatic on our side: the operator tells us, we confirm, and
                only then is the place released.
            </p>
            <p>
                If you do not show up for a tour and have not cancelled in time,
                the booking is treated as a no-show. The deposit is not
                refundable. If you had not paid the balance, nothing further is
                owed; any balance you had already paid is not normally
                refundable for a no-show. Booking another date is treated as a
                new booking.
            </p>

            <h2>6. Changes and rescheduling</h2>
            <p>
                If your plans change, here is how moving a date works. For the
                same tour, contact us before you cancel: if the operator has
                space on your new date, we can usually move your booking to that
                date instead of refunding and rebooking, as long as you ask
                within the free-cancellation window for your tour. There is
                nothing to refund and nothing to pay again, unless the new date
                has a different price, in which case we settle only the
                difference. If the operator has no space, or you want a
                different tour, the way to change is to cancel within the
                free-cancellation window for a full refund and book again. A
                move always depends on the operator having availability, so we
                cannot guarantee a place on a new date. Where the operator
                offers a free reschedule after it has had to cancel (section 7),
                we will let you know and set it up.
            </p>

            <h2>7. If the operator cancels</h2>
            <p>
                Sometimes the operator has to cancel a departure, for example
                because conditions are unsafe, the weather will not allow the
                tour to run safely, too few people have booked for it to go
                ahead, or there is a technical problem. When the operator
                cancels, you are always covered: you receive a full refund or a
                free reschedule, your choice where a new date is offered. The
                refund covers both your deposit and any balance you paid, each
                refunded by the party that holds it (your deposit by us, your
                balance by the operator).
            </p>

            <h2>8. Weather</h2>
            <p>
                Most tours run in light rain. The weather only stops a tour when
                conditions would make it unsafe, and that decision sits with the
                operator, who knows the water, the route, and the forecast. If
                the operator cancels for weather, that is an operator
                cancellation and section 7 applies: a full refund or a free
                reschedule. We do not cancel a tour for weather on the
                operator&apos;s behalf, and we do not charge you for an
                operator&apos;s weather cancellation.
            </p>

            <h2>9. Events beyond control</h2>
            <p>
                Neither we nor the operator is responsible for a failure or
                delay caused by events beyond reasonable control, for example
                extreme weather, natural events, strikes, or government
                measures. Where such an event means a tour cannot go ahead, you
                receive a full refund or a free reschedule as set out above.
                This does not affect any mandatory rights you have under the law
                of your country of residence.
            </p>

            <h2>10. Your statutory right of withdrawal</h2>
            <p>
                In short: because your tour is booked for a specific date, the
                standard cooling-off period does not apply to it. Here is why.
                If you are a consumer, distance-selling law normally gives you a
                right to withdraw from an online purchase within a short period
                (14 days under EU law, 7 days under Curacao law). That right
                does not apply to services related to leisure activities,
                transport, or similar services where the contract is for a
                specific date or period of performance. Tours, boat trips, water
                activities, day trips, and similar dated experiences fall under
                this exception, so the cooling-off right does not apply to a
                tour you book for a specific date or time.
            </p>
            <p>
                This exception applies only where your booking is for a specific
                date or period. If you ever buy an open-dated voucher with no
                date set when you buy it, the cooling-off right applies for 14
                days from your purchase, until you choose a specific date,
                whichever comes first. None of this affects the
                free-cancellation window in section 2, your rights if the
                operator cancels in section 7, or any mandatory rights you have
                under the law of your country of residence.
            </p>

            <h2>11. Your payment, your statement, and currency</h2>
            <p>
                Because the money you pay us is collected by Site Bar B.V.
                through Stripe on our behalf, a charge for your deposit or full
                payment may appear on your statement under the name of Site Bar
                B.V., or under another descriptor we set, rather than Island
                Tours. A balance you pay to the operator appears separately,
                under the operator or its payment provider. Each refund returns
                to its own original charge. We will never ask for your card
                details by reply email, text, or phone. Always pay only through
                the secure links in your booking emails, and if a payment
                request looks off, check with us on WhatsApp first.
            </p>

            <h2>12. If something goes wrong, talk to us first</h2>
            <p>
                If you are unhappy with a refund or a cancellation, please
                contact us before you raise a dispute with your bank. Because a
                booking can involve two payments, a chargeback raised on the
                wrong one can delay things for you and for the operator. Tell us
                your booking reference and we will explain exactly which payment
                is refunded by whom and help you sort it out. If you do raise a
                dispute, raise it against the right charge: your payment to us
                shows as Site Bar B.V., and any balance shows under the
                operator. This does not affect your right to raise a dispute or
                to use the options in our Terms of Service, including your
                mandatory consumer rights.
            </p>

            <h2>13. Questions</h2>
            <p>
                Email{' '}
                <a href='mailto:reservations@island.tours'>
                    reservations@island.tours
                </a>{' '}
                or message us on WhatsApp, every day 08:00 to 20:00 (local
                time). This Cancellation Policy is part of, and should be read
                with, our Terms of Service. It was last updated on 18 June 2026.
                Island Tours. Built by Islanders.
            </p>
        </LegalPageShell>
    );
}
