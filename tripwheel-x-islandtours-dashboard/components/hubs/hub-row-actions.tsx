'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Delete02Icon, File02Icon, HelpCircleIcon, MoreHorizontalIcon, PencilEdit02Icon, Search01Icon, Tag02Icon, ToggleOffIcon, ToggleOnIcon, TranslateIcon, ViewIcon, ZapIcon } from '@hugeicons/core-free-icons';

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
            <HugeiconsIcon icon={MoreHorizontalIcon} />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => router.push(`/hubs/${hub.id}`)}>
            <HugeiconsIcon icon={ViewIcon} />
            View
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push(`/hubs/${hub.id}/edit`)}>
            <HugeiconsIcon icon={PencilEdit02Icon} />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setQuickEditOpen(true)}>
            <HugeiconsIcon icon={ZapIcon} />
            Quick Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => router.push(`/translations/hub/${hub.id}/es`)}
          >
            <HugeiconsIcon icon={TranslateIcon} />
            Manage Translations
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push(`/hubs/${hub.id}/edit?tab=page-content`)}
          >
            <HugeiconsIcon icon={File02Icon} />
            Page Content
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push(`/hubs/${hub.id}/edit?tab=seo`)}
          >
            <HugeiconsIcon icon={Search01Icon} />
            SEO
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push(`/hubs/${hub.id}/edit?tab=faqs`)}
          >
            <HugeiconsIcon icon={HelpCircleIcon} />
            Manage FAQs
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push(`/hubs/${hub.id}/edit?tab=allowed-categories`)}
          >
            <HugeiconsIcon icon={Tag02Icon} />
            Allowed Categories
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleToggleActive}
            disabled={isPending || hub.isSeeded}
          >
            {hub.isActive ? <HugeiconsIcon icon={ToggleOffIcon} /> : <HugeiconsIcon icon={ToggleOnIcon} />}
            {hub.isActive ? 'Deactivate' : 'Activate'}
          </DropdownMenuItem>
          {can('MANAGE_HUBS') && !hub.isSeeded && hub.isActive && (
            <>
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

      <HubQuickEditDialog hub={hub} open={quickEditOpen} onOpenChange={setQuickEditOpen} />
      <HubDeleteDialog hub={hub} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}
