'use client';

/**
 * EditableListSection (04 §2.2, Phase 18) - ONE frame for every repeatable
 * list in the tour editor (highlights, inclusions, exclusions, info & terms,
 * itinerary, pickups). Six tabs used to hand-copy this: card + header +
 * count + skeleton + empty state + rows + bottom add-form.
 *
 * The section owns the FRAME; each tab keeps owning its data: hooks,
 * schemas, toasts and payloads stay in the caller (mutation contracts
 * untouched). Rows with an `renderExpanded` body render as compact
 * CollapsibleCards (the shared accordion); simple rows render flat.
 *
 * Translations are NOT here - the Translation Console owns every non-EN
 * field. That deletion is what shrank these tabs.
 */

import { Delete02Icon, PlusSignIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { CollapsibleCard } from '@/components/common/collapsible-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface EditableListSectionProps<TItem> {
    title: string;
    description?: ReactNode;
    items: TItem[] | undefined;
    isLoading: boolean;
    getId: (item: TItem) => string;
    /** Row header: leading chip + label line. */
    renderSummary: (item: TItem) => ReactNode;
    /** Optional accordion body (inline editors). Absent → flat row. */
    renderExpanded?: (item: TItem) => ReactNode;
    onDelete: (item: TItem) => void;
    isDeleting?: boolean;
    emptyText: string;
    /** Extra chips on the header row (publish-requirement hints etc.). */
    headerMeta?: ReactNode;
    addForm?: {
        heading: string;
        /** Caller-owned <form onSubmit> wrapping these fields. */
        children: ReactNode;
    };
    /**
     * One-field lists add inline instead of opening a panel.
     *
     * A bordered card with its own heading, its own Cancel and its own submit
     * button is a lot of ceremony for typing five words. Where the add form is
     * a single text input - highlights, inclusions - the row is composed in
     * place, in the same bulleted style as the tour-copy lists, and Enter
     * commits it. Lists that genuinely ask more than one question (exclusions
     * carry a type and a price, features a category, stops a coordinate) keep
     * `addForm`.
     *
     * Exactly one of `addForm` / `quickAdd` should be supplied.
     */
    quickAdd?: {
        /** Primary text action under the composer, e.g. "Add highlight". */
        addLabel: string;
        placeholder: string;
        ariaLabel: string;
        disabled?: boolean;
        /**
         * Fires the caller's mutation. Return a message to REJECT the value
         * (validation stays with the caller, alongside its schema); return
         * null to accept, which clears the composer.
         */
        onAdd: (text: string) => string | null;
    };
    /**
     * Drop the Card chrome AND the duplicated title. The creation wizard
     * already names this list in its section header, so the card was a panel
     * inside a panel with the heading printed twice.
     */
    bare?: boolean;
}

/**
 * The inline composer: a bulleted line you type into, Enter to commit.
 *
 * Deliberately the same borderless treatment as the tour-copy lists on the
 * description step - no box in any state, the caret is the focus indicator.
 * The whole point is that adding a highlight should feel like writing the next
 * bullet, not like filling in a form about a bullet.
 */
function QuickAddRow({
    addLabel,
    placeholder,
    ariaLabel,
    disabled,
    onAdd,
}: {
    addLabel: string;
    placeholder: string;
    ariaLabel: string;
    disabled?: boolean;
    onAdd: (text: string) => string | null;
}) {
    const input = useRef<HTMLInputElement>(null);
    const [text, setText] = useState('');
    const [error, setError] = useState<string | null>(null);

    function commit() {
        const value = text.trim();
        if (!value) return;
        const rejected = onAdd(value);
        if (rejected) {
            setError(rejected);
            return;
        }
        setText('');
        setError(null);
        input.current?.focus();
    }

    return (
        <div>
            <div className='flex items-center gap-2 py-0.5'>
                <span
                    aria-hidden
                    className='size-1 shrink-0 rounded-full bg-content-subtle'
                />
                <input
                    ref={input}
                    value={text}
                    disabled={disabled}
                    aria-label={ariaLabel}
                    aria-invalid={!!error}
                    placeholder={placeholder}
                    onChange={e => {
                        setText(e.target.value);
                        if (error) setError(null);
                    }}
                    onBlur={commit}
                    onKeyDown={e => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            commit();
                        }
                        if (e.key === 'Escape') {
                            setText('');
                            setError(null);
                        }
                    }}
                    className='min-w-0 flex-1 bg-transparent px-0 py-1 text-sm text-content outline-none placeholder:text-content-subtle disabled:cursor-not-allowed disabled:opacity-60'
                />
            </div>
            {error && (
                <p className='pl-3 text-xs text-danger-fg' role='alert'>
                    {error}
                </p>
            )}
            <Button
                type='button'
                variant='ghost'
                size='sm'
                disabled={disabled}
                onClick={() => input.current?.focus()}
                className='-ml-2 text-primary'>
                <HugeiconsIcon icon={PlusSignIcon} className='size-3.5' />
                {addLabel}
            </Button>
        </div>
    );
}

