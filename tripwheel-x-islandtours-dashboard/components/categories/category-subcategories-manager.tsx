'use client';

import { PlusSignIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useRole } from '@/contexts/role-context';
import {
    useActiveCategories,
    useCreateCategory,
    useUpdateCategory,
} from '@/hooks/categories/use-categories';
import type { CategoryDetail } from '@/types/category';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

/** Mirror of the backend slug util (NFD strip, lowercase, hyphenate). */
function toSlug(value: string) {
    return value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
}

interface Props {
    /** The (top-level) parent category whose sub-categories are managed here. */
    parent: CategoryDetail;
}

/** Pending confirmation for the two consequence-carrying actions. */
type PendingAction =
    | { kind: 'detach'; id: string; name: string }
    | { kind: 'attach'; id: string; name: string };

/**
 * Parent-centric sub-category manager (dashboard). Lists a category's children
 * and lets an admin add new ones, detach existing ones, or re-attach a detached
 * one - all from the parent's edit page. Sub-categories are FILTER-ONLY (no
 * standalone page): they surface as refine chips on the parent's category page.
 * Single-level only, so this manager is rendered only for top-level categories.
 *
 * Both directions carry page consequences, so both confirm before acting:
 *  - Detach PROMOTES the child to a standalone top-level category (pages on
 *    every island).
 *  - Attach-existing DEMOTES a top-level category to filter-only, removing its
 *    page (backend requires `confirmPageRemoval: true`; seeded categories are
 *    never offered).
 */
