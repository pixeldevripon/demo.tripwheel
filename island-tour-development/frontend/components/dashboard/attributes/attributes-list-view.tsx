'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useAttributes, useDeactivateAttribute } from '@/hooks/attributes/use-attributes';
import { useRole } from '@/contexts/role-context';
import type { AttributeDefinition } from '@/types/attribute';

export function AttributesListView() {
  const { data: attributes, isLoading } = useAttributes();
  const { mutate: deactivate, isPending: deactivating } = useDeactivateAttribute();
  const { can } = useRole();
  const canManage = can('MANAGE_SYSTEM');
  const [target, setTarget] = useState<AttributeDefinition | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-none" />
        ))}
      </div>
    );
  }

  const rows = attributes ?? [];

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button asChild size="sm">
            <Link href="/dashboard/attributes/new">
              <PlusIcon /> Add Attribute
            </Link>
          </Button>
        </div>
      )}
      <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Display Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No attributes defined yet.
                </TableCell>
              </TableRow>
            )}
            {rows.map(attr => (
              <TableRow key={attr.id} className={attr.isActive ? undefined : 'opacity-50'}>
                <TableCell className="font-mono text-xs">{attr.key}</TableCell>
                <TableCell className="text-sm">{attr.displayName}</TableCell>
                <TableCell><Badge variant="secondary">{attr.dataType}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {(attr.appliesToCategories ?? []).length === 0
                    ? 'Global'
                    : (attr.appliesToCategories ?? []).join(', ')}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {[attr.isFilterable && 'filter', attr.isSortable && 'sort'].filter(Boolean).join(' · ') || '-'}
                </TableCell>
                <TableCell>
                  {canManage && (
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="icon-xs">
                        <Link href={`/dashboard/attributes/${attr.key}/edit`}>
                          <PencilIcon className="size-3.5" />
                        </Link>
                      </Button>
                      {attr.isActive && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setTarget(attr)}
                        >
                          <Trash2Icon className="size-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <AlertDialog open={!!target} onOpenChange={o => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate attribute?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{target?.displayName}&quot; ({target?.key}) will be deactivated and hidden from
              filters and the per-tour editor. Existing tour values are preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deactivating}
              onClick={() => {
                if (!target) return;
                deactivate(target.key, {
                  onSuccess: () => {
                    toast.success('Attribute deactivated.');
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
      </Card>
    </div>
  );
}
