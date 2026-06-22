'use client';

import { toast } from 'sonner';
import { useDeleteCategory } from '@/hooks/categories/use-categories';
import type { CategoryLocalized } from '@/types/category';
import { DeactivateDialog } from '@/components/dashboard/common/deactivate-dialog';

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

  function handleConfirm() {
    deleteCategory(category.id, {
      onSuccess: () => {
        toast.success(`"${category.name}" deactivated successfully.`);
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
