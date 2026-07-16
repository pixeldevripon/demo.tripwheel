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
  SearchIcon,
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
import { useUpdateCategory, useForceDeleteCategory } from '@/hooks/categories/use-categories';
import { useRole } from '@/contexts/role-context';
import type { CategoryLocalized } from '@/types/category';
import { CategoryQuickEditDialog } from './category-quick-edit-dialog';
import { CategoryDeleteDialog } from './category-delete-dialog';
import { ForceDeleteDialog } from '@/components/common/force-delete-dialog';

interface CategoryRowActionsProps {
  category: CategoryLocalized;
}

export function CategoryRowActions({ category }: CategoryRowActionsProps) {
  const router = useRouter();
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [forceDeleteOpen, setForceDeleteOpen] = useState(false);
  const { mutate: updateCategory, isPending } = useUpdateCategory();
  const { mutate: forceDeleteCategory, isPending: isForceDeleting } = useForceDeleteCategory();
  const { can, role } = useRole();

  function handleForceDelete() {
    forceDeleteCategory(category.id, {
      onSuccess: () => {
        toast.success(`"${category.name}" permanently deleted.`);
        setForceDeleteOpen(false);
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to delete category.'),
    });
  }

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
            onClick={() =>
              router.push(`/dashboard/categories/${category.id}/edit?tab=translations`)
            }
          >
            <LanguagesIcon />
            Manage Translations
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              router.push(`/dashboard/categories/${category.id}/edit?tab=page-content`)
            }
          >
            <FileTextIcon />
            Page Content
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push(`/dashboard/categories/${category.id}/edit?tab=faqs`)}
          >
            <HelpCircleIcon />
            Manage FAQs
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push(`/dashboard/categories/${category.id}/edit?tab=seo`)}
          >
            <SearchIcon />
            SEO
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
                Deactivate
              </DropdownMenuItem>
            </>
          )}
          {role === 'ADMIN' && !category.isSeeded && !category.isActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                onClick={() => setForceDeleteOpen(true)}
              >
                <Trash2Icon />
                Force Delete
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

      <ForceDeleteDialog
        open={forceDeleteOpen}
        onOpenChange={setForceDeleteOpen}
        title="Force Delete Category"
        entityName={category.name}
        consequenceNote="All translations, FAQs, page content, featured slot data, and slug registry entries for this category will be permanently removed across all destinations."
        onConfirm={handleForceDelete}
        isPending={isForceDeleting}
        confirmLabel="Force Delete Category"
      />
    </>
  );
}
