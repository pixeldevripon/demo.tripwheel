'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { PlusSignIcon } from '@hugeicons/core-free-icons';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  useAttributes,
  useDeactivateAttribute,
  useUpdateAttribute,
} from '@/hooks/attributes/use-attributes';
import { useRole } from '@/contexts/role-context';
import type { AttributeDefinition } from '@/types/attribute';
import { AttributesTable } from './attributes-table';
import Link from 'next/link';

export function AttributesListView() {
  const { data: attributes, isLoading } = useAttributes();
  const { mutate: deactivate, isPending: deactivating } = useDeactivateAttribute();
  const { mutate: updateAttribute } = useUpdateAttribute();
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
      <AttributesTable
        data={rows}
        canManage={canManage}
        onDeactivate={setTarget}
        actionSlot={
          canManage && (
            <Button asChild size="sm">
              <Link href="/attributes/new">
                <HugeiconsIcon icon={PlusSignIcon} /> Add Attribute
              </Link>
            </Button>
          )
        }
      />

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
                const { key } = target;
                deactivate(key, {
                  onSuccess: () => {
                    toast.success('Attribute deactivated.', {
                      duration: 10_000,
                      action: {
                        label: 'Undo',
                        onClick: () =>
                          updateAttribute(
                            { key, payload: { isActive: true } },
                            {
                              onSuccess: () =>
                                toast.success('Attribute reactivated.'),
                              onError: err =>
                                toast.error(
                                  err instanceof Error
                                    ? err.message
                                    : 'Undo failed - the attribute is still inactive.',
                                ),
                            },
                          ),
                      },
                    });
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
