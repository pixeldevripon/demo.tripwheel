'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  EyeIcon,
  PencilIcon,
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
            <MoreHorizontalIcon />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => router.push(base)}>
            <EyeIcon />
            View
          </DropdownMenuItem>
          {can('MANAGE_OPERATORS') && (
            <>
              <DropdownMenuItem onClick={() => router.push(`${base}/edit`)}>
                <PencilIcon />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleToggleActive} disabled={isPending}>
                {operator.isActive ? <ToggleLeftIcon /> : <ToggleRightIcon />}
                {operator.isActive ? 'Deactivate' : 'Activate'}
              </DropdownMenuItem>
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

      <OperatorDeleteDialog operator={operator} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}
