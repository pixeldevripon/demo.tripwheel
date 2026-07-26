'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { PlusSignIcon } from '@hugeicons/core-free-icons';

import { useState } from 'react';
import Link from 'next/link';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useRole } from '@/contexts/role-context';
import {
  useDeletePage,
  usePages,
  useUpdatePageStatus,
} from '@/hooks/pages/use-pages';
import type { PageListItem } from '@/types/pages';
import { PagesTable } from './pages-table';

export function PagesListView() {
  const { can } = useRole();
  const canManage = can('MANAGE_EDITORIAL');

  const { data: pages, isLoading } = usePages();
  const { mutate: setStatus } = useUpdatePageStatus();
  const { mutate: remove, isPending: removing } = useDeletePage();
  const [target, setTarget] = useState<PageListItem | null>(null);

  const togglePublish = (page: PageListItem) => {
    const next = page.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    setStatus(
      { id: page.id, status: next },
      {
        onSuccess: () =>
          toast.success(
            next === 'PUBLISHED'
              ? `"${page.title ?? page.slug}" is live at /${page.slug}`
              : `"${page.title ?? page.slug}" unpublished - the URL now 404s`,
          ),
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-none" />
          ))}
        </div>
      ) : (
        <PagesTable
          data={pages ?? []}
          canManage={canManage}
          onPublishToggle={togglePublish}
          onDelete={setTarget}
          actionSlot={
            canManage ? (
              <Button asChild size="sm">
                <Link href="/pages/new">
                  <HugeiconsIcon icon={PlusSignIcon} />
                  New Page
                </Link>
              </Button>
            ) : undefined
          }
        />
      )}

      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this page?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{target?.title ?? target?.slug}&rdquo; and its content will
              be permanently deleted, along with any redirects pointing at it.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={removing}
              onClick={() => {
                if (!target) return;
                remove(target.id, {
                  onSuccess: () => {
                    toast.success('Page deleted');
                    setTarget(null);
                  },
                  onError: (err) => toast.error(err.message),
                });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
