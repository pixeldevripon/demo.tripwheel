/**
 * What a COLLAPSED wizard section says about itself (07 §5.3).
 *
 * `WizardSection` has always had a `summary` slot, documented as "collapsed
 * must never mean invisible" - and almost no caller passed one. The result was
 * a step that opened as eight or nine identical bars: a filing cabinet, not a
 * form. An operator could not tell which drawers were done, which were empty
 * and which needed them, so the only way to find out was to open all of them -
 * exactly the cost collapsing was meant to remove.
 *
 * These helpers exist so the wording is the same everywhere. A count reads the
 * same on every row, "Empty" reads the same on every row, and neither has to be
 * re-invented per caller and drift.
 */

/**
 * "4 items" / "1 item" / "Empty".
 *
 * `Empty` rather than `0 items`: zero of something is a fact, but the operator
 * is scanning for gaps, and a word finds the eye faster than a digit does.
 */
export function countSummary(
    count: number,
    noun: string,
    pluralNoun?: string,
): string {
    if (count === 0) return 'Empty';
    return `${count} ${count === 1 ? noun : (pluralNoun ?? `${noun}s`)}`;
}

/**
 * A count against a publish gate - "2 of 3" until it is met, then just the
 * count. Past the target the ratio stops being interesting and "4 of 3" reads
 * like a bug.
 */
export function gateSummary(
    count: number,
    required: number,
    noun: string,
    pluralNoun?: string,
): string {
    if (count >= required) return countSummary(count, noun, pluralNoun);
    return `${count} of ${required}`;
}

/** "Set" / "Empty" for a group of free-text fields. */
export function filledSummary(values: (string | null | undefined)[]): string {
    const filled = values.filter(v => (v ?? '').trim().length > 0).length;
    if (filled === 0) return 'Empty';
    if (filled === values.length) return 'Set';
    return `${filled} of ${values.length}`;
}
