'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import {
    Delete02Icon,
    PencilEdit02Icon,
    PlusSignIcon,
} from '@hugeicons/core-free-icons';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useRole } from '@/contexts/role-context';
import {
    useCreateRecommendationCategory,
    useDeleteRecommendationCategory,
    useRecommendationCategories,
    useUpdateRecommendationCategory,
} from '@/hooks/recommendations/use-recommendation-categories';
import { toSlug } from '@/lib/utils';
import type { RecommendationCategory } from '@/types/recommendation';

interface CategoryFormValues {
    name: string;
    slug: string;
    icon: string;
    displayOrder: string;
}

export function RecommendationCategoriesView() {
    const { can } = useRole();
    const canManage = can('MANAGE_EDITORIAL');

    const { data: categories, isLoading } = useRecommendationCategories();
    const { mutate: remove, isPending: removing } =
        useDeleteRecommendationCategory();

    const [editing, setEditing] = useState<RecommendationCategory | null>(null);
    const [creating, setCreating] = useState(false);
    const [deleteTarget, setDeleteTarget] =
        useState<RecommendationCategory | null>(null);

    return (
        <div className='space-y-4'>
            {canManage && (
                <div className='flex justify-end'>
                    <Button size='sm' onClick={() => setCreating(true)}>
                        <HugeiconsIcon icon={PlusSignIcon} />
                        New Category
                    </Button>
                </div>
            )}

            <div className='overflow-hidden rounded-lg border border-line'>
                {isLoading ? (
                    <div className='space-y-2 p-4'>
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className='h-10 w-full' />
                        ))}
                    </div>
                ) : (categories ?? []).length === 0 ? (
                    <p className='px-4 py-8 text-center text-sm text-content-muted'>
                        No categories yet.
                    </p>
                ) : (
                    <table className='w-full text-sm'>
                        <thead>
                            <tr className='border-b border-line bg-surface-sunken/60 text-left text-2xs font-medium tracking-caps uppercase text-content-subtle'>
                                <th className='px-4 py-2.5'>Name</th>
                                <th className='px-4 py-2.5'>Slug</th>
                                <th className='px-4 py-2.5'>Icon</th>
                                <th className='px-4 py-2.5'>Order</th>
                                <th className='px-4 py-2.5 text-right'>
                                    In use
                                </th>
                                <th className='px-4 py-2.5' />
                            </tr>
                        </thead>
                        <tbody>
                            {(categories ?? []).map((c) => (
                                <tr
                                    key={c.id}
                                    className='border-b border-line last:border-0'>
                                    <td className='px-4 py-2.5 font-medium'>
                                        {c.name}
                                    </td>
                                    <td className='px-4 py-2.5 text-content-muted'>
                                        {c.slug}
                                    </td>
                                    <td className='px-4 py-2.5 text-content-muted'>
                                        {c.icon || '-'}
                                    </td>
                                    <td className='px-4 py-2.5 text-content-muted'>
                                        {c.displayOrder}
                                    </td>
                                    <td className='px-4 py-2.5 text-right text-content-muted'>
                                        {c.recommendationCount}
                                    </td>
                                    <td className='px-4 py-2.5'>
                                        {canManage && (
                                            <div className='flex items-center justify-end gap-1'>
                                                <Button
                                                    variant='ghost'
                                                    size='icon-sm'
                                                    onClick={() =>
                                                        setEditing(c)
                                                    }>
                                                    <HugeiconsIcon
                                                        icon={PencilEdit02Icon}
                                                    />
                                                    <span className='sr-only'>
                                                        Edit
                                                    </span>
                                                </Button>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span>
                                                            <Button
                                                                variant='ghost'
                                                                size='icon-sm'
                                                                className='text-destructive hover:text-destructive'
                                                                disabled={
                                                                    c.isSeeded
                                                                }
                                                                onClick={() =>
                                                                    !c.isSeeded &&
                                                                    setDeleteTarget(
                                                                        c,
                                                                    )
                                                                }>
                                                                <HugeiconsIcon
                                                                    icon={
                                                                        Delete02Icon
                                                                    }
                                                                />
                                                                <span className='sr-only'>
                                                                    Delete
                                                                </span>
                                                            </Button>
                                                        </span>
                                                    </TooltipTrigger>
                                                    {c.isSeeded && (
                                                        <TooltipContent>
                                                            Seeded categories
                                                            cannot be deleted.
                                                        </TooltipContent>
                                                    )}
                                                </Tooltip>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Create / edit share one dialog form. */}
            <CategoryDialog
                open={creating}
                onOpenChange={setCreating}
                mode='create'
            />
            <CategoryDialog
                open={!!editing}
                onOpenChange={(o) => !o && setEditing(null)}
                mode='edit'
                category={editing ?? undefined}
            />

            <AlertDialog
                open={!!deleteTarget}
                onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete this category?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            &ldquo;{deleteTarget?.name}&rdquo; will be deleted.
                            {deleteTarget && deleteTarget.recommendationCount > 0
                                ? ' The recommendations in it become uncategorised.'
                                : ''}{' '}
                            This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={removing}
                            onClick={() => {
                                if (!deleteTarget) return;
                                remove(deleteTarget.id, {
                                    onSuccess: () => {
                                        toast.success('Category deleted');
                                        setDeleteTarget(null);
                                    },
                                    onError: (err) => toast.error(err.message),
                                });
                            }}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function CategoryDialog({
    open,
    onOpenChange,
    mode,
    category,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: 'create' | 'edit';
    category?: RecommendationCategory;
}) {
    const isEdit = mode === 'edit';
    const { mutate: create, isPending: creating } =
        useCreateRecommendationCategory();
    const { mutate: update, isPending: updating } =
        useUpdateRecommendationCategory();
    const isPending = creating || updating;

    const {
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
        formState: { errors },
    } = useForm<CategoryFormValues>({
        defaultValues: { name: '', slug: '', icon: '', displayOrder: '0' },
    });

    // Reseed when the dialog opens (or the target category changes).
    useEffect(() => {
        if (!open) return;
        reset({
            name: category?.name ?? '',
            slug: category?.slug ?? '',
            icon: category?.icon ?? '',
            displayOrder: String(category?.displayOrder ?? 0),
        });
        setSlugTouched(false);
    }, [open, category, reset]);

    const nameValue = watch('name');
    const [slugTouched, setSlugTouched] = useState(false);
    useEffect(() => {
        if (!isEdit && !slugTouched) {
            setValue('slug', toSlug(nameValue), {
                shouldValidate: !!nameValue,
            });
        }
    }, [nameValue, isEdit, slugTouched, setValue]);

    function onSubmit(v: CategoryFormValues) {
        const onError = (err: unknown) =>
            toast.error(
                err instanceof Error
                    ? err.message
                    : 'Failed to save the category.',
            );
        const displayOrder = Number(v.displayOrder.trim() || '0');
        const icon = v.icon.trim() || null;

        if (isEdit && category) {
            update(
                {
                    categoryId: category.id,
                    payload: {
                        name: v.name.trim(),
                        slug: v.slug.trim(),
                        icon,
                        displayOrder,
                    },
                },
                {
                    onSuccess: () => {
                        toast.success('Category updated.');
                        onOpenChange(false);
                    },
                    onError,
                },
            );
            return;
        }

        create(
            {
                name: v.name.trim(),
                slug: v.slug.trim() || undefined,
                icon,
                displayOrder,
            },
            {
                onSuccess: () => {
                    toast.success('Category created.');
                    onOpenChange(false);
                },
                onError,
            },
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? 'Edit Category' : 'New Category'}
                    </DialogTitle>
                    <DialogDescription>
                        Categories group recommendations on the page (Hotels,
                        Restaurants, Shops, ...).
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
                    <Field>
                        <Label>
                            Name <span className='text-destructive'>*</span>
                        </Label>
                        <Input
                            {...register('name', {
                                validate: (v) =>
                                    !!v.trim() || 'A name is required',
                            })}
                            placeholder='e.g. Restaurants'
                            aria-invalid={!!errors.name}
                        />
                        <FieldError>{errors.name?.message}</FieldError>
                    </Field>

                    <Field>
                        <Label>
                            Slug <span className='text-destructive'>*</span>
                        </Label>
                        <Input
                            {...register('slug', {
                                validate: (v) =>
                                    /^[a-z0-9-]+$/.test(v.trim()) ||
                                    'Lowercase letters, numbers and hyphens only',
                            })}
                            placeholder='e.g. restaurants'
                            aria-invalid={!!errors.slug}
                            onChange={(e) => {
                                setSlugTouched(true);
                                setValue('slug', e.target.value, {
                                    shouldValidate: true,
                                });
                            }}
                        />
                        <FieldDescription>
                            {isEdit
                                ? 'Used to group picks. Renaming re-buckets them under the new slug.'
                                : 'Auto-generated from the name, but you can customise it.'}
                        </FieldDescription>
                        <FieldError>{errors.slug?.message}</FieldError>
                    </Field>

                    <div className='grid gap-4 sm:grid-cols-2'>
                        <Field>
                            <Label>Icon</Label>
                            <Input
                                {...register('icon')}
                                placeholder='e.g. utensils'
                            />
                            <FieldDescription>
                                Optional icon name for the section heading.
                            </FieldDescription>
                        </Field>
                        <Field>
                            <Label>Display order</Label>
                            <Input
                                type='number'
                                min='0'
                                step='1'
                                {...register('displayOrder')}
                                placeholder='0'
                            />
                            <FieldDescription>
                                Lower categories appear first.
                            </FieldDescription>
                        </Field>
                    </div>

                    <DialogFooter>
                        <Button
                            type='button'
                            variant='outline'
                            onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type='submit' disabled={isPending}>
                            {isPending
                                ? 'Saving...'
                                : isEdit
                                  ? 'Save Changes'
                                  : 'Create Category'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
