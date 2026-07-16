'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldError } from '@/components/ui/field';
import { useUpdateCategory } from '@/hooks/categories/use-categories';
import type { CategoryLocalized } from '@/types/category';

const quickEditSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  heroImage: z.string().refine((v) => v === '' || (() => { try { new URL(v); return true; } catch { return false; } })(), 'Must be a valid URL').optional(),
  isActive: z.boolean(),
});

type QuickEditFormValues = z.infer<typeof quickEditSchema>;

interface CategoryQuickEditDialogProps {
  category: CategoryLocalized;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CategoryQuickEditDialog({
  category,
  open,
  onOpenChange,
}: CategoryQuickEditDialogProps) {
  const { mutate: updateCategory, isPending } = useUpdateCategory();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<QuickEditFormValues>({
    resolver: zodResolver(quickEditSchema),
    defaultValues: {
      name: category.name,
      heroImage: category.heroImage ?? '',
      isActive: category.isActive,
    },
  });

  const isActiveValue = watch('isActive');

  useEffect(() => {
    if (open) {
      reset({
        name: category.name,
        heroImage: category.heroImage ?? '',
        isActive: category.isActive,
      });
    }
  }, [open, category, reset]);

  function onSubmit(values: QuickEditFormValues) {
    updateCategory(
      {
        id: category.id,
        payload: {
          name: values.name,
          heroImage: values.heroImage || null,
          isActive: values.isActive,
        },
      },
      {
        onSuccess: () => {
          toast.success('Category updated successfully.');
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to update category.');
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quick Edit</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field>
            <Label className="text-xs font-semibold uppercase">Name</Label>
            <Input {...register('name')} placeholder="Category name" aria-invalid={!!errors.name} />
            <FieldError>{errors.name?.message}</FieldError>
          </Field>

          <Field>
            <Label className="text-xs font-semibold uppercase">Hero Image URL</Label>
            <Input
              {...register('heroImage')}
              placeholder="https://example.com/image.jpg"
              aria-invalid={!!errors.heroImage}
            />
            <FieldError>{errors.heroImage?.message}</FieldError>
          </Field>

          <Field>
            <div className="flex items-center gap-2">
              <Checkbox
                id="isActive"
                checked={isActiveValue}
                onCheckedChange={(checked) => setValue('isActive', !!checked)}
              />
              <Label htmlFor="isActive" className="text-xs font-semibold uppercase cursor-pointer">
                Active
              </Label>
            </div>
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
