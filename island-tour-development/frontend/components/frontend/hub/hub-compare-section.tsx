import { springPop } from '@/lib/motion';
import Image from 'next/image';
import { Fragment } from 'react';
import { MotionLink } from '../motion-link';
import { Reveal } from '../reveal';
import { ScrollHintRow } from '../scroll-hint';

/**
 * Activity Hub "Which trip is right for you?" comparison section (Figma node
 * 48024:11654 desktop / 48627:9249 mobile; mobile behaviour re-specified by
 * mck-16 §4). One or more comparison tables, each grouping a set of
 * boats/trips under a category (e.g. "Comfort trips") and comparing them
 * attribute-by-attribute.
 *
 * Desktop renders a flush 4-column grid (label column + 3 boats) with
 * continuous vertical dividers and a per-boat price/Book footer row. Mobile
 * (mck-16 §4) shows TWO whole trips at once against the pinned label column -
 * container-query tracks size the trip columns so the table always comes to
 * rest on whole trips with a 28px slice of the next one showing - snaps by
 * whole trips, and announces itself via the shared ScrollHintRow: a position
 * indicator under every table plus the sitewide one-shot nudge. Price and
 * Book sit at the foot of each trip's OWN column and travel with it (§4.5:
 * the button always books the boat directly above it - never a shared bar
 * that can fall out of step), and no trip is marked as chosen (§4.3: no
 * highlight on the lead column).
 *
 * Data-driven: the section owns no state of its own. Table content arrives
 * fully backend-fed via the hub render aggregate (`/hubs/render/:slug` →
 * `comparisonGroups`); UI strings (`title`/`subtitle`/`from`/`book`) come
 * from the dictionary.
 */

/** A single comparison value: bullet-joined parts, optional leading green check. */
export type CompareCell = {
    /** Bullet-separated fragments. Empty/omitted renders an empty cell. */
    parts?: string[];
    /** Show a leading green check (e.g. an included perk). */
    check?: boolean;
};

export type CompareBoat = {
    /** Boat/trip name shown in the column header. */
    name: string;
    /** Localized "from" price incl. currency symbol, e.g. "$140" / "2.200 €". */
    priceDisplay: string;
    /** Localized price-unit suffix (e.g. "/per boat" or "/per"); appended after the price. */
    priceUnit?: string;
    /** Show a leading green check before the price (e.g. lowest price). */
    priceCheck?: boolean;
    /** Flat tour detail URL (locale-prefixed); the Book CTA links to it. */
    href?: string;
};

export type CompareRow = {
    /** Row label shown in the pinned left column (e.g. "What stands out"). */
    label: string;
    /** One cell per boat, index-aligned to `boats`. */
    cells: CompareCell[];
};

export type CompareTable = {
    /** Category heading shown in the table's top bar (e.g. "Comfort trips"). */
    title: string;
    /** Columns being compared (the design uses 3). */
    boats: CompareBoat[];
    /** Attribute rows. */
    rows: CompareRow[];
};

export type HubCompareDict = {
    title: string;
    subtitle: string;
    /** "from" price prefix. */
    from: string;
    /** "Book" CTA label (rendered as "Book ->"). */
    book: string;
};

const ANCHOR_ICON = '/icons/hub/compare-anchor.svg';
const CHECK_ICON = '/icons/check-green.svg';

/**
 * Per-boat-count grid templates. Static strings so Tailwind's JIT keeps them.
 *
 * Mobile (mck-16 §4.2 + §4.4 + §4.6): a comparison needs two trips against
 * the row labels at once, resting with a slice of the next trip showing. The
 * card is a container (`@container`), so each trip track is
 * `(100cqw - LABEL - SLICE) / 2`: pinned 100px label + two whole trips + a
 * constant 28px slice of the third, at every phone width. A 2-boat table has
 * no third trip to peek, so its tracks split the full remainder and the table
 * doesn't scroll at all. Desktop: equal columns that fill the container.
 */