export function CategorySubcategoriesManager({ parent }: Props) {
    const { can } = useRole();
    const canCreate = can('CREATE_CATEGORY');
    const canEdit = can('EDIT_CATEGORY');

    const { data: allCategories, isLoading } = useActiveCategories('en');
    const { mutate: createCategory, isPending: isCreating } =
        useCreateCategory();
    const { mutate: updateCategory, isPending: isUpdating } =
        useUpdateCategory();

    const [name, setName] = useState('');
    const [attachId, setAttachId] = useState('');
    const [pending, setPending] = useState<PendingAction | null>(null);

    const children = (allCategories ?? []).filter(
        c => c.parentCategoryId === parent.id
    );

    // Re-attachable categories: top-level, not this one, never the 19 seeded
    // master categories, and without children of their own (single-level rule).
    const attachable = (allCategories ?? []).filter(
        c =>
            !c.parentCategoryId &&
            c.id !== parent.id &&
            !c.isSeeded &&
            !(allCategories ?? []).some(x => x.parentCategoryId === c.id)
    );

    function handleAdd() {
        const trimmed = name.trim();
        if (trimmed.length < 2) {
            toast.error('Name must be at least 2 characters.');
            return;
        }
        createCategory(
            {
                name: trimmed,
                slug: toSlug(trimmed),
                parentCategoryId: parent.id,
            },
            {
                onSuccess: () => {
                    toast.success(`Sub-category "${trimmed}" added.`);
                    setName('');
                },
                onError: err =>
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to add sub-category.'
                    ),
            }
        );
    }

    function confirmPending() {
        if (!pending) return;
        const { kind, id, name: label } = pending;
        updateCategory(
            {
                id,
                payload:
                    kind === 'detach'
                        ? { parentCategoryId: null }
                        : {
                              parentCategoryId: parent.id,
                              confirmPageRemoval: true,
                          },
            },
            {
                onSuccess: () => {
                    toast.success(
                        kind === 'detach'
                            ? `"${label}" detached - it is now a top-level category with its own page.`
                            : `"${label}" attached - its standalone page has been removed.`
                    );
                    setPending(null);
                    if (kind === 'attach') setAttachId('');
                },
                onError: err => {
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : kind === 'detach'
                              ? 'Failed to detach sub-category.'
                              : 'Failed to attach category.'
                    );
                    setPending(null);
                },
            }
        );
    }

    const attachCandidate = attachable.find(c => c.id === attachId);

    return (
        <Card>
            <CardHeader>
                <CardTitle className='text-lg font-medium '>
                    Sub-categories
                </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
                <p className='text-sm text-muted-foreground'>
                    Filter-only refinements shown as chips on this
                    category&apos;s page. A sub-category has no standalone page
                    and appears once it has at least one published tour.
                </p>

                {isLoading ? (
                    <div className='space-y-2'>
                        <Skeleton className='h-10 w-full rounded-none' />
                        <Skeleton className='h-10 w-full rounded-none' />
                    </div>
                ) : children.length === 0 ? (
                    <p className='text-sm text-muted-foreground'>
                        No sub-categories yet.
                    </p>
                ) : (
                    <ul className='divide-y rounded-md border'>
                        {children.map(child => (
                            <li
                                key={child.id}
                                className='flex items-center justify-between gap-3 px-4 py-3'>
                                <Link
                                    href={`/categories/${child.id}/edit`}
                                    className='text-sm font-medium hover:underline'>
                                    {child.name}
                                </Link>
                                {canEdit && (
                                    <Button
                                        type='button'
                                        variant='ghost'
                                        size='sm'
                                        disabled={isUpdating}
                                        onClick={() =>
                                            setPending({
                                                kind: 'detach',
                                                id: child.id,
                                                name: child.name,
                                            })
                                        }>
                                        Detach
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}

                {canCreate && (
                    <div className='space-y-2'>
                        <p className='text-xs font-medium text-muted-foreground'>
                            Create new sub-category
                        </p>
                        <div className='flex items-center gap-2'>
                            <Input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder='New sub-category name'
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAdd();
                                    }
                                }}
                            />
                            <Button
                                type='button'
                                size='sm'
                                disabled={isCreating || name.trim().length < 2}
                                onClick={handleAdd}>
                                <HugeiconsIcon icon={PlusSignIcon} />
                                Add
                            </Button>
                        </div>
                        <p className='text-xs text-muted-foreground'>
                            Creates a brand-new filter-only sub-category. To
                            pull in an existing top-level category (for example
                            to undo a detach), use &quot;Attach existing
                            category&quot; below.
                        </p>
                    </div>
                )}

                {canEdit && attachable.length > 0 && (
                    <div className='space-y-2'>
                        <p className='text-xs font-medium text-muted-foreground'>
                            Attach existing category
                        </p>
                        <div className='flex items-center gap-2'>
                            <Select
                                value={attachId}
                                onValueChange={setAttachId}>
                                <SelectTrigger className='flex-1'>
                                    <SelectValue placeholder='Choose a top-level category...' />
                                </SelectTrigger>
                                <SelectContent>
                                    {attachable.map(c => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {c.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                type='button'
                                size='sm'
                                variant='outline'
                                disabled={!attachCandidate || isUpdating}
                                onClick={() =>
                                    attachCandidate &&
                                    setPending({
                                        kind: 'attach',
                                        id: attachCandidate.id,
                                        name: attachCandidate.name,
                                    })
                                }>
                                Attach
                            </Button>
                        </div>
                        <p className='text-xs text-muted-foreground'>
                            Converts it into a filter-only sub-category of this
                            page. Its own standalone page is removed - you will
                            be asked to confirm. Seeded categories are never
                            listed here.
                        </p>
                    </div>
                )}

                <ConfirmDialog
                    open={pending !== null}
                    onOpenChange={open => {
                        if (!open) setPending(null);
                    }}
                    title={
                        pending?.kind === 'attach'
                            ? `Attach "${pending.name}" as a sub-category?`
                            : `Detach "${pending?.name ?? ''}"?`
                    }
                    description={
                        pending?.kind === 'attach'
                            ? "Its standalone page will be removed on every island - the old URLs stop resolving and the slug stays reserved for 90 days. It becomes a filter-only chip on this category's page. Tours keep their assignment."
                            : 'It becomes a standalone top-level category with its own page on every island. Tours keep their assignment. You can undo this later with "Attach existing category", which removes the page again.'
                    }
                    confirmLabel={
                        pending?.kind === 'attach' ? 'Attach' : 'Detach'
                    }
                    destructive={pending?.kind === 'attach'}
                    loading={isUpdating}
                    onConfirm={confirmPending}
                />
            </CardContent>
        </Card>
    );
}