export function EditableListSection<TItem>({
    title,
    description,
    items,
    isLoading,
    getId,
    renderSummary,
    renderExpanded,
    onDelete,
    isDeleting = false,
    emptyText,
    headerMeta,
    addForm,
    quickAdd,
    bare = false,
}: EditableListSectionProps<TItem>) {
    const count = items?.length ?? 0;

    // The add form stays closed until asked for. Left open it doubled the
    // height of every list with a form nobody was filling in, and on the
    // itinerary it put an empty stop editor directly under three real stops.
    const [adding, setAdding] = useState(false);

    // The caller owns the form and its mutation, so the only signal that an
    // add succeeded is the list growing. Close on that rather than making
    // every caller report back.
    const prevCount = useRef(count);
    useEffect(() => {
        if (count > prevCount.current) setAdding(false);
        prevCount.current = count;
    }, [count]);

    /**
     * Inside the wizard every simple list reads as bullets.
     *
     * Rows used to be 44px tall, semibold, hairline-separated and full-bleed -
     * a table of one-line strings. The bulleted treatment landed first on the
     * quick-add lists, because their composer was already a bullet and the
     * mismatch was glaring; it belongs on all of them. Highlights, inclusions
     * and info-and-terms are the same KIND of thing - a short line the operator
     * wrote - so they get the same row.
     *
     * Tied to `bare` (the wizard) rather than to `quickAdd`, so a list keeps
     * the treatment whether it composes inline or opens a panel.
     */
    const bulleted = bare;

    // ONE delete treatment everywhere: quiet grey glyph, red on hover. A
    // column of permanently red trash icons was the highest-contrast thing on
    // a screen full of the operator's own words, and destructive is not the
    // thing a list should emphasise at rest.
    const deleteButton = (item: TItem) => (
        <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            onClick={() => onDelete(item)}
            disabled={isDeleting}
            className='shrink-0 text-content-subtle hover:bg-danger-subtle hover:text-danger-fg'>
            <HugeiconsIcon icon={Delete02Icon} className='size-3.5' />
        </Button>
    );

    const body = (
        // A list and its inline composer are one list, so they get list
        // spacing. A list whose add opens a panel keeps section spacing.
        <div className={cn(quickAdd ? 'space-y-2' : 'space-y-4')}>
            {/* In `bare` mode the wizard section header already names this
                list, so repeating the title and its item count here is pure
                duplication - only the caller's own meta slot survives. */}
            {(headerMeta || !bare) && (
                <div className='flex flex-wrap items-center justify-between gap-2'>
                    {!bare && (
                        <p className='text-sm font-medium text-content'>
                            {title}
                            <span className='ml-2 text-xs font-light text-content-muted'>
                                {count} item{count === 1 ? '' : 's'}
                            </span>
                        </p>
                    )}
                    {headerMeta}
                </div>
            )}
            {isLoading ? (
                <div className='space-y-2'>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className='h-11 w-full' />
                    ))}
                </div>
            ) : (
                <div
                    className={cn(
                        bulleted ? '' : bare ? 'border-t border-line' : 'space-y-2',
                    )}>
                    {(items ?? []).map(item =>
                        renderExpanded ? (
                            <CollapsibleCard
                                key={getId(item)}
                                compact={!bare}
                                flat={bare}
                                title={renderSummary(item)}
                                actions={deleteButton(item)}>
                                {renderExpanded(item)}
                            </CollapsibleCard>
                        ) : bulleted ? (
                            <div
                                key={getId(item)}
                                className='flex items-center gap-2 py-0.5'>
                                <span
                                    aria-hidden
                                    className='size-1 shrink-0 rounded-full bg-content-subtle'
                                />
                                <div className='min-w-0 flex-1 py-1 text-sm text-content'>
                                    {renderSummary(item)}
                                </div>
                                {deleteButton(item)}
                            </div>
                        ) : (
                            <div
                                key={getId(item)}
                                className={
                                    bare
                                        ? 'flex items-center justify-between gap-2 border-b border-line py-3 last:border-b-0'
                                        : 'flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2.5'
                                }>
                                <div className='min-w-0 flex-1 text-sm font-medium text-content'>
                                    {renderSummary(item)}
                                </div>
                                {deleteButton(item)}
                            </div>
                        )
                    )}
                    {/* Suppressed only when a composer sits right under it -
                        "No highlights yet." would be a sentence explaining the
                        empty input directly below. Lists that open a panel
                        instead still need to say they are empty. */}
                    {count === 0 && !quickAdd && (
                        <p className='py-4 text-center text-sm text-content-muted'>
                            {emptyText}
                        </p>
                    )}
                </div>
            )}

            {quickAdd && (
                <QuickAddRow
                    addLabel={quickAdd.addLabel}
                    placeholder={quickAdd.placeholder}
                    ariaLabel={quickAdd.ariaLabel}
                    disabled={quickAdd.disabled}
                    onAdd={quickAdd.onAdd}
                />
            )}

            {addForm && !adding && (
                <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => setAdding(true)}
                    className='-ml-2 text-primary'>
                    <HugeiconsIcon icon={PlusSignIcon} className='size-3.5' />
                    {addForm.heading}
                </Button>
            )}

            {/* Border only, no fill - a transient editing surface, same rule
                as the schedule and pricing forms. Cancel sits in the header
                rather than beside the submit, because the submit button lives
                inside the caller's own <form> and this component cannot reach
                it. */}
            {addForm && (
                <div
                    className={cn(
                        'space-y-4 rounded-lg border border-line p-4',
                        !adding && 'hidden',
                    )}>
                    <div className='flex items-center justify-between gap-3'>
                        <p className='text-sm font-semibold text-content'>
                            {addForm.heading}
                        </p>
                        <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            onClick={() => setAdding(false)}
                            className='text-content-muted'>
                            Cancel
                        </Button>
                    </div>
                    {addForm.children}
                </div>
            )}
        </div>
    );

    if (bare) return body;

    return (
        <Card>
            <CardHeader className='border-b pb-4'>
                <CardTitle className='font-sans text-base'>{title}</CardTitle>
                {description && (
                    <p className='mt-1 text-sm text-content-muted'>
                        {description}
                    </p>
                )}
            </CardHeader>
            <CardContent className='pt-6'>{body}</CardContent>
        </Card>
    );
}

