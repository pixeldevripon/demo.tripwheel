'use client';

import { ImageSelectorField } from '@/components/media/image-selector-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useActiveCategories,
  useCreateCategory,
  useUpdateCategory,
} from '@/hooks/categories/use-categories';
import type { CategoryDetail } from '@/types/category';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldAlertIcon, Trash2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { CategoryDeleteDialog } from './category-delete-dialog';
import { CategoryIconPicker } from './category-icon-picker';
import { useRole } from '@/contexts/role-context';

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

const categorySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z.string().min(2, 'Slug must be at least 2 characters').regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens'),
  heroImage: z.string().optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  sortOrder: z
    .string()
    .optional()
    .refine(v => !v || (!isNaN(Number(v)) && Number(v) >= 0), 'Must be 0 or greater'),
  parentCategoryId: z.string().optional(),
  isActive: z.boolean().optional(),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

interface CategoryFormProps {
  category?: CategoryDetail;
  onSuccess?: (category: CategoryDetail) => void;
}

export function CategoryForm({ category, onSuccess }: CategoryFormProps) {
  const router = useRouter();
  const isEditMode = !!category;
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { mutate: createCategory, isPending: isCreating } = useCreateCategory();
  const { mutate: updateCategory, isPending: isUpdating } = useUpdateCategory();
  const isPending = isCreating || isUpdating;
  const { can } = useRole();

  const { data: activeCategories } = useActiveCategories();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name ?? '',
      slug: category?.slug ?? '',
      heroImage: category?.heroImage ?? '',
      description: category?.description ?? '',
      icon: category?.icon ?? '',
      sortOrder: category?.sortOrder?.toString() ?? '0',
      parentCategoryId: category?.parentCategoryId ?? '',
      isActive: category?.isActive ?? true,
    },
  });

  const heroImageValue = watch('heroImage');
  const iconValue = watch('icon');
  const parentValue = watch('parentCategoryId');
  const isActiveValue = watch('isActive');
  const nameValue = watch('name');

  // Only top-level categories may be parents (single-level nesting): exclude self
  // and any category that already has a parent.
  const parentOptions = (activeCategories ?? []).filter(
    c => c.id !== category?.id && !c.parentCategoryId,
  );

  const [slugTouched, setSlugTouched] = useState(false);
  useEffect(() => {
    if (!isEditMode && !slugTouched) {
      setValue('slug', toSlug(nameValue), { shouldValidate: !!nameValue });
    }
  }, [nameValue, isEditMode, slugTouched, setValue]);

  function onSubmit(values: CategoryFormValues) {
    if (isEditMode && category) {
      updateCategory(
        {
          id: category.id,
          payload: {
            name: values.name,
            slug: values.slug,
            heroImage: values.heroImage || null,
            description: values.description || null,
            icon: values.icon || null,
            sortOrder: values.sortOrder ? Number(values.sortOrder) : 0,
            parentCategoryId: values.parentCategoryId || null,
            isActive: values.isActive,
          },
        },
        {
          onSuccess: (updated) => {
            toast.success('Category updated successfully.');
            onSuccess?.(updated);
          },
          onError: (err) => {
            toast.error(
              err instanceof Error ? err.message : 'Failed to update category.'
            );
          },
        }
      );
    } else {
      createCategory(
        {
          name: values.name,
          slug: values.slug,
          heroImage: values.heroImage || null,
          description: values.description || null,
          icon: values.icon || null,
          sortOrder: values.sortOrder ? Number(values.sortOrder) : 0,
          parentCategoryId: values.parentCategoryId || null,
        },
        {
          onSuccess: (created) => {
            toast.success('Category created successfully.');
            onSuccess?.(created);
            router.push(`/categories/${created.id}/edit`);
          },
          onError: (err) => {
            toast.error(
              err instanceof Error ? err.message : 'Failed to create category.'
            );
          },
        }
      );
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b pb-8">
          <CardTitle>Category Details</CardTitle>
        </CardHeader>
        <CardContent className="pt-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Field>
              <Label className="text-xs font-semibold uppercase">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                {...register('name')}
                placeholder="e.g. Boat Tours"
                aria-invalid={!!errors.name}
              />
              <FieldError>{errors.name?.message}</FieldError>
            </Field>

            <Field>
              <Label className="text-xs font-semibold uppercase">
                Slug <span className="text-destructive">*</span>
              </Label>
              <Input
                {...register('slug')}
                placeholder="e.g. boat-tours"
                aria-invalid={!!errors.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setValue('slug', e.target.value, { shouldValidate: true });
                }}
              />
              <FieldDescription>
                {isEditMode
                  ? 'Renaming the slug issues an automatic 301 redirect in every destination. The old slug is reserved for a 90-day cooldown before it can be reused.'
                  : 'Used in the URL. Auto-generated from the name, but you can customise it.'}
              </FieldDescription>
              <FieldError>{errors.slug?.message}</FieldError>
            </Field>

            <Field>
              <Label className="text-xs font-semibold uppercase">
                Hero Image
              </Label>
              <FieldDescription>
                Category&apos;s hero banner image. Select from your media library.
              </FieldDescription>
              <ImageSelectorField
                value={heroImageValue || null}
                onChange={url =>
                  setValue('heroImage', url ?? '', { shouldValidate: true })
                }
              />
              <FieldError>{errors.heroImage?.message}</FieldError>
            </Field>

            <Field>
              <Label className="text-xs font-semibold uppercase">Description</Label>
              <Textarea {...register('description')} rows={3} placeholder="Short category description" />
            </Field>

            <div className="grid gap-6 sm:grid-cols-2">
              <Field>
                <Label className="text-xs font-semibold uppercase">Icon</Label>
                <CategoryIconPicker
                  value={iconValue || null}
                  onChange={name => setValue('icon', name ?? '')}
                />
                <FieldDescription>Pick a Lucide icon for this category.</FieldDescription>
              </Field>
              <Field>
                <Label className="text-xs font-semibold uppercase">Sort Order</Label>
                <Input type="number" min={0} {...register('sortOrder')} placeholder="0" aria-invalid={!!errors.sortOrder} />
                <FieldError>{errors.sortOrder?.message}</FieldError>
              </Field>
            </div>

            {/* Parent is chosen only at CREATE time: a brand-new category can be
                made a filter-only sub-category, but an existing top-level category
                is never demoted (that would break its page). Re-parenting happens
                via the parent's Sub-categories manager (create / detach). */}
            {!isEditMode && (
              <Field>
                <Label className="text-xs font-semibold uppercase">Parent Category</Label>
                <Select
                  value={parentValue || '__none__'}
                  onValueChange={v =>
                    setValue('parentCategoryId', v === '__none__' ? '' : v)
                  }>
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {parentOptions.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Optional. Setting a parent makes this a filter-only sub-category
                  (no standalone page).
                </FieldDescription>
              </Field>
            )}

            {isEditMode && (
              <Field>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="isActive"
                    checked={isActiveValue}
                    onCheckedChange={(checked) => setValue('isActive', !!checked)}
                  />
                  <Label
                    htmlFor="isActive"
                    className="text-xs font-semibold uppercase cursor-pointer">
                    Active
                  </Label>
                </div>
                <FieldDescription>
                  Inactive categories are hidden from the public site.
                </FieldDescription>
              </Field>
            )}

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? isEditMode
                    ? 'Saving...'
                    : 'Creating...'
                  : isEditMode
                    ? 'Save Changes'
                    : 'Create Category'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {isEditMode && category && can('DELETE_CATEGORY') && (
        <Card className="border-destructive/30 ring-destructive/10">
          <CardHeader className="border-b pb-8">
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent className="pt-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Deactivate this category</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Hides this category from the public site. The record is preserved to protect
                  its URL slug (90-day reuse cooldown) and booking history.
                </p>
                {category.isSeeded && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-warning-fg">
                    <ShieldAlertIcon className="size-4 shrink-0" />
                    <span>This is a seeded category and is protected from deletion.</span>
                  </div>
                )}
              </div>
              <div className="shrink-0">
                {category.isSeeded ? (
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary">Protected</Badge>
                  </div>
                ) : (
                  <Button
                    variant="destructive"
                    size="sm"
                    type="button"
                    onClick={() => setDeleteOpen(true)}>
                    <Trash2Icon />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isEditMode && category && can('DELETE_CATEGORY') && (
        <CategoryDeleteDialog
          category={category}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onSuccess={() => router.push('/categories')}
        />
      )}
    </div>
  );
}
