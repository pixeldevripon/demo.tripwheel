import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
    SearchResultsHeader,
    type SearchResultsHeaderDict,
} from './search-results-header';

/**
 * The search head (mck-12). Its whole job is to say the right sentence for the
 * state, so the tests are the sentences.
 */

const DICT: SearchResultsHeaderDict = {
    resultsFor: '{count} results for “{query}”',
    resultFor: '{count} result for “{query}”',
    noResults: 'No results for “{query}”',
    noResultsHint: 'Check your spelling or try a more general term.',
    nothingOnDate: 'Nothing matches this search on {date}.',
    everyMatchIsland:
        'Every match on this island. Change the date or open Filters to narrow it down.',
    everyMatch: 'Every match. Change the date or open Filters to narrow it down.',
};

const base = {
    dict: DICT,
    query: 'boat',
    destinationName: 'Curaçao',
    dateLabel: null,
};

const heading = () => screen.getByRole('heading', { level: 1 }).textContent;

describe('SearchResultsHeader — the heading states the outcome', () => {
    it('counts the results', () => {
        render(<SearchResultsHeader {...base} total={12} />);
        expect(heading()).toBe('12 results for “boat”');
    });

    it('uses the singular for exactly one', () => {
        render(<SearchResultsHeader {...base} total={1} />);
        expect(heading()).toBe('1 result for “boat”');
    });

    it('says so on zero', () => {
        render(<SearchResultsHeader {...base} total={0} />);
        expect(heading()).toBe('No results for “boat”');
    });

    it('is the page h1 — never a lower level', () => {
        render(<SearchResultsHeader {...base} total={12} />);
        expect(screen.getAllByRole('heading')).toHaveLength(1);
    });
});

describe('SearchResultsHeader — the island is the pill, not the heading', () => {
    it('names the island beside the heading, not inside it', () => {
        // The island used to be interpolated into the sentence AND shown as a
        // chip, which said it twice.
        render(<SearchResultsHeader {...base} total={12} />);
        expect(screen.getByText('Curaçao')).toBeInTheDocument();
        expect(heading()).not.toContain('Curaçao');
    });

    it('renders no pill for an unscoped search', () => {
        render(
            <SearchResultsHeader {...base} destinationName={null} total={12} />,
        );
        expect(screen.queryByText('Curaçao')).not.toBeInTheDocument();
    });
});

describe('SearchResultsHeader — the sub-line names the constraint', () => {
    it('blames the date on zero when there is one', () => {
        render(<SearchResultsHeader {...base} total={0} dateLabel='6 Aug' />);
        expect(
            screen.getByText('Nothing matches this search on 6 Aug.'),
        ).toBeInTheDocument();
    });

    it('falls back to the spelling hint on zero with no date', () => {
        render(<SearchResultsHeader {...base} total={0} />);
        expect(screen.getByText(DICT.noResultsHint)).toBeInTheDocument();
    });

    it('tells a full page how to narrow, and mentions the island', () => {
        render(<SearchResultsHeader {...base} total={12} />);
        expect(screen.getByText(DICT.everyMatchIsland)).toBeInTheDocument();
    });

    it('drops "on this island" when the search is unscoped', () => {
        render(
            <SearchResultsHeader {...base} destinationName={null} total={12} />,
        );
        expect(screen.getByText(DICT.everyMatch)).toBeInTheDocument();
    });
});