const GRID_COLS: Record<number, string> = {
    2: 'grid-cols-[100px_repeat(2,calc((100cqw_-_100px)/2))] lg:grid-cols-3',
    3: 'grid-cols-[100px_repeat(3,calc((100cqw_-_128px)/2))] lg:grid-cols-4',
    4: 'grid-cols-[100px_repeat(4,calc((100cqw_-_128px)/2))] lg:grid-cols-5',
};

/** Width of the pinned label track - the snap edge trips come to rest on
 *  (`scroll-pl` below must match the first track in GRID_COLS). */
const LABEL_SNAP_PAD = 'scroll-pl-[100px]';

export function HubCompareSection({
    tables,
    dict,
}: {
    tables: CompareTable[];
    dict: HubCompareDict;
}) {
    return (
        <Reveal className='flex flex-col gap-[22px]'>
            {/* Header */}
            <header className='flex flex-col gap-1'>
                <h2 className='m-0 font-it-display text-[clamp(22px,2.8vw,30px)] font-bold leading-[1.2] tracking-[-0.015em] text-it-ink'>
                    {dict.title}
                </h2>
                <p className='m-0 max-w-[530px] text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                    {dict.subtitle}
                </p>
            </header>

            {/* Tables */}
            <div className='flex flex-col gap-6'>
                {tables.map((table, i) => (
                    <Reveal key={i} delay={0.02} listItem>
                        <CompareTableCard table={table} dict={dict} />
                    </Reveal>
                ))}
            </div>
        </Reveal>
    );
}

function CompareTableCard({
    table,
    dict,
}: {
    table: CompareTable;
    dict: HubCompareDict;
}) {
    const { title, boats, rows } = table;
    const gridCols = GRID_COLS[boats.length] ?? GRID_COLS[3];

    // Shared cell box: vertical centering + divider hairlines; a trailing
    // `border-r` (skipped on the last column) draws the continuous vertical
    // dividers. Desktop keeps the mockup's 16px side padding; mobile drops to
    // 12px - with two trips sharing the width (mck-16 §4.2), padding is where
    // the room comes from.
    const cell =
        'flex items-center px-3 lg:px-4 py-[11px] text-[13.5px] leading-[1.6] border-it-divider';

    return (
        <div className='@container overflow-hidden rounded-it-lg border border-it-divider bg-it-white shadow-it-sm'>
            {/* Category bar */}
            <div className='border-b border-it-peach-border bg-it-primary-subtle px-4 py-2.5 lg:px-4'>
                <span className='text-[11.5px] font-bold uppercase tracking-[0.12em] text-it-primary-hover'>
                    {title}
                </span>
            </div>

            {/* Comparison grid - scrolls sideways on mobile, snapping to whole
                trips, with the position indicator + one-shot nudge from the
                shared ScrollHintRow (mck-16 §4.4/4.6/4.8). Desktop fits and
                the indicator self-hides. */}
            <ScrollHintRow dots className={`it-scroll-x ${LABEL_SNAP_PAD}`}>
                <div className={`grid w-max lg:w-full ${gridCols}`}>
                    {/* Header row: boat names */}
                    <span
                        className={`${cell} border-r border-b sticky left-0 z-10 bg-it-white`}
                        aria-hidden
                    />
                    {boats.map((boat, b) => {
                        const last = b === boats.length - 1;
                        return (
                            /* `snap-start` + `data-scroll-stop`: each trip
                               column is a rest position for the swipe and a
                               dot on the indicator (columns share an x-edge,
                               so marking the header marks the column). Every
                               name is set the same way - no lead highlight
                               (mck-16 §4.3). */
                            <div
                                key={b}
                                data-scroll-stop
                                className={`${cell} snap-start gap-2.5 border-b ${
                                    last ? '' : 'border-r'
                                }`}>
                                {/* Icon is desktop-only: a two-up mobile
                                    column has no room for it (mck-16 §4.2). */}
                                <Image
                                    src={ANCHOR_ICON}
                                    alt=''
                                    width={24}
                                    height={24}
                                    className='hidden size-6 shrink-0 lg:block'
                                />
                                <span className='text-[13.5px] font-bold leading-[1.5]'>
                                    {boat.name}
                                </span>
                            </div>
                        );
                    })}

                    {/* Attribute rows */}
                    {rows.map((row, r) => (
                        <Fragment key={r}>
                            <span
                                className={`${cell} border-r sticky left-0 z-10 bg-it-white font-bold text-it-ink`}>
                                {row.label}
                            </span>
                            {row.cells.map((value, b) => {
                                const last = b === boats.length - 1;
                                return (
                                    <div
                                        key={b}
                                        className={`${cell} ${
                                            last ? '' : 'border-r'
                                        }`}>
                                        <CompareValue value={value} />
                                    </div>
                                );
                            })}
                        </Fragment>
                    ))}

                    {/* Footer row: price + Book at the foot of each trip's
                        OWN column, travelling with it, so the button always
                        books the boat directly above it (mck-16 §4.5 - never
                        a shared bar that can fall out of step). Mobile stacks
                        the pair; desktop keeps them side by side. */}
                    <span
                        className={`${cell} border-r border-t sticky left-0 z-10 bg-it-white`}
                        aria-hidden
                    />
                    {boats.map((boat, b) => {
                        const last = b === boats.length - 1;
                        return (
                            <div
                                key={b}
                                className={`flex flex-col items-stretch gap-1.5 border-t border-it-divider px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between lg:gap-3 lg:px-4 lg:py-3.5 ${
                                    last ? '' : 'border-r'
                                }`}>
                                <PriceLabel boat={boat} from={dict.from} />
                                <BookButton
                                    label={dict.book}
                                    href={boat.href}
                                />
                            </div>
                        );
                    })}
                </div>
            </ScrollHintRow>
        </div>
    );
}

