import Image from 'next/image';
import { Fragment } from 'react';
import { springPop } from '@/lib/motion';
import { MotionLink } from '../motion-link';
import { Reveal } from '../reveal';

/**
 * Activity Hub "Which trip is right for you?" comparison section (Figma node
 * 48024:11654 desktop / 48627:9249 mobile). One or more comparison tables, each
 * grouping a set of boats/trips under a category (e.g. "Comfort trips") and
 * comparing them attribute-by-attribute.
 *
 * Desktop renders a flush 4-column grid (label column + 3 boats) with continuous
 * vertical dividers and a per-boat price/Book footer row. Mobile renders each
 * table as a rounded card whose header + rows scroll horizontally (the label
 * column stays pinned, the first boat column is highlighted), with a single
 * full-width price/Book footer for the lead boat.
 *
 * Pure + data-driven: the section owns no state. Table content is supplied via
 * `tables` (placeholder content until the per-tour attributes API is wired,
 * mirroring the MOCK convention on the rest of the hub page); UI strings
 * (`title`/`subtitle`/`from`/`book`) come from the dictionary.
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
const ANCHOR_ICON_WHITE = '/icons/hub/compare-anchor-white.svg';
const CHECK_ICON = '/icons/check-green.svg';

/**
 * Per-boat-count grid templates. Static strings so Tailwind's JIT keeps them.
 * Mobile: fixed-width tracks (pinned label + scrollable boats). Desktop: equal
 * columns that fill the container (no scroll).
 */
const GRID_COLS: Record<number, string> = {
    2: 'grid-cols-[150px_repeat(2,200px)] lg:grid-cols-3',
    3: 'grid-cols-[150px_repeat(3,200px)] lg:grid-cols-4',
    4: 'grid-cols-[150px_repeat(4,200px)] lg:grid-cols-5',
};

export function HubCompareSection({
    tables,
    dict,
}: {
    tables: CompareTable[];
    dict: HubCompareDict;
}) {
    return (
        <Reveal className='flex flex-col gap-6 md:gap-12'>
            {/* Header */}
            <header className='flex flex-col gap-1'>
                <h2 className='m-0 font-medium text-[20px] md:text-[32px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                    {dict.title}
                </h2>
                <p className='m-0 max-w-[530px] text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                    {dict.subtitle}
                </p>
            </header>

            {/* Tables */}
            <div className='flex flex-col gap-4 md:gap-8'>
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
    const lead = boats[0];

    // Shared cell box: vertical centering + Figma paddings (mobile 8/16,
    // desktop 15/32). A trailing `border-r` (skipped on the last column) draws
    // the continuous vertical dividers.
    const cell =
        'flex items-center px-4 py-2 lg:px-8 lg:py-[15px] border-it-heading/10';

    return (
        <div
            className='overflow-hidden rounded-[8px]!
         border border-it-heading/10'>
            {/* Category bar */}
            <div className='border-b border-it-heading/10 bg-it-surface px-4 py-4 lg:px-8 lg:py-[22px]'>
                <span className='font-bold text-[16px] md:text-[18px] leading-[1.6] tracking-[-0.012em] uppercase text-it-primary'>
                    {title}
                </span>
            </div>

            {/* Horizontally scrollable comparison grid */}
            <div className='overflow-x-auto'>
                <div className={`grid w-max lg:w-full ${gridCols}`}>
                    {/* Header row: boat names */}
                    <span
                        className={`${cell} border-r border-b sticky left-0 z-10 bg-it-white`}
                        aria-hidden
                    />
                    {boats.map((boat, b) => {
                        const last = b === boats.length - 1;
                        const isLead = b === 0;
                        return (
                            <div
                                key={b}
                                className={`${cell} gap-2.5 border-b ${
                                    last ? '' : 'border-r'
                                } ${
                                    isLead
                                        ? 'max-lg:bg-it-heading max-lg:text-it-white'
                                        : ''
                                }`}>
                                {/* White anchor only on the highlighted lead column (mobile). */}
                                {isLead && (
                                    <Image
                                        src={ANCHOR_ICON_WHITE}
                                        alt=''
                                        width={24}
                                        height={24}
                                        className='size-5 shrink-0 lg:hidden'
                                    />
                                )}
                                <Image
                                    src={ANCHOR_ICON}
                                    alt=''
                                    width={24}
                                    height={24}
                                    className={`size-5 shrink-0 lg:size-6 ${
                                        isLead ? 'hidden lg:block' : ''
                                    }`}
                                />
                                <span className='text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em]'>
                                    {boat.name}
                                </span>
                            </div>
                        );
                    })}

                    {/* Attribute rows */}
                    {rows.map((row, r) => (
                        <Fragment key={r}>
                            <span
                                className={`${cell} border-r sticky left-0 z-10 bg-it-white text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted`}>
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

                    {/* Footer row (desktop): per-boat price + Book */}
                    <span
                        className={`${cell} border-r border-t hidden lg:flex`}
                        aria-hidden
                    />
                    {boats.map((boat, b) => {
                        const last = b === boats.length - 1;
                        return (
                            <div
                                key={b}
                                className={`hidden items-center justify-between gap-4 px-8 py-[22px] border-t border-it-heading/10 lg:flex ${
                                    last ? '' : 'border-r'
                                }`}>
                                <PriceLabel boat={boat} from={dict.from} />
                                <BookButton label={dict.book} href={boat.href} />
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Footer (mobile): single full-width price + Book for the lead boat */}
            {lead && (
                <div className='flex flex-col items-center gap-1.5 border-t border-it-heading/10 px-4 py-2 lg:hidden'>
                    <PriceLabel boat={lead} from={dict.from} />
                    <BookButton label={dict.book} href={lead.href} full />
                </div>
            )}
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
        <span className='flex items-center gap-2 text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em]'>
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
                <span className='font-bold text-it-heading'>
                    {boat.priceDisplay}
                </span>
                {boat.priceUnit ? ` ${boat.priceUnit}` : ''}
            </span>
        </span>
    );
}

/**
 * Orange "Book ->" pill. Full-width on mobile, hugged on desktop. Links to the
 * boat's tour detail page when `href` is supplied (plain button otherwise).
 */
function BookButton({
    label,
    href,
    full,
}: {
    label: string;
    href?: string;
    full?: boolean;
}) {
    const className = `inline-flex shrink-0 cursor-pointer items-center justify-center gap-2.5 rounded-it-full bg-it-primary font-medium text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-white no-underline transition-colors duration-300 hover:bg-it-primary-hover ${
        full ? 'h-[46px] w-full px-10' : 'h-[34px] px-5'
    }`;
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

