'use client';

import { PlusSignIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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

/**
 * Parent-centric sub-category manager (dashboard). Lists a category's children
 * and lets an admin add new ones or detach existing ones - all from the parent's
 * edit page. Sub-categories are FILTER-ONLY (no standalone page): they surface as
 * refine chips on the parent's category page. Single-level only, so this manager
 * is rendered only for top-level categories.
 */
export function CategorySubcategoriesManager({ parent }: Props) {
    const { can } = useRole();
    const canCreate = can('CREATE_CATEGORY');
    const canEdit = can('EDIT_CATEGORY');

    const { data: allCategories, isLoading } = useActiveCategories('en');
    const { mutate: createCategory, isPending: isCreating } =
        useCreateCategory();
    const { mutate: updateCategory, isPending: isDetaching } =
        useUpdateCategory();

    const [name, setName] = useState('');

    const children = (allCategories ?? []).filter(
        c => c.parentCategoryId === parent.id
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

    function handleDetach(childId: string, childName: string) {
        updateCategory(
            { id: childId, payload: { parentCategoryId: null } },
            {
                onSuccess: () =>
                    toast.success(
                        `"${childName}" detached - it is now a top-level category.`
                    ),
                onError: err =>
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to detach sub-category.'
                    ),
            }
        );
    }

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
                                        disabled={isDetaching}
                                        onClick={() =>
                                            handleDetach(child.id, child.name)
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
                            Creates a brand-new filter-only sub-category.
                            Existing top-level categories are never pulled in
                            here, so their pages stay intact.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

