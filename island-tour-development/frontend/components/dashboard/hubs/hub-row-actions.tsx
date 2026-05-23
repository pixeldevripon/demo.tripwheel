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
  TagsIcon,
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
import { useUpdateHub } from '@/hooks/hubs/use-hubs';
import { useRole } from '@/contexts/role-context';
import type { HubLocalized } from '@/types/hub';
import { HubQuickEditDialog } from './hub-quick-edit-dialog';
import { HubDeleteDialog } from './hub-delete-dialog';

interface HubRowActionsProps {
  hub: HubLocalized;
}

export function HubRowActions({ hub }: HubRowActionsProps) {
  const router = useRouter();
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { mutate: updateHub, isPending } = useUpdateHub();
  const { can } = useRole();

  function handleToggleActive() {
    updateHub(
      { id: hub.id, payload: { isActive: !hub.isActive } },
      {
        onSuccess: () => {
          toast.success(`Hub ${!hub.isActive ? 'activated' : 'deactivated'} successfully.`);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to update hub.');
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
          <DropdownMenuItem onClick={() => router.push(`/dashboard/hubs/${hub.id}`)}>
            <EyeIcon />
            View
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push(`/dashboard/hubs/${hub.id}/edit`)}>
            <PencilIcon />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setQuickEditOpen(true)}>
            <Zap />
            Quick Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => router.push(`/dashboard/hubs/${hub.id}/translations`)}
          >
            <LanguagesIcon />
            Manage Translations
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push(`/dashboard/hubs/${hub.id}/page-content`)}
          >
            <FileTextIcon />
            Page Content
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push(`/dashboard/hubs/${hub.id}/faqs`)}
          >
            <HelpCircleIcon />
            Manage FAQs
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push(`/dashboard/hubs/${hub.id}/allowed-categories`)}
          >
            <TagsIcon />
            Allowed Categories
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleToggleActive}
            disabled={isPending || hub.isSeeded}
          >
            {hub.isActive ? <ToggleLeftIcon /> : <ToggleRightIcon />}
            {hub.isActive ? 'Deactivate' : 'Activate'}
          </DropdownMenuItem>
          {can('MANAGE_HUBS') && !hub.isSeeded && hub.isActive && (
            <>
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

      <HubQuickEditDialog hub={hub} open={quickEditOpen} onOpenChange={setQuickEditOpen} />
      <HubDeleteDialog hub={hub} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}
