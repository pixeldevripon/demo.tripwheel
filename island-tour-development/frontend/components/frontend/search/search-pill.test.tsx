import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SearchPill, type SearchPillDict } from './search-pill';

/**
 * The one-pill search bar (Pastel #51).
 *
 * The tests worth having here are about the MOBILE HAND-OFF, because that is
 * where it went wrong twice: a single transparent button over the whole bar
 * sent "When?" to a focused text field with the keyboard up, and the desktop
 * path must keep behaving natively no matter what the mobile path does.
 */

const DICT: SearchPillDict = {
    searchPlaceholder: 'What do you want to do?',
    searchPlaceholderShort: 'What?',
    selectDate: 'Select date',
    selectDateShort: 'When?',
    clearDate: 'Clear date',
    searchLabel: 'Search',
};

const base = {
    dict: DICT,
    query: '',
    onQueryChange: vi.fn(),
    onSubmit: vi.fn(e => e.preventDefault()),
};

describe('SearchPill — the mobile hand-off', () => {
    it('sends the QUERY half to the layer as "query"', async () => {
        const user = userEvent.setup();
        const onOpenLayer = vi.fn();
        render(<SearchPill {...base} compact onOpenLayer={onOpenLayer} />);

        await user.click(screen.getByRole('searchbox'));
        expect(onOpenLayer).toHaveBeenCalledWith('query');
    });

    it('sends the DATE half to the layer as "date"', async () => {
        // The bug: one button over the whole bar opened the layer on the text
        // field, throwing away the fact that the visitor asked for a date.
        const user = userEvent.setup();
        const onOpenLayer = vi.fn();
        render(<SearchPill {...base} compact onOpenLayer={onOpenLayer} />);

        await user.click(screen.getByRole('button', { name: 'Select date' }));
        expect(onOpenLayer).toHaveBeenCalledWith('date');
    });

    it('makes the field read-only while the layer owns the typing', () => {
        // Not `disabled`: the field stays focusable and readable by assistive
        // tech, but no keyboard opens against a panel about to be replaced.
        render(<SearchPill {...base} compact onOpenLayer={vi.fn()} />);
        expect(screen.getByRole('searchbox')).toHaveAttribute('readonly');
    });

    it('does NOT hand off on desktop, even when the caller offers a layer', async () => {
        // `compact` is how the caller reports the viewport; without it the pill
        // must behave natively so the desktop dropdown and popover still work.
        const user = userEvent.setup();
        const onOpenLayer = vi.fn();
        render(<SearchPill {...base} onOpenLayer={onOpenLayer} />);

        await user.click(screen.getByRole('searchbox'));
        expect(onOpenLayer).not.toHaveBeenCalled();
        expect(screen.getByRole('searchbox')).not.toHaveAttribute('readonly');
    });
});

describe('SearchPill — the two fields', () => {
    it('keeps the full question as the accessible name when the label shortens', () => {
        render(<SearchPill {...base} compact />);
        expect(
            screen.getByRole('searchbox', { name: 'What do you want to do?' }),
        ).toHaveAttribute('placeholder', 'What?');
    });

    it('takes a separate aria-label when the placeholder is blanked', () => {
        // The navbar blanks it so its rotating overlay can show through; a
        // nameless search field is not an option.
        render(
            <SearchPill
                {...base}
                dict={{ ...DICT, searchPlaceholder: '', ariaLabel: 'Search for' }}
            />,
        );
        expect(
            screen.getByRole('searchbox', { name: 'Search for' }),
        ).toBeInTheDocument();
    });

    it('drops the date half entirely when the surface has no date', () => {
        // The navbar search never had one, and the homepage searches islands.
        render(<SearchPill {...base} showDate={false} />);
        expect(
            screen.queryByRole('button', { name: 'Select date' }),
        ).not.toBeInTheDocument();
    });

    it('offers Clear only once a date is set, and never as the same control', () => {
        const { rerender } = render(<SearchPill {...base} />);
        expect(
            screen.queryByRole('button', { name: 'Clear date' }),
        ).not.toBeInTheDocument();

        rerender(<SearchPill {...base} date={new Date('2026-08-21')} />);
        expect(
            screen.getByRole('button', { name: 'Clear date' }),
        ).toBeInTheDocument();
    });

    it('shows the whole date rather than truncating it', () => {
        // A flat 100px budget cut "21 Aug" to "21 …" - a date field that could
        // not show the date it held.
        render(<SearchPill {...base} compact date={new Date('2026-08-21')} />);
        expect(screen.getByText('21 Aug')).toBeInTheDocument();
    });
});
