/**
 * Tour English copy: the field set, how it groups, and the ONE payload builder
 * (07 §3, step 7).
 *
 * The 12 body fields are written by a single translation upsert. That is a
 * hard constraint, not a style choice: the upsert sends every field it knows
 * about, so two writers on one record would clobber each other. The wizard
 * therefore shows the fields in four collapsible groups but keeps ONE form and
 * ONE save behind them.
 *
 * `buildTourCopyPayload` is shared with `english-content-editor.tsx` so the
 * grouped wizard form and the flat editor produce byte-identical bodies -
 * including the newline-to-array split that the `lines` fields depend on.
 */

import { TOUR_FIELDS, type TranslatableFieldDef } from '@/lib/translatable-schema';

/**
 * Body copy only. SEO meta lives on the reach step in its own per-locale
 * panel, matching where the old SEO tab kept it.
 */
export const TOUR_COPY_FIELDS: TranslatableFieldDef[] = TOUR_FIELDS.filter(
    f => f.name !== 'metaTitle' && f.name !== 'metaDescription',
);

/** Fields stored as string arrays, entered one item per line. */
const LINES_FIELDS = new Set(
    TOUR_FIELDS.filter(f => f.kind === 'lines').map(f => f.name),
);

export interface TourCopyGroup {
    id: string;
    title: string;
    /** Only when the title genuinely does not carry it. Usually absent. */
    description?: string;
    /** Rendered in this order; every field appears in exactly one group. */
    fields: string[];
}

/**
 * Four groups, ordered by how much they matter to a traveller deciding.
 * `overview` carries a publish gate, which is why it opens by default.
 *
 * None of them carries a description. Every one that existed was the group
 * title said again in a longer sentence ("Good to know" / "What to pack, what
 * to expect, and who this is not for"), which costs a line of the operator's
 * attention to teach them nothing.
 */
export const TOUR_COPY_GROUPS: TourCopyGroup[] = [
    {
        id: 'overview',
        title: 'Overview',
        fields: [
            'title',
            'overview',
            'shortDescription',
            'whatToExpectIntro',
        ],
    },
    {
        id: 'good-to-know',
        title: 'Good to know',
        fields: ['whatToBring', 'knowBeforeYouGo', 'notSuitableFor'],
    },
    {
        id: 'local-tip',
        title: 'Local tip and traveller note',
        fields: ['localTipTitle', 'localTipBody', 'operatorNote'],
    },
    {
        id: 'labels',
        title: 'Meeting point and labels',
        fields: ['meetingPointText', 'categoryDisplay'],
    },
];

/**
 * Hints for the fields whose LABEL does not already answer the question.
 *
 * The bar is deliberately high, because a hint under every field is the same
 * as no hints at all - the operator learns the grey line never says anything
 * and stops reading it, including on the two fields where it matters. So a
 * field earns one only when it is surprising ("Short description" is not shown
 * on the page; "Note to travellers" goes to an email, not the page) or has a
 * fallback that is invisible until you hit it.
 *
 * "The main description, right under the photos" told an operator staring at a
 * field labelled Overview exactly nothing, and "Required before this tour can
 * go live" repeated the red asterisk beside it. Both gone.
 *
 * Kept here rather than on `TOUR_FIELDS` deliberately: that schema is shared
 * with the Translation Console, and these hints are wizard voice.
 */
export const TOUR_COPY_HINTS: Record<string, string> = {
    title: 'Leave empty to use the tour name.',
    shortDescription:
        'Never shown on the page - this is the summary search engines quote in results.',
    whatToExpectIntro: 'Sits above the list of stops.',
    notSuitableFor: 'Pregnancy, mobility limits, age limits.',
    operatorNote:
        'Shown as "A note from the operator" in the confirmation email, not on the page.',
    categoryDisplay: 'Leave empty to use the category name.',
};

/** Fields the publish gate depends on - marked, not enforced, in the form. */
export const TOUR_COPY_REQUIRED = new Set(['overview']);

/** True when this field is entered one item per line and stored as an array. */
export function isLinesField(name: string): boolean {
    return LINES_FIELDS.has(name);
}

/** Guard: a field added to TOUR_FIELDS but to no group would silently vanish. */
export function getUngroupedCopyFields(): string[] {
    const grouped = new Set(TOUR_COPY_GROUPS.flatMap(g => g.fields));
    return TOUR_COPY_FIELDS.filter(f => !grouped.has(f.name)).map(f => f.name);
}

export function findCopyField(name: string): TranslatableFieldDef | undefined {
    return TOUR_COPY_FIELDS.find(f => f.name === name);
}

/**
 * Form values to translation-upsert payload. Trimmed; `lines` fields split on
 * newlines into a filtered array; everything else empty-to-null so clearing a
 * field actually clears it.
 */
export function buildTourCopyPayload(
    values: Record<string, string>,
): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    for (const f of TOUR_COPY_FIELDS) {
        const raw = (values[f.name] ?? '').trim();
        if (LINES_FIELDS.has(f.name)) {
            payload[f.name] = raw
                ? raw
                      .split('\n')
                      .map(l => l.trim())
                      .filter(Boolean)
                : [];
        } else {
            payload[f.name] = raw || null;
        }
    }
    return payload;
}

/** Translation record to form values (arrays render one item per line). */
export function toCopyFormValue(v: unknown): string {
    if (Array.isArray(v)) return v.join('\n');
    return typeof v === 'string' ? v : '';
}
