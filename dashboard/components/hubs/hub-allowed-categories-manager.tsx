'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Delete02Icon, PlusSignIcon, Tag01Icon, Tag02Icon } from '@hugeicons/core-free-icons';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useHubAllowedCategories,
  useAddHubAllowedCategory,
  useRemoveHubAllowedCategory,
} from '@/hooks/hubs/use-hubs';
import { useActiveCategories } from '@/hooks/categories/use-categories';
import type { HubAllowedCategory } from '@/types/hub';

interface AllowedCategoryCardProps {
  item: HubAllowedCategory;
  hubId: string;
}

function AllowedCategoryCard({ item, hubId }: AllowedCategoryCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { mutate: removeCategory, isPending } = useRemoveHubAllowedCategory();
  const { mutate: readdCategory } = useAddHubAllowedCategory();

  function handleRemove() {
    removeCategory(
      { id: hubId, categoryId: item.categoryId },
      {
        onSuccess: () => {
          toast.success(`${item.category.name} removed from allowed categories.`, {
            duration: 10_000,
            action: {
              label: 'Undo',
              onClick: () =>
                readdCategory(
                  { id: hubId, categoryId: item.categoryId },
                  {
                    onSuccess: () =>
                      toast.success(`${item.category.name} re-added to allowed categories.`),
                    onError: (err) =>
                      toast.error(
                        err instanceof Error ? err.message : 'Undo failed - the category was not re-added.',
                      ),
                  }
                ),
            },
          });
          setDeleteOpen(false);
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to remove category.'),
      }
    );
  }

  return (
    <>
      <Card size="sm">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-8 shrink-0 rounded-sm bg-muted flex items-center justify-center">
                <HugeiconsIcon icon={Tag01Icon} className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">{item.category.name}</p>
                <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm">
                  {item.category.slug}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
              onClick={() => setDeleteOpen(true)}
            >
              <HugeiconsIcon icon={Delete02Icon} />
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <HugeiconsIcon icon={Delete02Icon} className="size-8 text-destructive" />
            </AlertDialogMedia>
            <AlertDialogTitle>Remove Category</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{item.category.name}</strong> from this hub&apos;s allowed categories?
              Tours in this category will no longer be assignable to this hub.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={(e) => {
                e.preventDefault();
                handleRemove();
              }}
            >
              {isPending ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface HubAllowedCategoriesManagerProps {
  hubId: string;
}

export function HubAllowedCategoriesManager({ hubId }: HubAllowedCategoriesManagerProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const { data: allowedCategories, isLoading } = useHubAllowedCategories(hubId);
  const { data: allCategories = [], isLoading: isLoadingCategories } = useActiveCategories('en');
  const { mutate: addCategory, isPending: isAdding } = useAddHubAllowedCategory();
  const { mutate: removeCategory } = useRemoveHubAllowedCategory();

  const allowedIds = new Set((allowedCategories ?? []).map((a) => a.categoryId));
  const availableCategories = allCategories.filter((c) => !allowedIds.has(c.id));

  function handleAdd() {
    if (!selectedCategoryId) return;
    const categoryId = selectedCategoryId;
    addCategory(
      { id: hubId, categoryId },
      {
        onSuccess: () => {
          toast.success('Category added to allowed list.', {
            duration: 10_000,
            action: {
              label: 'Undo',
              onClick: () =>
                removeCategory(
                  { id: hubId, categoryId },
                  {
                    onSuccess: () => toast.success('Category removed again.'),
                    onError: (err) =>
                      toast.error(
                        err instanceof Error ? err.message : 'Undo failed - the category is still allowed.',
                      ),
                  }
                ),
            },
          });
          setSelectedCategoryId('');
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to add category.'),
      }
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Label className="mb-2 block">Add Category</Label>
          {isLoadingCategories ? (
            <Skeleton className="h-9 w-full rounded-none" />
          ) : (
            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category to allow..." />
              </SelectTrigger>
              <SelectContent>
                {availableCategories.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                    All categories are already allowed
                  </div>
                ) : (
                  availableCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
        </div>
        <Button
          onClick={handleAdd}
          disabled={!selectedCategoryId || isAdding}
          size="sm"
          className="shrink-0"
        >
          <HugeiconsIcon icon={PlusSignIcon} />
          {isAdding ? 'Adding...' : 'Add'}
        </Button>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <Label>Allowed Categories</Label>
          {allowedCategories && allowedCategories.length > 0 && (
            <Badge variant="secondary">{allowedCategories.length} total</Badge>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-none" />
            ))}
          </div>
        ) : !allowedCategories || allowedCategories.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground border border-dashed rounded-none">
            <HugeiconsIcon icon={Tag02Icon} className="size-10 opacity-40" />
            <p className="text-sm">No categories allowed yet.</p>
            <p className="text-xs">Add categories above to restrict which tour types can be assigned to this hub.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {allowedCategories.map((item) => (
              <AllowedCategoryCard key={item.id} item={item} hubId={hubId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
