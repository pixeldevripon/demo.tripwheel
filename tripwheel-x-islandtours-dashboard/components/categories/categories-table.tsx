'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { PlusSignIcon, Tag01Icon } from '@hugeicons/core-free-icons';

import Link from 'next/link';
import { toast } from 'sonner';
import { DataTable } from '@/components/data-table/data-table';
import {
  DataTableActions,
} from '@/components/data-table/data-table-toolbar';
import { TableSearchInput } from '@/components/table-search-input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { categoryColumns } from './category-columns';
import {
  useUpdateCategory,
  useDeleteCategory,
} from '@/hooks/categories/use-categories';
import { useRole } from '@/contexts/role-context';
import type { CategoryWithSubs } from '@/types/category';

interface CategoriesTableProps {
  data: CategoryWithSubs[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onFilterChange: (key: string, value: string | undefined) => void;
  filters?: Record<string, string | undefined>;
}

export function CategoriesTable({
  data,
  total,
  page,
  limit,
  isLoading,
  onPageChange,
  onLimitChange,
  onFilterChange,
  filters = {},
}: CategoriesTableProps) {
  const { mutate: updateCategory } = useUpdateCategory();
  const { mutate: deleteCategory } = useDeleteCategory();
  const { can } = useRole();

  // Default view is ACTIVE (matches the old table). 'all' is explicit so the
  // URL can express it; absence means the default.
  const statusValue =
    filters.isActive === 'false'
      ? 'inactive'
      : filters.isActive === 'all'
        ? 'all'
        : 'active';

  const addButton = can('CREATE_CATEGORY') && (
    <Button asChild size='sm'>
      <Link href='/categories/new'>
        <HugeiconsIcon icon={PlusSignIcon} />
        Add Category
      </Link>
    </Button>
  );

  return (
    <DataTable
      columns={categoryColumns}
      data={data}
      isLoading={isLoading}
      pagination={{ total, page, limit, onPageChange, onLimitChange }}
      empty={{
        icon: Tag01Icon,
        title: 'No categories found.',
        description: 'Add your first category to get started.',
        action: addButton,
      }}
      toolbar={(table) => (
        <>
          <TableSearchInput
            value={(table.getState().globalFilter as string) ?? ''}
            onValueChange={table.setGlobalFilter}
            placeholder='Search categories...'
          />
          <Select
            value={statusValue}
            onValueChange={(v) =>
              onFilterChange(
                'isActive',
                v === 'all' ? 'all' : v === 'active' ? undefined : 'false',
              )
            }
          >
            <SelectTrigger className='w-36 shrink-0'>
              <SelectValue placeholder='Status' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Status</SelectItem>
              <SelectItem value='active'>Active</SelectItem>
              <SelectItem value='inactive'>Inactive</SelectItem>
            </SelectContent>
          </Select>
          <DataTableActions>
            {addButton}
          </DataTableActions>
        </>
      )}
      bulkActions={(rows, clearSelection) => (
        <>
          <Button
            size='sm'
            variant='outline'
            onClick={() => {
              rows.forEach((r) =>
                updateCategory(
                  { id: r.original.id, payload: { isActive: true } },
                  {
                    onError: (err) =>
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : 'Failed to activate.',
                      ),
                  },
                ),
              );
              toast.success(`${rows.length} category(s) activated.`);
              clearSelection();
            }}
          >
            Activate
          </Button>
          <Button
            size='sm'
            variant='outline'
            onClick={() => {
              rows.forEach((r) =>
                updateCategory(
                  { id: r.original.id, payload: { isActive: false } },
                  {
                    onError: (err) =>
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : 'Failed to deactivate.',
                      ),
                  },
                ),
              );
              toast.success(`${rows.length} category(s) deactivated.`);
              clearSelection();
            }}
          >
            Deactivate
          </Button>
          {can('DELETE_CATEGORY') && (
            <Button
              size='sm'
              variant='destructive'
              onClick={() => {
                const deletable = rows.filter((r) => !r.original.isSeeded);
                if (deletable.length === 0) {
                  toast.error(
                    'No deletable categories selected. Seeded categories are protected.',
                  );
                  return;
                }
                deletable.forEach((r) =>
                  deleteCategory(r.original.id, {
                    onError: (err) =>
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : 'Failed to delete.',
                      ),
                  }),
                );
                toast.success(`${deletable.length} category(s) deleted.`);
                clearSelection();
              }}
            >
              Delete
            </Button>
          )}
        </>
      )}
    />
  );
}
