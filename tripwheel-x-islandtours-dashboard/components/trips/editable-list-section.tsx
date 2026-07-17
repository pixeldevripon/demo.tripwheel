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

import { Delete02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import type { ReactNode } from 'react';

import { CollapsibleCard } from '@/components/common/collapsible-card';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

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
    addForm: {
        heading: string;
        /** Caller-owned <form onSubmit> wrapping these fields. */
        children: ReactNode;
    };
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
}: EditableListSectionProps<TItem>) {
    const count = items?.length ?? 0;

    const deleteButton = (item: TItem) => (
        <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            onClick={() => onDelete(item)}
            disabled={isDeleting}
            className='text-danger-fg hover:bg-danger-subtle hover:text-danger-fg'>
            <HugeiconsIcon icon={Delete02Icon} className='size-3.5' />
        </Button>
    );

    return (
        <Card>
            <CardHeader className='border-b pb-4'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                    <CardTitle className='font-sans text-base'>
                        {title}
                        <span className='ml-2 text-xs font-normal text-content-muted'>
                            {count} item{count === 1 ? '' : 's'}
                        </span>
                    </CardTitle>
                    {headerMeta}
                </div>
                {description && (
                    <p className='mt-1 text-sm text-content-muted'>
                        {description}
                    </p>
                )}
            </CardHeader>
            <CardContent className='space-y-4 pt-6'>
                {isLoading ? (
                    <div className='space-y-2'>
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className='h-11 w-full' />
                        ))}
                    </div>
                ) : (
                    <div className='space-y-2'>
                        {(items ?? []).map(item =>
                            renderExpanded ? (
                                <CollapsibleCard
                                    key={getId(item)}
                                    compact
                                    title={renderSummary(item)}
                                    actions={deleteButton(item)}>
                                    {renderExpanded(item)}
                                </CollapsibleCard>
                            ) : (
                                <div
                                    key={getId(item)}
                                    className='flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2.5'>
                                    <div className='min-w-0 flex-1 text-sm font-medium text-content'>
                                        {renderSummary(item)}
                                    </div>
                                    {deleteButton(item)}
                                </div>
                            ),
                        )}
                        {count === 0 && (
                            <p className='py-4 text-center text-sm text-content-muted'>
                                {emptyText}
                            </p>
                        )}
                    </div>
                )}

                <div className='border-t border-line pt-4'>
                    <p className='mb-3 text-2xs font-semibold tracking-caps uppercase text-content-subtle'>
                        {addForm.heading}
                    </p>
                    {addForm.children}
                </div>
            </CardContent>
        </Card>
    );
}
