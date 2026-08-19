'use client';

import { toast } from 'sonner';
import {
  useDeleteCategory,
  useUpdateCategory,
} from '@/hooks/categories/use-categories';
import type { CategoryLocalized } from '@/types/category';
import { DeactivateDialog } from '@/components/common/deactivate-dialog';

interface CategoryDeleteDialogProps {
  category: CategoryLocalized;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CategoryDeleteDialog({
  category,
  open,
  onOpenChange,
  onSuccess,
}: CategoryDeleteDialogProps) {
  const { mutate: deleteCategory, isPending } = useDeleteCategory();
  const { mutate: updateCategory } = useUpdateCategory();

  function handleConfirm() {
    deleteCategory(category.id, {
      onSuccess: () => {
        toast.success(`"${category.name}" deactivated successfully.`, {
          duration: 10_000,
          action: {
            label: 'Undo',
            onClick: () =>
              updateCategory(
                { id: category.id, payload: { isActive: true } },
                {
                  onSuccess: () =>
                    toast.success(`"${category.name}" reactivated.`),
                  onError: (err) =>
                    toast.error(
                      err instanceof Error
                        ? err.message
                        : 'Undo failed - the category is still inactive.',
                    ),
                },
              ),
          },
        });
        onOpenChange(false);
        onSuccess?.();
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to deactivate category.');
      },
    });
  }

  return (
    <DeactivateDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Deactivate Category"
      entityName={category.name}
      preservationNote='The record is preserved in the database - not permanently deleted. This protects its URL slug from being reused, keeps all booking history and featured slot data intact, and preserves all translations. You can restore it at any time by switching the Status filter to "Inactive" and activating it again.'
      onConfirm={handleConfirm}
      isPending={isPending}
    />
  );
}
