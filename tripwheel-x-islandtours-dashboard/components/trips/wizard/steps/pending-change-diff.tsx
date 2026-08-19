'use client';

import { useImages, useTripTranslationByLocale } from '@/hooks/trips/use-trips';
import { cn } from '@/lib/utils';
import {
    INLINE_DIFF_TOKEN_CAP,
    InlineDiff,
    InlineListDiff,
} from './inline-diff';
import { relativeTime } from '@/components/common/inbox-copy';
import { PENDING_AREA_LABELS } from '@/lib/trips/pending-change-labels';
import type {
    StagedListKind,
    StagedTripImage,
    StagedTripListItem,
    TripListItem,
    TripPendingChange,
} from '@/types/trip';

/** Human labels for the gated TourTranslation fields - raw camelCase keys in
 *  a review panel read as debug output, not a proposal (UX round 2). */
export const TRANSLATION_FIELD_LABELS: Record<string, string> = {
    // NOT plain "Title": the tour title (the row above it in the diff) and
    // this per-locale page heading rendered under the same word and read as
    // a duplicate (client round 5).
    title: 'Display title (page heading)',
    overview: 'Overview',
    description: 'Full description',
    shortDescription: 'Short description',
    whatToBring: 'What to bring',
    knowBeforeYouGo: 'Know before you go',
    notSuitableFor: 'Not suitable for',
    whatToExpectIntro: 'What to expect intro',
    categoryDisplay: 'Category display name',
    localTipTitle: 'Local tip title',
    localTipBody: 'Local tip',
    operatorNote: 'Note to travellers',
    meetingPointText: 'Meeting point directions',
    metaTitle: 'Meta title (SEO)',
    metaDescription: 'Meta description (SEO)',
};

const LOCALE_LABELS: Record<string, string> = {
    en: 'English',
    nl: 'Dutch',
    de: 'German',
    fr: 'French',
    es: 'Spanish',
    pt: 'Portuguese',
    zh: 'Chinese',
};

/** Mirrors the backend's stash-time comparison: '' and undefined read as
 *  null, arrays compare element-wise. */
/** Human names for the operator-conditions gate flavors (Pastel #80). */
const CONDITIONS_KIND_LABELS: Record<string, string> = {
    DOCUMENT: 'Operator conditions document',
    ACKNOWLEDGMENT: 'Participation confirm-list',
};
function conditionsKindLabel(kind: string | null | undefined): string {
    return kind ? (CONDITIONS_KIND_LABELS[kind] ?? kind) : 'None';
}