/** A comparison value: optional leading check + bullet-joined fragments. */
function CompareValue({ value }: { value: CompareCell }) {
    const parts = value.parts ?? [];
    if (parts.length === 0 && !value.check) return null;

    return (
        <span className='flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
            {value.check && (
                <Image
                    src={CHECK_ICON}
                    alt=''
                    width={20}
                    height={20}
                    className='size-[18px] shrink-0'
                />
            )}
            {parts.map((part, i) => (
                <Fragment key={i}>
                    {i > 0 && (
                        <span className='size-1 shrink-0 rounded-full bg-it-heading/20' />
                    )}
                    <span>{part}</span>
                </Fragment>
            ))}
        </span>
    );
}

/** "from $150" - "from" muted, price bold. */
function PriceLabel({ boat, from }: { boat: CompareBoat; from: string }) {
    return (
        <span className='flex items-center gap-2 text-[12.5px] leading-[1.6] tabular-nums'>
            {boat.priceCheck && (
                <Image
                    src={CHECK_ICON}
                    alt=''
                    width={20}
                    height={20}
                    className='size-[18px] shrink-0'
                />
            )}
            <span className='text-it-text-muted'>
                {from}{' '}
                <span className='text-[15px] font-bold tracking-[-0.01em] text-it-ink'>
                    {boat.priceDisplay}
                </span>
                {boat.priceUnit ? ` ${boat.priceUnit}` : ''}
            </span>
        </span>
    );
}

/**
 * Orange "Book ->" pill. Fills its column on mobile (the footer cell
 * stretches it), hugs its label on desktop. Links to the boat's tour detail
 * page when `href` is supplied (plain button otherwise).
 */
function BookButton({ label, href }: { label: string; href?: string }) {
    const className =
        'inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-it-full bg-it-primary text-[12.5px] font-bold leading-none text-it-white no-underline transition-colors duration-(--it-duration-xs) hover:bg-it-primary-hover h-[33px] px-2 lg:px-[18px]';
    if (href) {
        return (
            <MotionLink
                href={href}
                whileTap={{ scale: 0.97 }}
                transition={springPop}
                className={className}>
                {label} {'→'}
            </MotionLink>
        );
    }
    return (
        <button type='button' className={className}>
            {label} {'→'}
        </button>
    );
}

