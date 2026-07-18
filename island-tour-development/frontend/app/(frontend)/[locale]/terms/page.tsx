import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { LegalPageShell } from '@/components/frontend/legal/legal-page-shell';
import { isLocale } from '@/lib/constants/locales';

export const metadata: Metadata = { title: 'Terms of Service' };

/**
 * Global legal page - text is the verbatim handover copy from
 * public/Legal Pages (change it only through Denley, per the README).
 */
export default async function TermsPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();

    return (
        <LegalPageShell locale={locale} title='Terms of Service'>
            <h2>In short</h2>
            <p>
                Island Tours is a marketplace. We connect you with independent
                local operators, the Islanders who actually run the tours. When
                you book, you enter into two agreements at once: one with us to
                use the platform, and one with the operator for the tour
                itself. The operator runs the tour and is responsible for how
                it goes. We run the platform, take your booking, collect your
                deposit, and are here to help. This summary is here to make the
                terms easy to follow. The numbered sections below are what
                actually applies.
            </p>

            <h2>1. Who we are and what these terms cover</h2>
            <p>
                This website and the booking service at www.island.tours are
                operated by ITG B.V. (short for Island Tours Group), a besloten
                vennootschap under the law of Curacao, registered with the
                Chamber of Commerce of Curacao under number 169950, with its
                office at Caracasbaaiweg 366, Willemstad, Curacao. In these
                terms, "Island Tours", "we", "us" and "our" mean ITG B.V. "You"
                means the person who uses the platform or makes a booking.
            </p>
            <p>
                These Terms of Service are the agreement between you and Island
                Tours for your use of the platform and for booking a tour
                through it. Our Privacy Policy, Cookie Policy, and Cancellation
                Policy also apply and are part of your agreement with us.
                Please read them. If you do not agree with these terms, please
                do not use the platform.
            </p>

            <h2>2. What Island Tours is, and what it is not</h2>
            <p>
                Island Tours operates an online marketplace that connects
                travelers with independent local tour operators. The tour is
                provided by the operator, not by Island Tours. When you book,
                the contract for the tour itself is concluded directly between
                you and the operator. Island Tours is not the operator, the
                organizer, or the guide, and does not own, run, or supervise
                the tours.
            </p>
            <p>
                What Island Tours does is provide the platform: we present the
                listings, take your booking, collect the deposit, send your
                confirmation, and provide customer help. We carry out this
                booking and intermediation service with reasonable care and
                skill. Our responsibility is for that service. The operator is
                responsible for delivering the tour. This division runs through
                the whole of these terms, and the limits of our responsibility
                in clause 13 follow from it.
            </p>

            <h2>3. Who can book, and your account</h2>
            <p>
                You must be at least 18 years old to make a booking or to hold
                an account. By booking, you confirm that you are 18 or older
                and that the information you give us is accurate. If you book a
                tour for a group that includes people under 18, you do so as
                the responsible adult for that booking, and any per-tour
                minimum age and suitability requirements still apply to each
                participant.
            </p>
            <p>
                When you make a booking, we create a lightweight account for
                you so you can view and manage that booking. You log in with
                your email address and your booking reference. Keep your
                booking reference private; it is the key to your booking
                details. Tell us promptly if you think someone else has gained
                access. You are responsible for the bookings made through your
                account, except where this results from our own failure or
                fault.
            </p>

            <h2>4. How booking works</h2>
            <p>
                You choose a tour, a date and time, and the number of
                travelers, and you review the price summary, which always shows
                the total, the amount due today, and any balance due later,
                with all taxes and fees included. You confirm by selecting the
                booking button. At that point you agree to these terms and the
                Privacy Policy, and your booking is submitted. We confirm
                bookings instantly and send you a confirmation email. The
                confirmation email is your ticket; there is no separate paper
                voucher. Some tours close to new bookings a set time before
                they start, and some sell out; if a tour is no longer available
                when you try to confirm, we will tell you and keep your date so
                you can pick another option.
            </p>

            <h2>5. Payment, and who collects it</h2>
            <p>
                How payment is collected. Payments you make through the
                platform are processed by Site Bar B.V. (Netherlands) as
                merchant of record, on behalf of Island Tours, through our
                payment processor Stripe. Because of this, a charge on your
                bank or card statement may appear under the name of Site Bar
                B.V., or under another descriptor we set with our payment
                processor, rather than Island Tours. We will never ask for your
                card details by reply email, text, or phone. Always pay only
                through the secure links in your booking emails.
            </p>
            <p>
                The four payment models. How and when you pay the price of a
                tour depends on the payment model of that tour, which is shown
                to you before you book:
            </p>
            <ul>
                <li>
                    Deposit, balance by secure link. You pay a deposit to
                    Island Tours when you book. The operator later sends you a
                    secure link to pay the remaining balance online before the
                    deadline.
                </li>
                <li>
                    Deposit, balance on arrival. You pay a deposit to Island
                    Tours when you book. You pay the remaining balance in
                    person on arrival, by the method the tour allows (card or
                    cash, or cash only).
                </li>
                <li>
                    Paid in full. You pay the full price to Island Tours when
                    you book. There is no further balance.
                </li>
                <li>
                    Paid to the operator. You pay nothing when you book. The
                    operator collects the full price directly.
                </li>
            </ul>
            <p>
                The deposit is a percentage of the tour price, between 20
                percent and 30 percent, shown to you before you confirm. The
                deposit secures your place. What the deposit and the balance
                cover, and how each is refunded, is set out in clause 7 and in
                the Cancellation Policy. If you do not pay the balance by the
                deadline on the secure-link model, or on arrival on the
                on-arrival model, the operator may treat the booking as
                cancelled and the deposit may be forfeited, subject to clause
                7, the Cancellation Policy, and your mandatory rights. Any
                balance you pay later is charged in the currency stated for
                that tour; your card issuer or pay-later provider may apply its
                own conversion and fees, which are outside our control.
            </p>
            <p>
                Payment methods. Depending on your device and tour, you can pay
                by Visa, Mastercard, American Express, PayPal, iDEAL, Apple
                Pay, Google Pay, or Klarna, through our payment provider.
                Klarna is a third-party credit and pay-later provider; if you
                choose Klarna, you also enter into Klarna's own agreement and
                terms, which are separate from these terms, and your credit
                relationship is with Klarna. Your card details are handled by
                Stripe; we do not store your full card number.
            </p>

            <h2>6. Prices, currency, taxes, and fees</h2>
            <p>
                Prices are shown with all taxes and fees included, before you
                reach the booking step. We do not add hidden charges. The price
                you see in the summary is the total for the travelers and
                options you selected. Prices are shown in US dollars or euros
                depending on your language, and you can change the display
                currency in the footer; the currency you are charged in is the
                one shown at checkout. What is included in and excluded from a
                tour is set by the operator and shown on the tour page.
            </p>

            <h2>7. Cancellations, changes, and refunds</h2>
            <p>
                Every tour on the platform can be cancelled for free up to a
                cut-off time before it starts. How late you can cancel is set
                per tour and shown on the tour page and in your confirmation
                email. You cancel from your booking in your account, or by
                using the link in your confirmation email; if you have any
                trouble, contact us at{' '}
                <a href='mailto:info@island.tours'>info@island.tours</a>. If
                you cancel within the free-cancellation window, you receive a
                full refund of any amount you paid to us. After the cut-off,
                the booking is locked and the deposit is non-refundable. If the
                operator has to cancel, for example because conditions are
                unsafe, you are covered: you receive a full refund or a free
                reschedule.
            </p>
            <p>
                Because a tour is booked for a specific date or period, it is a
                leisure or transport service for a specific date. Under EU
                consumer law and under Curacao consumer law, the standard
                14-day or 7-day cooling-off right for distance contracts does
                not apply to such dated activities. This exemption applies only
                where your booking is for a specific date or period. If you buy
                an open-dated voucher with no date set when you buy it, you
                keep the standard 14-day withdrawal right for 14 days from your
                purchase, until you choose a specific date, whichever comes
                first. This does not affect the free-cancellation window above,
                your rights if the operator cancels, or any mandatory rights
                you have under the law of your country of residence.
            </p>
            <p>
                The detailed refund mechanics, including how the deposit held
                by us and any balance held by the operator are refunded, the
                refund timing, and how each payment model is handled, are set
                out in our Cancellation Policy. Where the operator holds part
                of the price, that part is refunded by the operator.
            </p>

            <h2>8. Your responsibilities</h2>
            <p>
                When you book and travel, you agree to: give accurate booking
                and contact information; arrive at the meeting point or pickup
                location at the stated time, allowing for the arrival buffer
                shown for your tour; meet the stated requirements for the tour,
                including any minimum age, fitness level, health, and
                suitability conditions; follow the operator's safety rules and
                instructions during the tour; and behave lawfully and with
                respect for the operator, the guides, other travelers, and the
                environment. You agree not to misuse the platform, for example
                by trying to disrupt it, scrape or harvest its content by
                automated means, resell bookings, impersonate another person,
                upload harmful code, infringe the rights of others, harass our
                team, the guides, or other travelers, make fraudulent bookings
                or payments, or use the platform to break the law. If you
                breach these rules, we may act under clause 18. If you do not
                meet a tour's stated requirements, the operator may decline
                your participation.
            </p>

            <h2>9. The operators, and what they are responsible for</h2>
            <p>
                Operators are independent businesses that list and deliver
                their own tours. The operator is responsible for delivering the
                tour as described and for doing so in compliance with the
                safety, licensing, insurance, and permit requirements that
                apply to it. The operator sets the tour content, the meeting
                and pickup arrangements, the safety rules, and the conditions
                of participation. Operators have their own terms, which apply
                to the tour they deliver. These terms govern your relationship
                with Island Tours and your use of the platform; the operator's
                own terms govern the tour itself. If an operator's terms would
                reduce your mandatory consumer rights, those rights prevail.
            </p>
            <p>
                Before payment, our copy does not name or promote the operator.
                After you book, we name the operator, because the operator will
                be in touch with you, for example to send a secure link to pay
                any balance. An email from your named operator about your
                balance is expected; treat any payment request that does not
                come through the links in your booking emails as suspicious and
                check with us first.
            </p>

            <h2>10. Activities involve risk</h2>
            <p>
                Many of the tours on the platform are active or outdoor
                experiences, for example boat trips, snorkeling, diving, sunset
                cruises, off-road and buggy tours, jet ski, parasailing, water
                sports, fishing, hiking, and adventure activities such as
                ziplining. These activities carry inherent risks that remain
                even when reasonable care is taken, including risks from water,
                weather, terrain, and physical exertion. When you book such a
                tour, you acknowledge these inherent risks and agree to follow
                the operator's safety rules and instructions and to meet the
                stated fitness, health, and ability requirements. The operator
                may refuse or stop the participation of anyone who is unfit to
                take part, who is under the influence of alcohol or drugs, or
                who does not follow the safety rules.
            </p>
            <p>
                Nothing in this clause excludes or limits any liability for
                death or personal injury caused by negligence, or for any other
                loss to the extent it is caused by negligence or a failure to
                take reasonable care, and nothing in it affects any mandatory
                rights you have under the law of your country of residence.
            </p>

            <h2>11. Reviews and content you submit</h2>
            <p>
                You can submit reviews, ratings, photos, and other content
                about a tour you have booked. We only accept reviews from
                confirmed bookings. When you submit content, you keep your
                rights in it, and you give Island Tours a worldwide,
                royalty-free licence to host, display, and share that content
                in connection with the platform and the tour, including showing
                a machine translation with a link to your original. This
                licence ends when you delete your content or your account,
                except for copies we must keep by law and content that others
                have already shared in line with these terms. We use your
                content only to operate and promote the platform and the
                relevant tour, and we do not sell it or give third parties the
                right to use it for their own independent purposes. When we
                translate your content, we do not change its meaning. This
                licence does not affect any moral rights you have under your
                local law.
            </p>
            <p>
                You agree that your content is your own, is accurate, and does
                not break the law or the rights of others, and that it contains
                no offensive, misleading, or harmful material. We may moderate,
                decline, or remove content that breaks these terms or the law,
                and where we do, we give you a clear statement of the reasons
                and tell you how you can respond. Do not submit content about
                other people without their agreement, and be aware that a photo
                may reveal information about its location and the people in it.
            </p>

            <h2>12. Reporting illegal content</h2>
            <p>
                If you believe a listing or any content on the platform is
                illegal, you can report it to us by email at{' '}
                <a href='mailto:info@island.tours'>info@island.tours</a>. Tell
                us what the content is, where it is, and why you believe it is
                illegal, and give us a way to contact you. We will confirm we
                have received your report, look into it carefully and without
                bias, let you know the outcome, and tell you how you can take
                the matter further. Where we remove or restrict a listing or
                content, we give the affected operator or user a statement of
                the reasons and of how they can respond. Where we become aware
                of content suggesting a serious criminal offence that threatens
                the life or safety of a person, we may inform the relevant
                authorities.
            </p>

            <h2>13. Our responsibility to you, and the limits of it</h2>
            <p>
                Please read this clause carefully. It sets the limits of our
                liability, and the things those limits never affect.
            </p>
            <p>
                What we are always responsible for. Nothing in these terms
                excludes or limits our liability for death or personal injury
                caused by our negligence, for fraud or fraudulent
                misrepresentation, for our gross negligence or our intentional
                acts or omissions, or for any liability or right that cannot be
                excluded or limited under the mandatory law that applies to
                you, including your mandatory consumer rights. If any other
                part of these terms conflicts with this paragraph, this
                paragraph applies.
            </p>
            <p>
                What we are responsible for. We are responsible for providing
                the platform and the booking and intermediation service with
                reasonable care and skill. We are not responsible for the
                performance of the tour by the operator, which the operator
                delivers and is responsible for, except to the extent this
                cannot be excluded under the mandatory law that applies to you.
            </p>
            <p>
                The limit. Subject to the paragraph above on what we are always
                responsible for, and except for any liability that cannot be
                limited under the mandatory law that applies to you, our total
                liability to you for any claim connected with a booking is
                limited to the total price of the tour you booked. Nothing in
                this clause limits our liability for breach of an obligation
                that is essential to providing the platform and the booking
                service. We are responsible only for loss that is a reasonably
                foreseeable result of our breach of these terms.
            </p>
            <p>
                This clause does not reduce any rights you have against the
                operator, and does not affect any rights you have under the
                mandatory law of your country of residence.
            </p>

            <h2>14. Intellectual property</h2>
            <p>
                The platform and its content, including text, layout, graphics,
                and logos, belong to Island Tours or its licensors and are
                protected by applicable intellectual property rights. Island
                Tours and the Built by Islanders tagline are names and marks we
                use for the platform. Operators own or are responsible for the
                content they provide about their tours. You may use the
                platform for your own personal, non-commercial use to discover
                and book tours. You may not copy, reproduce, or reuse the
                content of the platform without our permission, except where
                the law allows.
            </p>

            <h2>15. The affiliate program and operator listings</h2>
            <p>
                Island Tours runs an affiliate program for partners who refer
                travelers to the platform. Participation in the affiliate
                program is governed by separate affiliate terms. Listing a tour
                as an operator is governed by separate operator terms. These
                separate terms are in addition to, and do not replace, these
                Terms of Service for your use of the platform as a traveler.
            </p>

            <h2>16. Other services and links</h2>
            <p>
                The platform uses third-party services, for example Stripe for
                payments and Klarna for pay-later, and may link to websites run
                by others, for example operators, payment providers, and social
                media. Those services and websites have their own terms and
                privacy practices. We are not responsible for the content or
                practices of third-party websites. Where a third party provides
                a service to you directly, such as Klarna credit, your
                agreement for that service is with that third party.
            </p>

            <h2>17. Changes by us, and events beyond control</h2>
            <p>
                An operator may need to change or cancel a tour, for example
                because of weather, safety, or too few participants. Where this
                happens, your rights are set out in clause 7 and in the
                Cancellation Policy. Neither we nor the operator is responsible
                for a failure or delay caused by events beyond reasonable
                control, for example extreme weather, natural events, strikes,
                or government measures, except that this does not affect your
                right to a refund or reschedule where the tour cannot go ahead,
                and does not affect your mandatory rights.
            </p>

            <h2>18. Suspension and termination</h2>
            <p>
                You can stop using the platform at any time. We may suspend or
                close an account, or remove a listing or content, where there
                is a breach of these terms or the law, where it is necessary to
                protect the platform, travelers, or operators, or where we are
                required to by law. Where we do this, we act proportionately,
                we give the affected user a clear statement of the reasons, and
                we explain how they can respond or complain. Suspension or
                closure does not affect bookings that are already confirmed,
                which remain governed by these terms and the Cancellation
                Policy.
            </p>

            <h2>19. Changes to these terms</h2>
            <p>
                We may update these terms, for example to reflect changes in
                the platform, the law, or how we work. We will post the updated
                terms with a new date, and where the change is significant we
                will let you know at least 30 days before it takes effect. If
                you do not agree with a significant change, you can tell us and
                stop using the platform; the change will not apply to a booking
                you already made. The terms that apply to a booking are the
                ones in force when you made it.
            </p>

            <h2>20. The law that applies, and where you can go to court</h2>
            <p>
                These terms and your use of the platform are governed by the
                law of Curacao. However, if you are a consumer who is
                habitually resident in the European Union or the European
                Economic Area, this choice does not deprive you of the
                protection of the mandatory provisions of the law of your
                country of residence, and those mandatory provisions continue
                to apply to you.
            </p>
            <p>
                If you are a consumer resident in the European Union or the
                European Economic Area, you may bring proceedings in the courts
                of your country of residence or in the courts of Curacao, and
                we will bring any proceedings against you only in the courts of
                your country of residence. For all other users, the courts of
                Curacao have exclusive jurisdiction.
            </p>
            <p>
                If you have a complaint, please contact us first at{' '}
                <a href='mailto:info@island.tours'>info@island.tours</a> and we
                will try to resolve it with you. If we cannot resolve it, you
                may be able to refer it to an alternative dispute resolution
                body or to the consumer authority in your country of residence.
                We are not obliged to use a particular dispute resolution body
                and do not commit to one, but this does not affect your right
                to use any scheme available to you or to go to a competent
                court, or any mandatory rights you have under the law of your
                country of residence. The EU Online Dispute Resolution platform
                was discontinued on 20 July 2025 and is no longer available, so
                we do not link to it.
            </p>

            <h2>21. Language</h2>
            <p>
                We provide these terms and the operative information in English
                and in other languages. English is the reference version we use
                for interpretation between us and our operators. If you
                concluded your booking in another language that we made
                available, that language version governs your relationship with
                us as a consumer to the extent of any conflict or difference,
                read in your favour, and nothing in this clause deprives you of
                information in a language you understand or of any mandatory
                local-language protection that applies to you.
            </p>

            <h2>22. Other terms</h2>
            <p>
                If any part of these terms is found to be invalid or
                unenforceable, the rest stays in force, and the invalid part is
                replaced by a valid one that comes as close as possible to the
                original intention. We may transfer our rights and obligations
                under these terms to another company, for example as part of a
                reorganization, as long as this does not reduce your rights;
                you may not transfer yours without our agreement, except for a
                right to compensation. If we do not enforce a term on one
                occasion, that does not mean we give it up. These terms,
                together with the Privacy Policy, Cookie Policy, and
                Cancellation Policy, are the whole agreement between you and us
                for your use of the platform.
            </p>

            <h2>23. How to contact us</h2>
            <p>
                Email: <a href='mailto:info@island.tours'>info@island.tours</a>
                . Phone: +5999 5266046, every day 08:00 to 20:00 (local time).
                Postal address: ITG B.V., Caracasbaaiweg 366, Willemstad,
                Curacao. For matters under the Digital Services Act, you can
                contact us at{' '}
                <a href='mailto:info@island.tours'>info@island.tours</a>, in
                English or Dutch. Our representative in the European Union for
                data protection and for the Digital Services Act is Site Bar
                B.V., Aert van Nesstraat 45, 3012 EB Rotterdam, Netherlands,{' '}
                <a href='mailto:info@sitebar.info'>info@sitebar.info</a>. How
                we handle your personal data is set out in our Privacy Policy.
            </p>
            <p>
                These terms were last updated on 18 June 2026. Island Tours.
                Built by Islanders.
            </p>
        </LegalPageShell>
    );
}
