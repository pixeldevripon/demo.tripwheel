import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ToursBreadcrumb } from './tours-breadcrumb';

/**
 * The shared breadcrumb row.
 *
 * The `anchor` crumb is the interesting part: it is legitimate on the tour page
 * (the hub/category the tour was reached through, master §9) and was WRONG on
 * the collection page, where it pointed at `#collections` - an anchor on the
 * destination page dressed up as a level of the hierarchy (Pastel #47).
 */

const DICT = { home: 'Home', current: 'Best Things to Do in Curaçao' };

const base = {
    locale: 'en' as const,
    destinationName: 'Curaçao',
    destinationSlug: 'curacao',
    dict: DICT,
};

/** Visible crumb text, in order, separators stripped. */
function trail() {
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    return Array.from(nav.querySelectorAll('a, [aria-current="page"]')).map(
        (el) => el.textContent?.trim(),
    );
}

describe('ToursBreadcrumb', () => {
    it('renders Home › Destination › current when no anchor is given', () => {
        render(<ToursBreadcrumb {...base} />);
        expect(trail()).toEqual(['Home', 'Curaçao', 'Best Things to Do in Curaçao']);
    });

    it('omits the middle crumb for anchor={null} as well as undefined', () => {
        render(<ToursBreadcrumb {...base} anchor={null} />);
        expect(trail()).toHaveLength(3);
    });

    it('inserts the anchor between the destination and the current page', () => {
        // Still supported, and still correct for the tour page.
        render(
            <ToursBreadcrumb
                {...base}
                anchor={{ label: 'Klein Curaçao', href: '/curacao/klein-curacao' }}
            />,
        );
        expect(trail()).toEqual([
            'Home',
            'Curaçao',
            'Klein Curaçao',
            'Best Things to Do in Curaçao',
        ]);
    });

    it('links Home and the destination, and localizes both', () => {
        render(<ToursBreadcrumb {...base} locale='nl' />);
        expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute(
            'href',
            '/nl',
        );
        expect(screen.getByRole('link', { name: 'Curaçao' })).toHaveAttribute(
            'href',
            '/nl/curacao',
        );
    });

    it('leaves the LAST crumb as plain text, never a link', () => {
        render(<ToursBreadcrumb {...base} />);
        const current = screen.getByText(DICT.current);
        expect(current.tagName).not.toBe('A');
        expect(current).toHaveAttribute('aria-current', 'page');
    });

    it('exposes the row as a labelled breadcrumb landmark', () => {
        render(<ToursBreadcrumb {...base} />);
        expect(
            screen.getByRole('navigation', { name: 'Breadcrumb' }),
        ).toBeInTheDocument();
    });

    it('hides the separators from assistive tech', () => {
        render(<ToursBreadcrumb {...base} />);
        const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
        const seps = nav.querySelectorAll('[aria-hidden="true"]');
        // One after Home, one before the current crumb.
        expect(seps.length).toBeGreaterThanOrEqual(2);
        for (const s of seps) expect(s.textContent).toBe('›');
    });
});
