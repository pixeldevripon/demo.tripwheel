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
    const title = 'How we handle reviews';
    if (!isLocale(locale)) return { title };
    return { title, alternates: buildAlternates(locale, '/reviews-policy') };
}

/**
 * "How we handle reviews" (FE-11) - the EU Omnibus Directive / UCPD Art. 7(6)
 * disclosure. A trader who publishes consumer reviews must state whether and how
 * it checks that they come from people who actually used the product; saying
 * "verified" on a badge without saying anywhere what was verified does not
 * discharge that.
 *
 * NOT handover copy. Unlike its six siblings under this shell (see
 * `public/Legal Pages`, changed only through Denley), this text is
 * platform-authored and describes how the review module actually behaves. It
 * therefore has to be kept true as the module changes - every claim below maps
 * to enforced behaviour:
 *
 *   "only guests who booked"    -> reviews are created solely from a booking-
 *                                  scoped invitation token
 *   "we publish criticism"      -> the rejection grounds are a closed list with
 *                                  no "negative" option, and the private
 *                                  feedback channel is offered ALONGSIDE the
 *                                  public review, never instead of it
 *   "we never pay for reviews"  -> no incentive exists in the invitation flow
 *   "rating from another tour"  -> the LD11 cold-start fallback, which is the
 *                                  one place a displayed rating is not the
 *                                  tour's own and so most needs disclosing
 *
 * Reuses `LegalPageShell` for the prose chrome, including its English-only
 * notice: this is legal-adjacent copy where a machine translation of "we do not
 * suppress negative reviews" is not a claim worth making unreviewed.
 */
export default async function ReviewsPolicyPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();

    return (
        <LegalPageShell locale={locale} title='How we handle reviews'>
            <h2>In short</h2>
            <p>
                Every review on Island Tours comes from someone who booked and
                paid for that exact tour through us. We invite every guest after
                their tour, we publish what they write whether it flatters the
                operator or not, and we never pay for a review or ask for a good
                one. The sections below explain exactly how that works, and the
                one case where the rating you see did not come from the tour you
                are looking at.
            </p>

            <h2>1. Who can leave a review</h2>
            <p>
                Only guests with a completed booking. There is no open review
                form on this site and no way to submit a review without having
                travelled. After your tour we email you a private link that
                belongs to your booking and works once. That link is the only
                way a review can be created, which is why every review carries
                the &quot;Verified booking&quot; label: it is not a badge we
                award, it is a description of the only route that exists.
            </p>
            <p>
                We do not import reviews from other sites, we do not write
                reviews ourselves, and operators cannot post reviews of their own
                tours.
            </p>

            <h2>2. How we invite guests</h2>
            <p>
                Every guest on a completed booking gets the same invitation, sent
                the same way, whatever we think they are going to say. We do not
                look at how a tour went before deciding whether to ask, and we do
                not ask happy guests publicly and unhappy guests privately. Some
                platforms do this. It is called review gating, it is prohibited,
                and it is the single fastest way to make a rating meaningless.
            </p>
            <p>
                We send at most two emails about a review: the invitation, and
                one reminder if you have not responded. Then we stop.
            </p>

            <h2>3. What we publish, and what we do not</h2>
            <p>
                We publish criticism. A one-star review describing a bad day is
                as publishable as a five-star one, and the operator cannot have
                it taken down for being unflattering. If you score a tour poorly
                we may also offer to pass your comments privately to the
                operator so they can put things right, but that is offered in
                addition to your public review, never as a replacement for it,
                and it never changes whether your review is published.
            </p>
            <p>
                A review is removed only on the following grounds, and a record
                of the decision is kept:
            </p>
            <ul>
                <li>
                    It contains abuse, hate speech, threats, or discriminatory
                    language.
                </li>
                <li>
                    It reveals personal data about someone - a guide&apos;s full
                    name, another guest, contact details.
                </li>
                <li>
                    It is spam, an advertisement, or a link to something
                    unrelated.
                </li>
                <li>
                    It is not about the tour it was left on - a review about an
                    airline, a hotel, or the weather at a different destination.
                </li>
                <li>
                    It is illegal, or we are required to remove it by law.
                </li>
            </ul>
            <p>
                &quot;Negative&quot; is not on that list and never will be. If we
                remove a review we tell the guest which ground applied.
            </p>

            <h2>4. We never pay for reviews</h2>
            <p>
                No discount, no credit, no prize draw, no free upgrade - not from
                us and not from operators. Nothing about what you write changes
                what you paid or what you are offered next. Operators cannot buy
                a better rating, and the commission tier an operator chooses
                affects where its tours appear in a list, never the rating shown
                on them or which reviews are displayed.
            </p>

            <h2>5. How the rating is calculated</h2>
            <p>
                The score on a tour is the plain average of every published
                review for that tour, to one decimal place. There is no
                weighting, no decay, and no hand-adjustment. The star chart shows
                the real distribution behind that average, so you can see
                whether a 4.5 is everyone agreeing or two very different
                experiences.
            </p>
            <p>
                Some controls appear only once there is enough behind them.
                Sorting and filtering a set of three reviews tells you nothing,
                so those controls appear as the review count grows. Nothing is
                hidden - every published review is reachable on the page.
            </p>

            <h2>6. When the rating is not the tour&apos;s own</h2>
            <p>
                This is the one case worth reading carefully. A newly listed tour
                has no reviews yet. Rather than show it with no rating at all,
                we may show the rating of the operator who runs it, drawn from
                their other tours - and only when that operator has an
                established record with us.
            </p>
            <p>
                Where that happens we say so in words, on the tour page, next to
                the rating: the tour is marked as new and the sentence names the
                operator the rating belongs to. We never present another
                tour&apos;s reviews as this one&apos;s, the individual reviews
                shown are always that tour&apos;s own, and this borrowed rating
                is never included in the structured data search engines read. As
                soon as the tour has its own reviews, its own rating replaces it.
            </p>

            <h2>7. Responses to reviews</h2>
            <p>
                A published review may carry a response. Responses are labelled
                with who wrote them, and posting one never edits, hides, or
                reorders the review it answers.
            </p>

            <h2>8. Editing, deleting, and reporting</h2>
            <p>
                Your review is yours. Contact us with your booking reference if
                you want it changed or taken down, and we will remove it. We do
                not edit the wording of a published review; we either publish it
                as written or remove it under section 3.
            </p>
            <p>
                If you think a review breaks the rules in section 3, report it to{' '}
                <a href='mailto:reservations@island.tours'>
                    reservations@island.tours
                </a>{' '}
                with a link to the tour. We look at every report and tell you
                what we decided.
            </p>

            <h2>9. Questions</h2>
            <p>
                Email{' '}
                <a href='mailto:reservations@island.tours'>
                    reservations@island.tours
                </a>{' '}
                or message us on WhatsApp, every day 08:00 to 20:00 (local time).
                Island Tours. Built by Islanders.
            </p>
        </LegalPageShell>
    );
}
