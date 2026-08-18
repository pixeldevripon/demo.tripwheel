import { MapPin } from 'lucide-react';

export type SearchResultsHeaderDict = {
    /** Carries `{count}` and `{query}`. */
    resultsFor: string;
    /** Singular of the above. */
    resultFor: string;
    /** Carries `{query}`. */
    noResults: string;
    /** Zero state, no date in play. */
    noResultsHint: string;
    /** Zero state with a date filter - carries `{date}`. */
    nothingOnDate: string;
    /** Non-zero state, island-scoped search. */
    everyMatchIsland: string;
    /** Non-zero state, unscoped search. */
    everyMatch: string;
};

/**
 * The search page's own head: the island scope pill, the `h1` that states the
 * outcome, and one line telling the traveller what to do next (mck-12).
 *
 * THE COUNT IS THE HEADING. "Search" as a static title says nothing a traveller
 * who just searched does not know; "12 results for “boat”" is the answer to what
 * they asked, and on zero it is the whole news. It is dynamic, so it lives here
 * in the streamed section rather than in the prerendered shell.
 *
 * THE ISLAND IS THE PILL, NOT THE HEADING. Search is destination-scoped always
 * (APPLICATION-FEATURES §D.12), so the island is the standing context of the
 * page rather than part of the result sentence - naming it in both places says
 * it twice, which is what it used to do.
 */
export function SearchResultsHeader({
    dict,
    query,
    total,
    destinationName,
    /** Formatted date currently filtering the search (e.g. "6 Aug"); null if none. */
    dateLabel,
}: {
    dict: SearchResultsHeaderDict;
    query: string;
    total: number;
    destinationName?: string | null;
    dateLabel: string | null;
}) {
    const headline =
        total === 0
            ? dict.noResults.replace('{query}', query)
            : (total === 1 ? dict.resultFor : dict.resultsFor)
                  .replace('{count}', String(total))
                  .replace('{query}', query);

    // On zero, name the constraint we know about: a date is the single most
    // common reason a real term finds nothing, and saying so turns a dead end
    // into an instruction.
    const subline =
        total === 0
            ? dateLabel
                ? dict.nothingOnDate.replace('{date}', dateLabel)
                : dict.noResultsHint
            : destinationName
              ? dict.everyMatchIsland
              : dict.everyMatch;

    return (
        <div className='it-container flex flex-col items-start gap-2.5'>
            {destinationName && (
                <span className='inline-flex items-center gap-1.5 rounded-it-full bg-it-primary-subtle px-3 py-1.5 text-[12.5px] font-medium leading-none text-it-primary-hover tracking-[-0.012em]'>
                    <MapPin
                        className='size-3.5 shrink-0'
                        strokeWidth={2}
                        aria-hidden='true'
                    />
                    {destinationName}
                </span>
            )}
            <h1 className='m-0 text-[clamp(28px,4vw,40px)] leading-[1.15] tracking-[-0.012em] text-it-heading font-medium'>
                {headline}
            </h1>
            <p className='m-0 text-[15px] leading-[1.6] text-it-text-muted md:text-[16px] tracking-[-0.012em]'>
                {subline}
            </p>
        </div>
    );
}
