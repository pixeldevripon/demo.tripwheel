'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

export function CollectionsListView() {
  const { can } = useRole();
  const { data: destinations } = useActiveDestinations();
  const [destSlug, setDestSlug] = useState<string>('');

  // Default to the first destination once loaded
  useEffect(() => {
    if (!destSlug && destinations && destinations.length > 0) {
      setDestSlug(destinations[0].slug);
    }
  }, [destinations, destSlug]);

  const { data: collections, isLoading } = useCollectionsByDestination(destSlug || undefined);
  const { mutate: remove, isPending: removing } = useDeleteCollection();
  const [target, setTarget] = useState<Collection | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Label className="text-xs font-semibold uppercase">Destination</Label>
          <Select value={destSlug} onValueChange={setDestSlug}>
            <SelectTrigger className="mt-1 w-64">
              <SelectValue placeholder="Select a destination" />
            </SelectTrigger>
            <SelectContent>
              {(destinations ?? []).map(d => (
                <SelectItem key={d.id} value={d.slug}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {can('CREATE_COLLECTION') && (
          <Button asChild size="sm">
            <Link href="/dashboard/collections/new">
              <PlusIcon /> Add Collection
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-none" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Tours</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(collections ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      No collections for this destination yet.
                    </TableCell>
                  </TableRow>
                )}
                {(collections ?? []).map(c => (
                  <TableRow key={c.id} className={c.isActive ? undefined : 'opacity-50'}>
                    <TableCell className="text-sm font-medium">{c.name}</TableCell>
                    <TableCell><Badge variant="secondary">{c.collectionType}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.collectionType === 'MANUAL' ? `${(c.tourIds ?? []).length} tours` : 'dynamic'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.isActive ? 'default' : 'outline'}>
                        {c.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {can('EDIT_COLLECTION') && (
                          <Button asChild variant="ghost" size="icon-xs">
                            <Link href={`/dashboard/collections/${c.id}/edit`}>
                              <PencilIcon className="size-3.5" />
                            </Link>
                          </Button>
                        )}
                        {can('DELETE_COLLECTION') && c.isActive && (
                          <Button variant="ghost" size="icon-xs" onClick={() => setTarget(c)}>
                            <Trash2Icon className="size-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
