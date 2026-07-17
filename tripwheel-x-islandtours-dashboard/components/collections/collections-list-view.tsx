'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { PlusSignIcon } from '@hugeicons/core-free-icons';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useActiveDestinations } from '@/hooks/destinations/use-destinations';
import { useCollectionsByDestination, useDeleteCollection } from '@/hooks/collections/use-collections';
import { useRole } from '@/contexts/role-context';
import type { Collection } from '@/types/collection';
import { CollectionsTable } from './collections-table';

export function CollectionsListView() {
  const { can } = useRole();
  const { data: destinations } = useActiveDestinations();
  const [destSlug, setDestSlug] = useState<string>('');

  // Default to the first destination once loaded. Setting state during render (guarded so it
  // runs only while no destination is selected) is React's sanctioned alternative to a
  // setState-in-effect, which the repo's eslint config flags as an error.
  if (!destSlug && destinations && destinations.length > 0) {
    setDestSlug(destinations[0].slug);
  }

  const { data: collections, isLoading } = useCollectionsByDestination(destSlug || undefined);
  const { mutate: remove, isPending: removing } = useDeleteCollection();
  const [target, setTarget] = useState<Collection | null>(null);

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-none" />
          ))}
        </div>
      ) : (
        <CollectionsTable
          data={collections ?? []}
          canEdit={can('EDIT_COLLECTION')}
          canDelete={can('DELETE_COLLECTION')}
          onDeactivate={setTarget}
          filterSlot={
            <Select value={destSlug} onValueChange={setDestSlug}>
              <SelectTrigger className="w-48 shrink-0">
                <SelectValue placeholder="Destination" />
              </SelectTrigger>
              <SelectContent>
                {(destinations ?? []).map(d => (
                  <SelectItem key={d.id} value={d.slug}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
          actionSlot={
            can('CREATE_COLLECTION') && (
              <Button asChild size="sm">
                <Link href="/collections/new">
                  <HugeiconsIcon icon={PlusSignIcon} /> New Collection
                </Link>
              </Button>
            )
          }
        />
      )}


      <AlertDialog open={!!target} onOpenChange={o => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate collection?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{target?.name}&quot; will be hidden from the public site. The record and its slug are preserved.
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
                    toast.success('Collection deactivated.');
                    setTarget(null);
                  },
                  onError: err => toast.error(err instanceof Error ? err.message : 'Failed.'),
                });
              }}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
