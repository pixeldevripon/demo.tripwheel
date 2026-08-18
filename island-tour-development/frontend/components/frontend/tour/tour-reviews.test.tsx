import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { TourReviews, type TourReview, type TourReviewsDict } from './tour-reviews';

/**
 * The guest-review preview strip (Pastel #55).
 *
 * The client's complaint was that two reviews under a bare title "read like two
 * quotes we picked ourselves". So the tests are about what turns them back into
 * a sample: the aggregate beside the title, the way out to the rest, and one
 * reviewer line that says who, where and when.
 */

const DICT: TourReviewsDict = {
    title: 'What our guests say',
    subtitle: 'Verified guest reviews from real travelers',
    seeAll: 'See all reviews',
    verified: 'Verified',
    readMore: 'Read more',
    readLess: 'Read less',
};

const review = (over: Partial<TourReview> = {}): TourReview => ({
    id: 'r1',
    name: 'Maria S.',
    country: 'Netherlands',
    date: 'July 2026',
    rating: 5,
    text: 'Wonderful day out.',
    verified: true,
    ...over,
});

const setup = (reviews: TourReview[], rating: number | null = 4.3, count = 4) =>
    render(
        <TourReviews
            reviews={reviews}
            rating={rating}
            reviewCount={count}
            dict={DICT}
        />,
    );

describe('TourReviews — the header row', () => {
    it('puts the rating and the count beside the title', () => {
        setup([review()]);
        expect(
            screen.getByRole('heading', { name: 'What our guests say' }),
        ).toBeInTheDocument();
        expect(screen.getByText('4.3 (4)')).toBeInTheDocument();
    });

    it('links to the full section ON THIS PAGE, not another route', () => {
        setup([review()]);
        expect(
            screen.getByRole('link', { name: /See all reviews/ }),
        ).toHaveAttribute('href', '#tour-reviews');
    });

    it('hides the score when there is no aggregate to show', () => {
        // A tour borrowing its operator's rating can have none of its own.
        // The per-card score stays - that one is the review's, not the tour's.
        setup([review()], null, 0);
        expect(screen.queryByText('4.3 (4)')).not.toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: /See all reviews/ }),
        ).toBeInTheDocument();
    });
});

describe('TourReviews — the reviewer line', () => {
    // Figma 47936:3499 splits what used to be one dot-joined string across two
    // rows - name + country at full ink, then date + Verified muted under it.
    // The rule the old single-line tests were really protecting still holds:
    // a separator is drawn only when there is something on BOTH sides of it.
    const card = () => screen.getByRole('article');
    /** One dot per JOIN - so the count IS the separator rule, stated as a number. */
    const dots = () => card().querySelectorAll('[aria-hidden="true"]').length;

    it('names who reviewed, where they are from, and when', () => {
        setup([review()]);
        expect(card()).toHaveTextContent('Maria S.');
        expect(card()).toHaveTextContent('Netherlands');
        expect(screen.getByText('July 2026')).toBeInTheDocument();
        expect(screen.getByText('Verified')).toBeInTheDocument();
        expect(dots()).toBe(2); // name·country, date·verified
    });

    it('drops the country cleanly, with no stray separator', () => {
        setup([review({ country: '' })]);
        expect(card()).not.toHaveTextContent('Netherlands');
        expect(dots()).toBe(1); // only date·verified is left to join
    });

    it('drops Verified when the review is not verified', () => {
        setup([review({ verified: false })]);
        expect(screen.queryByText('Verified')).not.toBeInTheDocument();
        expect(screen.getByText('July 2026')).toBeInTheDocument();
        expect(dots()).toBe(1); // only name·country is left to join
    });

    it('shows the score as five stars, filled to the rating', () => {
        setup([review({ rating: 3 })]);
        expect(screen.getByRole('img', { name: '3 / 5' })).toBeInTheDocument();
    });
});

describe('TourReviews — Read more', () => {
    const LONG =
        'The boat left on time. The crew were friendly and the snorkelling was excellent. ' +
        'We saw turtles near the wreck. Lunch on the beach was the best part of the day.';

    it('cuts the excerpt at a sentence end, not mid-thought', async () => {
        setup([review({ text: LONG })]);
        const card = screen.getByRole('article');
        expect(card.textContent).toContain(
            'The boat left on time. The crew were friendly and the snorkelling was excellent....',
        );
        expect(card.textContent).not.toContain('turtles');
    });

    it('expands IN PLACE - no modal, no navigation', async () => {
        const user = userEvent.setup();
        setup([review({ text: LONG })]);
        const card = screen.getByRole('article');

        await user.click(within(card).getByRole('button', { name: 'Read more' }));
        expect(card.textContent).toContain('turtles');
        expect(
            within(card).getByRole('button', { name: 'Read less' }),
        ).toBeInTheDocument();
    });

    it('offers no toggle when the review is already short', () => {
        setup([review({ text: 'Wonderful day out.' })]);
        expect(
            screen.queryByRole('button', { name: 'Read more' }),
        ).not.toBeInTheDocument();
    });
});
