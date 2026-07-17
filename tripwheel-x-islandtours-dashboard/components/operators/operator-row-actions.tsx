'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Delete02Icon, MoreHorizontalIcon, PencilEdit02Icon, ToggleOffIcon, ToggleOnIcon, ViewIcon } from '@hugeicons/core-free-icons';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { useUpdateOperator } from '@/hooks/operators/use-operators';
import { useRole } from '@/contexts/role-context';
import type { OperatorListItem } from '@/types/operator';
import { OperatorDeleteDialog } from './operator-delete-dialog';

interface OperatorRowActionsProps {
  operator: OperatorListItem;
}

export function OperatorRowActions({ operator }: OperatorRowActionsProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { mutate: updateOperator, isPending } = useUpdateOperator();
  const { can } = useRole();

  const base = `/tour-operators/${operator.id}`;

  function handleToggleActive() {
    updateOperator(
      { id: operator.id, payload: { isActive: !operator.isActive } },
      {
        onSuccess: () => {
          toast.success(`Operator ${!operator.isActive ? 'activated' : 'deactivated'} successfully.`);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to update operator.');
        },
      }
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <HugeiconsIcon icon={MoreHorizontalIcon} />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => router.push(base)}>
            <HugeiconsIcon icon={ViewIcon} />
            View
          </DropdownMenuItem>
          {can('MANAGE_OPERATORS') && (
            <>
              <DropdownMenuItem onClick={() => router.push(`${base}/edit`)}>
                <HugeiconsIcon icon={PencilEdit02Icon} />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleToggleActive} disabled={isPending}>
                {operator.isActive ? <HugeiconsIcon icon={ToggleOffIcon} /> : <HugeiconsIcon icon={ToggleOnIcon} />}
                {operator.isActive ? 'Deactivate' : 'Activate'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                onClick={() => setDeleteOpen(true)}
              >
                <HugeiconsIcon icon={Delete02Icon} />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <OperatorDeleteDialog operator={operator} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}