/** TipTap HTML -> readable text for the diff (block tags become newlines). */
function stripHtml(html: string): string {
    return html
        .replace(/<\/(p|h[1-6]|li|blockquote|tr)>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/** The locales whose document text differs between staged and live. */
function conditionsDocumentLocales(
    staged: Record<string, string> | null | undefined,
    live: Record<string, string> | null | undefined
): string[] {
    const locales = new Set([
        ...Object.keys(staged ?? {}),
        ...Object.keys(live ?? {}),
    ]);
    return [...locales].filter(
        l => stripHtml(staged?.[l] ?? '') !== stripHtml(live?.[l] ?? '')
    );
}

/** Every locale either side of the confirm-list carries, EN first - the
 *  per-locale DiffRows self-filter the untouched ones. */
function conditionsFactsLocales(
    staged: Record<string, string[]> | null | undefined,
    live: Record<string, string[]> | null | undefined
): string[] {
    const locales = new Set([
        'en',
        ...Object.keys(staged ?? {}),
        ...Object.keys(live ?? {}),
    ]);
    return [...locales].sort((a, b) =>
        a === 'en' ? -1 : b === 'en' ? 1 : a.localeCompare(b)
    );
}

/** Top-level blocks of a sanitized TipTap document (h1-h6/p/ul/ol/...).
 *  Client-only component, so DOMParser is available; a tagless string
 *  degrades to one block. */
function splitBlocks(html: string): string[] {
    if (!html || !stripHtml(html)) return [];
    if (typeof window === 'undefined') return [html];
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const blocks = [...doc.body.children].map(el => el.outerHTML);
    return blocks.length > 0 ? blocks : [html];
}

type BlockOp = { type: 'same' | 'del' | 'add'; html: string };

/** Block-level LCS keyed on TEXT (markup-only churn reads as unchanged, and
 *  the kept markup is the proposed side's). Documents are dozens of blocks
 *  at most, so the O(n*m) table is free. */
function diffBlocks(current: string, proposed: string): BlockOp[] {
    const a = splitBlocks(current);
    const b = splitBlocks(proposed);
    const aKey = a.map(stripHtml);
    const bKey = b.map(stripHtml);
    const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
        new Array<number>(b.length + 1).fill(0)
    );
    for (let i = a.length - 1; i >= 0; i--) {
        for (let j = b.length - 1; j >= 0; j--) {
            dp[i][j] =
                aKey[i] === bKey[j]
                    ? dp[i + 1][j + 1] + 1
                    : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
    }
    const ops: BlockOp[] = [];
    let i = 0;
    let j = 0;
    while (i < a.length && j < b.length) {
        if (aKey[i] === bKey[j]) {
            ops.push({ type: 'same', html: b[j] });
            i++;
            j++;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
            ops.push({ type: 'del', html: a[i] });
            i++;
        } else {
            ops.push({ type: 'add', html: b[j] });
            j++;
        }
    }
    while (i < a.length) ops.push({ type: 'del', html: a[i++] });
    while (j < b.length) ops.push({ type: 'add', html: b[j++] });
    return ops;
}

/** Formatted current/proposed panels for the conditions document. The HTML
 *  reaching this is sanitize-html output (the backend pages pipeline is its
 *  single write gate), the same trust the Translation Console's EN preview
 *  already extends. */
function DocumentDiffBlock({
    locale,
    current,
    proposed,
    showCurrent,
    editedAt,
}: {
    locale: string;
    current: string;
    proposed: string;
    showCurrent: boolean;
    editedAt?: string;
}) {
    // Reviewer (both sides known): ONE merged document where the edit is
    // visible in place - removed blocks struck on red, added blocks on
    // green, untouched blocks plain (same colour vocabulary as the word
    // and list diffs). A removed paragraph immediately followed by an added
    // one is a REWORDING - those render as a single word-level inline diff,
    // so the exact changed words carry the marks.
    // Operator (no live values): the proposed text alone.
    const ops = showCurrent ? diffBlocks(current, proposed) : [];
    const rendered: React.ReactNode[] = [];
    for (let idx = 0; idx < ops.length; idx++) {
        const op = ops[idx];
        const next = ops[idx + 1];
        if (
            op.type === 'del' &&
            next?.type === 'add' &&
            op.html.startsWith('<p') &&
            next.html.startsWith('<p') &&
            tokenCount(stripHtml(op.html)) <= INLINE_DIFF_TOKEN_CAP &&
            tokenCount(stripHtml(next.html)) <= INLINE_DIFF_TOKEN_CAP
        ) {
            rendered.push(
                <InlineDiff
                    key={idx}
                    current={stripHtml(op.html)}
                    proposed={stripHtml(next.html)}
                />
            );
            idx++;
            continue;
        }
        rendered.push(
            <div
                key={idx}
                className={cn(
                    'rounded-sm',
                    op.type === 'del' &&
                        'bg-danger-subtle/70 px-1.5 line-through decoration-danger-fg/60 [&_*]:!text-danger-fg',
                    op.type === 'add' &&
                        'bg-success-subtle/70 px-1.5 [&_*]:!text-success-fg'
                )}
                dangerouslySetInnerHTML={{ __html: op.html }}
            />
        );
    }
    const body = showCurrent ? (
        <div className='it-page-prose max-h-96 min-w-0 flex-1 overflow-y-auto rounded-md border p-3 text-sm'>
            {rendered}
        </div>
    ) : stripHtml(proposed) ? (
        <div
            className='it-page-prose max-h-96 min-w-0 flex-1 overflow-y-auto rounded-md border bg-success-subtle/20 p-3 text-sm'
            dangerouslySetInnerHTML={{ __html: proposed }}
        />
    ) : (
        <p className='pt-px text-sm italic text-content-subtle'>Empty</p>
    );
    return (
        <div className='py-2.5'>
            <div className='flex flex-wrap items-baseline justify-between gap-x-3'>
                <p className='text-xs font-medium text-content'>
                    Conditions document ({locale.toUpperCase()})
                </p>
                {editedAt && (
                    <span className='text-2xs text-content-subtle'>
                        {relativeTime(editedAt)}
                    </span>
                )}
            </div>
            <div className='mt-1.5 flex gap-2.5'>
                <span
                    className={cn(
                        'w-16 shrink-0 pt-px text-2xs font-medium uppercase tracking-caps',
                        showCurrent ? 'text-success-fg' : 'text-content-subtle'
                    )}>
                    {showCurrent ? 'Changes' : 'Proposed'}
                </span>
                {body}
            </div>
        </div>
    );
}

function sameValue(a: unknown, b: unknown): boolean {
    if (Array.isArray(a) || Array.isArray(b)) {
        return (
            JSON.stringify(Array.isArray(a) ? a : []) ===
            JSON.stringify(Array.isArray(b) ? b : [])
        );
    }
    const norm = (v: unknown) => (v === '' || v === undefined ? null : v);
    return norm(a) === norm(b);
}

const tokenCount = (v: string) => v.split(/\s+/).filter(Boolean).length;

function ValueText({
    value,
    muted,
    bulleted,
}: {
    value: unknown;
    muted?: boolean;
    bulleted?: boolean;
}) {
    if (bulleted && Array.isArray(value) && value.filter(Boolean).length > 0) {
        return (
            <ul
                className={cn(
                    'min-w-0 list-disc space-y-0.5 pl-4 text-sm leading-relaxed',
                    muted ? 'text-content-muted' : 'text-content'
                )}>
                {value.filter(Boolean).map((item, idx) => (
                    <li key={idx}>{String(item)}</li>
                ))}
            </ul>
        );
    }
    const text = Array.isArray(value)
        ? value.filter(Boolean).join(' · ')
        : typeof value === 'string' && value.trim() !== ''
          ? value
          : null;
    return (
        <p
            className={cn(
                'min-w-0 text-sm leading-snug line-clamp-3',
                muted ? 'text-content-muted' : 'text-content'
            )}>
            {text ?? (
                <span className='italic text-content-subtle'>Empty</span>
            )}
        </p>
    );
}

/**
 * One changed field. A row whose proposed value EQUALS the live one renders
 * nothing - sets stashed before the diff-pruning fix carry that noise, and
 * the reviewer must never scroll past no-ops (UX round 3). When both sides
 * are known the row renders as a single inline diff (removed words struck,
 * added highlighted); the stacked Current/Proposed pair remains only for the
 * operator view (no live values) and for texts past the LCS cap.
 */
function DiffRow({
    label,
    current,
    proposed,
    showCurrent,
    editedAt,
    bulleted,
}: {
    label: string;
    current?: unknown;
    proposed: unknown;
    showCurrent: boolean;
    /** When this unit was last staged (client round 5: per-change stamps). */
    editedAt?: string;
    /** List fields whose items are structured bullets on the live surface
     *  (the conditions confirm-list) review as bullets here too. */
    bulleted?: boolean;
}) {
    if (showCurrent && sameValue(current, proposed)) return null;

    let body: React.ReactNode;
    if (showCurrent && Array.isArray(proposed)) {
        body = (
            <InlineListDiff
                current={Array.isArray(current) ? (current as string[]) : []}
                proposed={proposed as string[]}
                variant={bulleted ? 'bullets' : undefined}
            />
        );
    } else if (
        showCurrent &&
        (typeof proposed === 'string' || proposed === null) &&
        (typeof current === 'string' ||
            current === null ||
            current === undefined) &&
        tokenCount((current as string) ?? '') <= INLINE_DIFF_TOKEN_CAP &&
        tokenCount((proposed as string) ?? '') <= INLINE_DIFF_TOKEN_CAP
    ) {
        body = (
            <InlineDiff
                current={(current as string) ?? ''}
                proposed={(proposed as string) ?? ''}
            />
        );
    } else {
        body = (
            <div className='space-y-1.5'>
                {showCurrent && (
                    <div className='flex gap-2.5'>
                        <span className='w-16 shrink-0 pt-px text-2xs font-medium uppercase tracking-caps text-content-subtle'>
                            Current
                        </span>
                        <ValueText value={current} muted bulleted={bulleted} />
                    </div>
                )}
                <div className='flex gap-2.5'>
                    <span
                        className={cn(
                            'w-16 shrink-0 pt-px text-2xs font-medium uppercase tracking-caps',
                            showCurrent
                                ? 'text-success-fg'
                                : 'text-content-subtle'
                        )}>
                        Proposed
                    </span>
                    <ValueText value={proposed} bulleted={bulleted} />
                </div>
            </div>
        );
    }

    return (
        <div className='py-2.5'>
            <div className='flex flex-wrap items-baseline justify-between gap-x-3'>
                <p className='text-xs font-medium text-content'>{label}</p>
                {editedAt && (
                    <span className='text-2xs text-content-subtle'>
                        {relativeTime(editedAt)}
                    </span>
                )}
            </div>
            <div className='mt-1.5'>{body}</div>
        </div>
    );
}

/**
 * One locale's changed text fields. The live row comes from the translation
 * endpoint - which, for the OPERATOR, is overlaid with their own proposal, so
 * `showCurrent` is false for them and the live fetch is display-irrelevant.
 */
function LocaleTextDiff({
    tripId,
    locale,
    fields,
    currentFields,
    showCurrent,
    fieldTimes,
}: {
    tripId: string;
    locale: string;
    fields: Record<string, unknown>;
    /** Per-unit "last staged" stamps (client round 5). */
    fieldTimes?: Record<string, string>;
    /** Server-collected live values (preferred - one consistent snapshot,
     *  and the only source an operator has). */
    currentFields?: Record<string, unknown>;
    showCurrent: boolean;
}) {
    const { data: live } = useTripTranslationByLocale(tripId, locale);
    // Without the server snapshot, the reviewer's rows filter against the
    // fetched live row - rendering before it arrives would flash no-op rows
    // that vanish a beat later.
    if (showCurrent && !currentFields && live === undefined) return null;
    const currentOf = (key: string) =>
        currentFields
            ? currentFields[key]
            : (live as Record<string, unknown> | undefined)?.[key];
    const localeSuffix =
        locale === 'en'
            ? ''
            : ` (${LOCALE_LABELS[locale] ?? locale.toUpperCase()})`;
    return (
        <>
            {Object.entries(fields).map(([key, proposed]) => (
                <DiffRow
                    key={`${locale}:${key}`}
                    label={`${TRANSLATION_FIELD_LABELS[key] ?? key}${localeSuffix}`}
                    current={showCurrent ? currentOf(key) : undefined}
                    proposed={proposed}
                    showCurrent={showCurrent}
                    editedAt={fieldTimes?.[`tr:${locale}:${key}`]}
                />
            ))}
        </>
    );
}

/** The EN text of a staged/live list item - the canonical diff value. */
function enTextOf(item: StagedTripListItem): string {
    const en = item.translations.find(t => t.locale === 'en');
    if (!en) return '';
    return String(en.text ?? en.label ?? en.title ?? '');
}

/**
 * One itemized list's diff (UX round 4: highlights, inclusions, exclusions,
 * features and itinerary changes are recorded and shown like everything
 * else). Kept items render plain, added ones highlighted, removed ones
 * struck; an EDITED item renders as an inline word diff of its text.
 */
function ListDiff({
    kind,
    staged,
    currentItems,
    showCurrent,
    editedAt,
}: {
    kind: StagedListKind;
    staged: StagedTripListItem[];
    currentItems?: StagedTripListItem[];
    showCurrent: boolean;
    editedAt?: string;
}) {
    const byId = new Map((currentItems ?? []).map(i => [i.id, i]));
    const ordered = [...staged].sort(
        (a, b) =>
            ((a.displayOrder as number) ?? 0) -
            ((b.displayOrder as number) ?? 0)
    );
    const removed = showCurrent
        ? (currentItems ?? []).filter(c => !staged.some(s => s.id === c.id))
        : [];

    // A base-field edit (order, icon, price text, geo, image) is a change
    // even when the TEXT is identical - the backend stages it, so hiding it
    // here showed a "changed" chip over an empty diff (code review round 4).
    const sameBase = (a: StagedTripListItem, b: StagedTripListItem) => {
        const keys = new Set(
            [...Object.keys(a), ...Object.keys(b)].filter(
                k =>
                    k !== 'translations' &&
                    k !== 'isNew' &&
                    k !== 'tourId' &&
                    k !== 'id'
            )
        );
        const norm = (v: unknown) =>
            v === '' || v === undefined ? null : v;
        for (const k of keys) {
            const av = a[k];
            const bv = b[k];
            if (Array.isArray(av) || Array.isArray(bv)) {
                if (JSON.stringify(av ?? []) !== JSON.stringify(bv ?? []))
                    return false;
            } else if (norm(av) !== norm(bv)) return false;
        }
        return true;
    };

    // With live values in hand, drop the no-op rows entirely - and if the
    // whole list is no-ops (pre-fix payload noise), render nothing.
    const rows = ordered
        .map(item => {
            const live = item.isNew ? undefined : byId.get(item.id);
            const text = enTextOf(item);
            const liveText = live ? enTextOf(live) : undefined;
            const detailsChanged = !!live && !sameBase(item, live);
            const changed =
                item.isNew ||
                !showCurrent ||
                liveText !== text ||
                detailsChanged;
            return { item, text, liveText, changed, detailsChanged };
        })
        .filter(r => r.changed || !showCurrent);
    if (showCurrent && rows.length === 0 && removed.length === 0) return null;

    return (
        <div className='py-2.5'>
            <div className='flex flex-wrap items-baseline justify-between gap-x-3'>
                <p className='text-xs font-medium text-content'>
                    {PENDING_AREA_LABELS[kind]}
                </p>
                {editedAt && (
                    <span className='text-2xs text-content-subtle'>
                        {relativeTime(editedAt)}
                    </span>
                )}
            </div>
            <ul className='mt-1.5 space-y-1'>
                {rows.map(({ item, text, liveText, detailsChanged }) => (
                    <li key={item.id} className='flex gap-2 text-sm'>
                        <span className='select-none text-content-subtle'>
                            ·
                        </span>
                        {item.isNew || !showCurrent ? (
                            <span
                                className={cn(
                                    'min-w-0 text-content',
                                    item.isNew &&
                                        'rounded-sm bg-success-subtle px-0.5 font-medium text-success-fg'
                                )}>
                                {text}
                            </span>
                        ) : liveText !== text ? (
                            <InlineDiff
                                current={liveText ?? ''}
                                proposed={text}
                            />
                        ) : (
                            <span className='min-w-0 text-content'>
                                {text}
                                {detailsChanged && (
                                    <span className='text-content-subtle'>
                                        {' '}
                                        · details updated (order, icon, price
                                        or location)
                                    </span>
                                )}
                            </span>
                        )}
                    </li>
                ))}
                {removed.map(item => (
                    <li key={item.id} className='flex gap-2 text-sm'>
                        <span className='select-none text-content-subtle'>
                            ·
                        </span>
                        <span className='min-w-0 rounded-sm bg-danger-subtle px-0.5 text-danger-fg line-through decoration-danger-fg/60'>
                            {enTextOf(item)}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/** The staged gallery vs the approved one: thumbnails, not a word. */
function PhotoDiff({
    tripId,
    staged,
    currentImages,
    showCurrent,
    editedAt,
}: {
    tripId: string;
    staged: StagedTripImage[];
    /** Server-collected real gallery (preferred - the operator's own image
     *  reads serve the STAGED set, never the live one). */
    currentImages?: StagedTripImage[];
    showCurrent: boolean;
    editedAt?: string;
}) {
    const { data: fetched } = useImages(tripId);
    const real = currentImages ?? fetched;
    const added = staged.filter(i => i.isNew);
    const removed = showCurrent
        ? (real ?? []).filter(r => !staged.some(s => s.id === r.id))
        : [];
    const currentHero = (real ?? []).find(i => i.isHero);
    const stagedHero = staged.find(i => i.isHero);
    const coverChanged =
        showCurrent &&
        !!currentHero &&
        !!stagedHero &&
        currentHero.id !== stagedHero.id;

    const order = (imgs: Array<{ id: string; displayOrder: number }>) =>
        [...imgs]
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map(i => i.id)
            .join('|');

    // A staged gallery identical to the live one (same photos, same order,
    // same cover) is pre-fix payload noise - never a row to review.
    if (
        showCurrent &&
        real &&
        added.length === 0 &&
        removed.length === 0 &&
        !coverChanged &&
        order(staged) === order(real)
    ) {
        return null;
    }

    // Only reorders? Say so instead of parading the whole gallery.
    const orderChanged =
        showCurrent &&
        !!real &&
        added.length === 0 &&
        removed.length === 0 &&
        order(staged) !== order(real);

    const summary = [
        added.length > 0 &&
            `${added.length} new photo${added.length === 1 ? '' : 's'}`,
        removed.length > 0 && `${removed.length} removed`,
        coverChanged && 'new cover photo',
        orderChanged && 'order changed',
        !showCurrent &&
            `${staged.length} photo${staged.length === 1 ? '' : 's'} proposed`,
    ]
        .filter(Boolean)
        .join(' · ');

    const thumb = (
        img: StagedTripImage,
        variant: 'added' | 'removed' | 'cover'
    ) => (
        <div
            key={`${variant}:${img.id}`}
            className={cn(
                'relative size-12 shrink-0 overflow-hidden rounded-md border bg-muted',
                variant === 'added' &&
                    'border-success-border ring-1 ring-success-border',
                variant === 'removed' && 'border-danger-border opacity-50',
                variant === 'cover' && 'border-line'
            )}>
            <img src={img.url} alt='' className='size-full object-cover' />
            {variant === 'removed' && (
                <span className='absolute inset-0 bg-danger-fg/15' />
            )}
        </div>
    );

    return (
        <div className='py-2.5'>
            <div className='flex flex-wrap items-baseline justify-between gap-x-3'>
                <p className='text-xs font-medium text-content'>Photos</p>
                {editedAt && (
                    <span className='text-2xs text-content-subtle'>
                        {relativeTime(editedAt)}
                    </span>
                )}
            </div>
            <p className='mt-1 text-sm text-content-muted'>{summary}</p>
            {/* ONLY the changes (client round 5) - the full gallery lives on
                the Media step, not in a review diff. */}
            {showCurrent && added.length > 0 && (
                <div className='mt-2 flex flex-wrap items-center gap-1.5'>
                    <span className='w-16 shrink-0 text-2xs font-medium uppercase tracking-caps text-success-fg'>
                        Added
                    </span>
                    {added.map(img => thumb(img, 'added'))}
                </div>
            )}
            {removed.length > 0 && (
                <div className='mt-2 flex flex-wrap items-center gap-1.5'>
                    <span className='w-16 shrink-0 text-2xs font-medium uppercase tracking-caps text-danger-fg'>
                        Removed
                    </span>
                    {removed.map(img => thumb(img, 'removed'))}
                </div>
            )}
            {coverChanged && currentHero && stagedHero && (
                <div className='mt-2 flex flex-wrap items-center gap-1.5'>
                    <span className='w-16 shrink-0 text-2xs font-medium uppercase tracking-caps text-content-subtle'>
                        Cover
                    </span>
                    {thumb(currentHero, 'removed')}
                    <span className='text-xs text-content-subtle'>to</span>
                    {thumb(stagedHero, 'cover')}
                </div>
            )}
            {/* The operator's own reads serve the staged set, so without the
                server snapshot only additions are distinguishable - the
                summary line still names the proposed total. */}
            {!showCurrent && added.length > 0 && (
                <div className='mt-2 flex flex-wrap items-center gap-1.5'>
                    {added.map(img => thumb(img, 'added'))}
                </div>
            )}
        </div>
    );
}

/**
 * Humanized field-by-field view of a pending change set (UX round 2): the
 * reviewer sees Current vs Proposed per field and a photo diff with
 * thumbnails; the operator (whose reads are overlaid with the proposal) sees
 * the proposed values only - except the title, whose live value is on the
 * trip payload for both roles.
 */
export function PendingChangeDiff({
    trip,
    change,
    showCurrent,
}: {
    trip: TripListItem;
    change: TripPendingChange;
    showCurrent: boolean;
}) {
    const { payload } = change;
    const fieldTimes = payload.meta?.fieldTimes;
    // The live document map the conditions rows diff against: the reviewer
    // gets the server-loaded current values; the operator falls back to the
    // (overlaid) trip payload.
    const liveDocMap =
        change.current?.conditions !== undefined
            ? change.current.conditions.document
            : (trip.operatorTermsDocument ?? null);
    const liveItemsMap =
        change.current?.conditions !== undefined
            ? change.current.conditions.acknowledgmentItems
            : (trip.acknowledgmentItems ?? null);
    // No wrapper of its own: the caller owns the container (the panel keys
    // its all-rows-filtered empty state off that div's :empty state).
    return (
        <>
            {payload.tour?.name !== undefined && (
                <DiffRow
                    label='Tour title'
                    current={change.current?.tour?.name ?? trip.name}
                    proposed={payload.tour.name}
                    showCurrent
                    editedAt={fieldTimes?.title}
                />
            )}
            {Object.entries(payload.translations ?? {}).map(
                ([locale, fields]) => (
                    <LocaleTextDiff
                        key={locale}
                        tripId={trip.id}
                        locale={locale}
                        fields={fields}
                        currentFields={change.current?.translations?.[locale]}
                        showCurrent={showCurrent}
                        fieldTimes={fieldTimes}
                    />
                )
            )}
            {payload.images && (
                <PhotoDiff
                    tripId={trip.id}
                    staged={payload.images}
                    currentImages={change.current?.images}
                    showCurrent={showCurrent}
                    editedAt={fieldTimes?.photos}
                />
            )}
            {Object.entries(payload.lists ?? {}).map(([kind, staged]) =>
                staged ? (
                    <ListDiff
                        key={kind}
                        kind={kind as StagedListKind}
                        staged={staged}
                        currentItems={
                            change.current?.lists?.[kind as StagedListKind]
                        }
                        showCurrent={showCurrent}
                        editedAt={fieldTimes?.[`list:${kind}`]}
                    />
                ) : null
            )}
            {payload.conditions && (
                <>
                    {/* The gate flavor and the confirm-list are ONE staged
                        unit (Pastel #80); each row still self-filters, so a
                        facts-only edit shows no no-op flavor row. */}
                    <DiffRow
                        label='Booking conditions gate'
                        current={conditionsKindLabel(
                            change.current?.conditions !== undefined
                                ? change.current.conditions.kind
                                : trip.operatorTermsKind
                        )}
                        proposed={conditionsKindLabel(payload.conditions.kind)}
                        showCurrent={showCurrent}
                        editedAt={fieldTimes?.conditions}
                    />
                    {/* One row per locale - the Translation Console stages
                        per-locale facts into the same unit, and a
                        translation-only change must not review as an empty
                        diff. DiffRow self-filters untouched locales. */}
                    {conditionsFactsLocales(
                        payload.conditions.acknowledgmentItems,
                        liveItemsMap
                    ).map(locale => (
                        <DiffRow
                            key={`facts-${locale}`}
                            label={
                                locale === 'en'
                                    ? 'Facts travellers confirm'
                                    : `Facts travellers confirm (${locale.toUpperCase()})`
                            }
                            current={liveItemsMap?.[locale] ?? []}
                            proposed={
                                payload.conditions?.acknowledgmentItems?.[
                                    locale
                                ] ?? []
                            }
                            showCurrent={showCurrent}
                            editedAt={fieldTimes?.conditions}
                            bulleted
                        />
                    ))}
                    {/* The document reviews FORMATTED - the reviewer approves
                        a legal text travellers will read as structured prose,
                        so headings and lists must be visible. The HTML is
                        sanitized at write time by the backend pages pipeline
                        (its only writers). One block per locale that differs
                        in TEXT - markup-only churn is not a reviewable
                        change. */}
                    {conditionsDocumentLocales(
                        payload.conditions.document,
                        liveDocMap
                    ).map(locale => (
                        <DocumentDiffBlock
                            key={`doc-${locale}`}
                            locale={locale}
                            current={liveDocMap?.[locale] ?? ''}
                            proposed={
                                payload.conditions?.document?.[locale] ?? ''
                            }
                            showCurrent={showCurrent}
                            editedAt={fieldTimes?.conditions}
                        />
                    ))}
                </>
            )}
        </>
    );
}
