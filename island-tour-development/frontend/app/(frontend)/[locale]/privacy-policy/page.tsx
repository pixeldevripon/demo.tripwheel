import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import {
    LegalPageShell,
    LegalTableScroller,
} from '@/components/frontend/legal/legal-page-shell';
import { isLocale } from '@/lib/constants/locales';
import { buildAlternates } from '@/lib/seo/alternates';

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const title = 'Privacy Policy';
    if (!isLocale(locale)) return { title };
    return { title, alternates: buildAlternates(locale, '/privacy-policy') };
}

/**
 * Global legal page - text is the verbatim handover copy from
 * public/Legal Pages (change it only through Denley, per the README).
 */
export default async function PrivacyPolicyPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();

    return (
        <LegalPageShell locale={locale} title='Privacy Policy'>
            <h2>In short</h2>
            <p>
                We are Island Tours, a marketplace that connects you with
                independent local operators who run the tours. To take your
                booking and get you on your tour, we collect some personal data
                and we share what the operator needs to deliver your tour. We
                use trusted providers for payments, email, hosting, and
                measuring our advertising. We do not sell your personal data.
                You can see, correct, or delete your data, and you control
                marketing and tracking through your choices. This summary is
                here to help; the sections below are the full picture, including
                the data we share, where it goes, and how to exercise your
                rights.
            </p>

            <h2>1. Who is responsible for your data</h2>
            <p>
                This policy explains how we handle your personal data when you
                use www.island.tours and book tours with us. The controller of
                your personal data is ITG B.V. (trading as Island Tours),
                Caracasbaaiweg 366, Willemstad, Curacao, registered with the
                Chamber of Commerce of Curacao under number 169950. You can
                reach us at{' '}
                <a href='mailto:info@island.tours'>info@island.tours</a>.
            </p>
            <p>
                ITG B.V. is established in Curacao and offers services to people
                in the European Union and the European Economic Area, so the EU
                General Data Protection Regulation (GDPR) applies to that
                processing, alongside the Curacao data protection law (the
                Landsverordening bescherming persoonsgegevens), which is
                supervised by the College bescherming persoonsgegevens (CBP).
            </p>
            <p>
                Because we are established outside the European Union, we have
                appointed a representative in the Union under Article 27 GDPR.
                For data protection matters, you can contact our representative
                in addition to, or instead of, us: Site Bar B.V., Aert van
                Nesstraat 45, 3012 EB Rotterdam, Netherlands,{' '}
                <a href='mailto:info@sitebar.info'>info@sitebar.info</a>.
            </p>
            <p>
                We have not appointed a data protection officer. For any
                question about your data, contact us at{' '}
                <a href='mailto:info@island.tours'>info@island.tours</a>.
            </p>

            <h2>2. The personal data we collect</h2>
            <p>Depending on how you use Island Tours, we collect:</p>
            <ul>
                <li>
                    Your details: your first and last name, email address, phone
                    number, and the language and country you use.
                </li>
                <li>
                    Your booking: the tour, the date and time, your party (the
                    number of adults and children, and children's ages where the
                    tour needs them), your pickup or meeting details, and any
                    special requests you add.
                </li>
                <li>
                    Payment details: the last four digits and brand of your
                    card, and the billing country, postal code, and city, which
                    we receive from our payment processor. We do not store your
                    full card number; that is handled by our payment processor.
                </li>
                <li>
                    Your messages: what you send us by email or WhatsApp, and
                    our replies.
                </li>
                <li>
                    Reviews and content: if you leave a review, your first name
                    and last initial, your rating, your text, the month and year
                    you travelled, and any photos you add. Photos can contain
                    other people and can carry hidden location information.
                </li>
                <li>
                    How you use the site: device and usage data, and identifiers
                    from cookies and similar technologies, including advertising
                    click identifiers and a hashed identifier derived from your
                    email that helps us recognise you across devices. This is
                    set out in our Cookie Policy.
                </li>
            </ul>
            <p>
                To make a booking, you must give us the details we need to take
                and deliver it; without them we cannot complete your booking.
                Other data, such as review photos or your marketing preferences,
                is optional.
            </p>

            <h2>3. Where your data comes from</h2>
            <p>
                Most of your data comes from you, when you book, contact us, or
                leave a review. Some is collected automatically when you use the
                site, such as usage and cookie data. Some payment details come
                from our payment processor. Where someone books a tour that
                includes other travellers, we receive those travellers' details
                from the person who made the booking, and we may receive content
                such as an operator's reply to your review from the operator.
            </p>

            <h2>4. Why we use your data, and our legal basis</h2>
            <p>
                We use your data only for clear purposes, and each rests on a
                legal basis under the GDPR:
            </p>
            <LegalTableScroller>
                <table>
                    <thead>
                        <tr>
                            <th>What we do</th>
                            <th>Why</th>
                            <th>Legal basis</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>
                                Take and manage your booking, send your booking
                                details to the operator who runs the tour,
                                collect your deposit, and send you booking
                                emails
                            </td>
                            <td>To provide what you booked</td>
                            <td>Performance of our contract with you</td>
                        </tr>
                        <tr>
                            <td>Handle payments</td>
                            <td>To take and refund payment for your booking</td>
                            <td>
                                Performance of our contract, and our legal
                                obligations for payment records
                            </td>
                        </tr>
                        <tr>
                            <td>Keep tax, accounting, and invoicing records</td>
                            <td>Because the law requires it</td>
                            <td>Legal obligation</td>
                        </tr>
                        <tr>
                            <td>
                                Keep the platform secure, prevent fraud, and
                                handle disputes and chargebacks
                            </td>
                            <td>To protect you, the operators, and us</td>
                            <td>
                                Our legitimate interests in a secure,
                                trustworthy service
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Improve our service with basic,
                                privacy-respecting analysis
                            </td>
                            <td>
                                To understand and improve how the platform works
                            </td>
                            <td>
                                Our legitimate interests for analysis that does
                                not use non-essential cookies; your consent for
                                analysis that does
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Show you relevant advertising and measure our
                                advertising, using cookies and tools
                            </td>
                            <td>To measure and improve our advertising</td>
                            <td>Your consent</td>
                        </tr>
                        <tr>
                            <td>Send you marketing emails</td>
                            <td>To tell you about tours and offers</td>
                            <td>
                                Your consent, or our legitimate interest for
                                emails about similar tours after you book, which
                                you can opt out of at any time, as set out in
                                section 11
                            </td>
                        </tr>
                    </tbody>
                </table>
            </LegalTableScroller>
            <p>
                Where we rely on our legitimate interests, you can ask us about
                the balancing we have done. Where we rely on your consent, you
                can withdraw it at any time, and that does not affect anything
                we did before you withdrew it.
            </p>

            <h2>5. Sharing your data with the tour operator</h2>
            <p>
                This is at the heart of how a marketplace works, so we want it
                to be clear. To deliver the tour you book, we share with the
                independent operator that runs it the booking details the
                operator needs to provide and contact you about your tour: your
                name, the date and party details, your pickup or meeting
                details, your contact details, and any special requests you
                made. We share only what the operator needs for your booking. We
                do not share your payment-card details with the operator;
                payments are handled by us and our payment processor.
            </p>
            <p>
                The operator is an independent controller of your data for the
                tour it delivers, which means the operator decides how it uses
                that data to run the tour and is responsible for that use under
                its own privacy terms. We share this data because it is
                necessary to perform the booking you asked us to make. Where the
                operator is in a country outside the European Economic Area that
                does not have an EU adequacy decision, we put appropriate
                safeguards in place for that sharing, as described in section 8,
                and we share only the data needed for your individual booking.
                We do not give operators bulk or standing access to our customer
                database.
            </p>

            <h2>6. Other recipients of your data</h2>
            <p>
                We use a small set of trusted providers, and we share data with
                others only as described here. We do not sell your personal
                data.
            </p>
            <ul>
                <li>
                    Site Bar B.V. (Netherlands) collects your payment as
                    merchant of record on our behalf, through our payment
                    processor.
                </li>
                <li>
                    Stripe processes card payments and gives us the limited
                    billing details above.
                </li>
                <li>Our email provider sends our booking emails.</li>
                <li>
                    Our database, hosting, and infrastructure providers store
                    our data and run our platform.
                </li>
                <li>
                    Google and Meta provide analytics and advertising and
                    measurement tools, described in section 7.
                </li>
                <li>Cookiebot manages your cookie consent.</li>
                <li>
                    Our affiliate-tracking provider measures referrals from our
                    affiliate partners.
                </li>
                <li>
                    Google Translate translates review text where you ask to see
                    it in another language.
                </li>
                <li>
                    Professional advisers such as accountants and lawyers, and
                    public authorities where the law requires it.
                </li>
            </ul>
            <p>
                Each provider may only use your data to provide its service to
                us, except where it is an independent controller, such as the
                operators (section 5) and the advertising platforms (section 7).
            </p>

            <h2>7. Advertising, measurement, and hashed data</h2>
            <p>
                If you consent to advertising and measurement cookies, we share
                certain data with Google and Meta so we can measure how well our
                advertising works and reach relevant audiences. This can include
                a hashed version of your email address, phone number, name, and
                address details (your billing city, postal code, and country).
                Hashing turns this information into a coded value before it is
                shared. Google uses it for a feature called Enhanced
                Conversions, and Meta for a feature called Advanced Matching, to
                match a booking to an advertisement. Some of this is sent from
                our servers to Google and Meta rather than only through your
                browser.
            </p>
            <p>
                This happens only with your consent, which you give and can
                withdraw through our cookie settings. Google and Meta act as
                independent controllers for their own advertising purposes.
                Hashing does not make the data anonymous, so we treat it as your
                personal data and disclose it here openly. For how these
                transfers are protected, see section 8.
            </p>

            <h2>8. Sending your data outside the European Economic Area</h2>
            <p>
                Some of your data is processed outside the European Economic
                Area, including by us in Curacao, by our United States providers
                such as Google and Meta, and by operators outside the area.
                Curacao is not covered by an EU adequacy decision, so transfers
                of personal data to us in Curacao need an appropriate safeguard.
            </p>
            <p>
                We are honest about where this stands. Because Island Tours is
                itself directly subject to the GDPR for this processing, the
                standard contractual clauses the European Commission adopted in
                2021 are not, on their own, designed for transfers to a
                recipient in our position, and the Commission's tailored clauses
                for that situation are not yet in force. We are therefore
                putting in place contractual and organisational safeguards,
                supported by a transfer impact assessment, designed to give your
                data a level of protection essentially equivalent to that within
                the EU, and we apply our own GDPR obligations to this data. We
                are doing the same for data passed from Site Bar B.V. in the
                Netherlands to us in Curacao, and for the data we share with
                operators outside the area to deliver your booking. We will
                update this section once the appropriate instruments are
                finalised.
            </p>
            <p>
                Transfers to United States providers such as Google and Meta are
                made, where the recipient is certified, under the EU-US Data
                Privacy Framework, or otherwise under standard contractual
                clauses. This data is only shared after you have consented to
                the relevant cookies, and we confirm each provider's
                certification before we rely on it.
            </p>
            <p>
                If you would like more detail, or a copy of the safeguards,
                contact our EU representative at{' '}
                <a href='mailto:info@sitebar.info'>info@sitebar.info</a>.
            </p>

            <h2>9. How long we keep your data</h2>
            <p>
                We keep your data only as long as we need it for the purposes in
                this policy. How long that is depends on the data:
            </p>
            <ul>
                <li>
                    Booking and account data: for as long as you use Island
                    Tours and for as long as we need it to handle questions,
                    disputes, refunds, and chargebacks that arise from your
                    bookings.
                </li>
                <li>
                    Tax, accounting, and invoicing records: for the minimum
                    period that tax and accounting law requires, including the
                    Curacao rules that apply to Island Tours and the Dutch rules
                    that apply to the records handled by Site Bar.
                </li>
                <li>
                    Marketing and consent records: until you withdraw your
                    consent or object, after which we stop and keep only what we
                    need to show that you opted out.
                </li>
                <li>
                    Cookie and tracking data: for the lifetime of each cookie or
                    as set by the provider, as described in our Cookie Policy.
                </li>
            </ul>
            <p>
                After the relevant period, we delete your data or make it
                anonymous.
            </p>

            <h2>10. Your rights</h2>
            <p>
                You have rights over your personal data, and we want them to be
                easy to use. You can ask us to:
            </p>
            <ul>
                <li>give you a copy of your data (access);</li>
                <li>
                    correct data that is wrong or incomplete (rectification);
                </li>
                <li>delete your data (erasure);</li>
                <li>limit how we use your data (restriction);</li>
                <li>
                    give you your data in a portable form, or send it to another
                    provider (portability);
                </li>
                <li>
                    stop using your data where we rely on our legitimate
                    interests (objection), and stop using it for direct
                    marketing at any time;
                </li>
                <li>
                    withdraw your consent at any time, where we rely on consent.
                </li>
            </ul>
            <p>
                We do not make decisions about you by solely automated means
                that have a legal or similarly significant effect on you (see
                section 13).
            </p>
            <p>
                To exercise any of these, contact us at{' '}
                <a href='mailto:info@island.tours'>info@island.tours</a>, or our
                EU representative at{' '}
                <a href='mailto:info@sitebar.info'>info@sitebar.info</a>. We may
                need to confirm your identity first. We respond within one
                month, and we will tell you if we need up to two more months for
                a complex request.
            </p>
            <p>
                If you think we have not handled your data properly, you can
                complain to a supervisory authority. In Curacao this is the
                College bescherming persoonsgegevens (CBP). If you are in the
                European Union or the European Economic Area, you can complain
                to the authority in your own country, and because our
                representative is in the Netherlands you can also turn to the
                Dutch Autoriteit Persoonsgegevens. We would appreciate the
                chance to put things right first, so please consider contacting
                us before you complain.
            </p>

            <h2>11. Marketing</h2>
            <p>
                We send marketing only the way the law allows. If you have
                booked with us, we may send you occasional emails about similar
                tours, and you can unsubscribe from any of them. For broader
                updates, such as travel inspiration, we ask for your separate
                consent through an option that is not pre-ticked. Every
                marketing email has an unsubscribe link. Our booking
                confirmations and other service emails are not marketing, so you
                keep receiving those even if you unsubscribe from marketing.
            </p>

            <h2>12. Cookies</h2>
            <p>
                We use cookies and similar technologies for essential functions,
                and, with your consent, for analytics and advertising. You set
                and change your choices through our cookie banner and our Manage
                Cookies page, managed by Cookiebot, where non-essential cookies
                are off until you turn them on. Our Cookie Policy explains each
                cookie and how to manage it.
            </p>

            <h2>13. Automated decisions and profiling</h2>
            <p>
                We do not make decisions about you based solely on automated
                processing that produce a legal or similarly significant effect
                on you. Where you consent to advertising cookies, we and
                providers such as Google and Meta may build a picture of your
                likely interests to show you relevant advertising. This does not
                have a legal or similarly significant effect on you, and you can
                object to it and withdraw your consent at any time through our
                cookie settings.
            </p>

            <h2>14. Children</h2>
            <p>
                Our services are for adults. You must be 18 or older to make a
                booking or hold an account. We do not direct our services to
                children or collect children's data for our own marketing. When
                you book a tour that includes children travelling with you, you
                give us their details so the booking can go ahead, and you are
                responsible for being allowed to share them. We use the data of
                any children in a booking only to deliver that booking, never
                for marketing.
            </p>

            <h2>15. How we keep your data secure</h2>
            <p>
                We protect your data with appropriate measures. Card payments
                are handled by our payment processor, and we do not store your
                full card number. Your booking pages use links that cannot be
                guessed, account login is rate-limited, and our booking emails
                are sent from a protected, authenticated domain. We choose
                providers that commit to protecting your data, and we limit
                access to those who need it.
            </p>

            <h2>16. Changes to this policy</h2>
            <p>
                We may update this policy, for example to reflect changes in the
                platform, our providers, or the law. We will post the updated
                policy with a new date, and where a change is significant we
                will let you know. The version that applies is the one in force
                when we process your data.
            </p>

            <h2>17. How to contact us</h2>
            <p>
                For any privacy question, or to exercise your rights, email{' '}
                <a href='mailto:info@island.tours'>info@island.tours</a>, or
                message us on WhatsApp, every day 08:00 to 20:00 (local time).
                Our representative in the European Union is Site Bar B.V., Aert
                van Nesstraat 45, 3012 EB Rotterdam, Netherlands,{' '}
                <a href='mailto:info@sitebar.info'>info@sitebar.info</a>. This
                Privacy Policy should be read with our Cookie Policy and our
                Terms of Service. It was last updated on 18 June 2026. Island
                Tours. Built by Islanders.
            </p>
        </LegalPageShell>
    );
}
