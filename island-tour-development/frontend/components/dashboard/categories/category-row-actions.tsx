'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  EyeIcon,
  PencilIcon,
  Zap,
  LanguagesIcon,
  FileTextIcon,
  HelpCircleIcon,
  ToggleLeftIcon,
  ToggleRightIcon,
  Trash2Icon,
  MoreHorizontalIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useUpdateCategory } from '@/hooks/categories/use-categories';
import { useRole } from '@/contexts/role-context';
import type { CategoryLocalized } from '@/types/category';
import { CategoryQuickEditDialog } from './category-quick-edit-dialog';
import { CategoryDeleteDialog } from './category-delete-dialog';

interface CategoryRowActionsProps {
  category: CategoryLocalized;
}

export function CategoryRowActions({ category }: CategoryRowActionsProps) {
  const router = useRouter();
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { mutate: updateCategory, isPending } = useUpdateCategory();
  const { can } = useRole();

  function handleToggleActive() {
    updateCategory(
      { id: category.id, payload: { isActive: !category.isActive } },
      {
        onSuccess: () => {
          toast.success(
            `Category ${!category.isActive ? 'activated' : 'deactivated'} successfully.`
          );
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to update category.');
        },
      }
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <MoreHorizontalIcon />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => router.push(`/dashboard/categories/${category.id}`)}>
            <EyeIcon />
            View
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push(`/dashboard/categories/${category.id}/edit`)}>
            <PencilIcon />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setQuickEditOpen(true)}>
            <Zap />
            Quick Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => router.push(`/dashboard/categories/${category.id}/translations`)}
          >
            <LanguagesIcon />
            Manage Translations
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push(`/dashboard/categories/${category.id}/page-content`)}
          >
            <FileTextIcon />
            Page Content
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push(`/dashboard/categories/${category.id}/faqs`)}
          >
            <HelpCircleIcon />
            Manage FAQs
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleToggleActive}
            disabled={isPending || category.isSeeded}
          >
            {category.isActive ? <ToggleLeftIcon /> : <ToggleRightIcon />}
            {category.isActive ? 'Deactivate' : 'Activate'}
          </DropdownMenuItem>
          {can('DELETE_CATEGORY') && !category.isSeeded && category.isActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2Icon />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <CategoryQuickEditDialog
        category={category}
        open={quickEditOpen}
        onOpenChange={setQuickEditOpen}
      />

      <CategoryDeleteDialog
        category={category}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
