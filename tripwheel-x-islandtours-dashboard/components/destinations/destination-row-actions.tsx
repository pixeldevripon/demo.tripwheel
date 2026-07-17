'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Delete02Icon, File02Icon, HelpCircleIcon, MoreHorizontalIcon, PencilEdit02Icon, Search01Icon, ToggleOffIcon, ToggleOnIcon, TranslateIcon, ViewIcon, ZapIcon } from '@hugeicons/core-free-icons';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useUpdateDestination, useForceDeleteDestination } from '@/hooks/destinations/use-destinations';
import { useRole } from '@/contexts/role-context';
import type { DestinationLocalized } from '@/types/destination';
import { DestinationQuickEditSheet } from './destination-quick-edit-sheet';
import { DestinationDeleteDialog } from './destination-delete-dialog';
import { ForceDeleteDialog } from '@/components/common/force-delete-dialog';

interface DestinationRowActionsProps {
  destination: DestinationLocalized;
}

export function DestinationRowActions({ destination }: DestinationRowActionsProps) {
  const router = useRouter();
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [forceDeleteOpen, setForceDeleteOpen] = useState(false);
  const { mutate: updateDestination, isPending } = useUpdateDestination();
  const { mutate: forceDeleteDestination, isPending: isForceDeleting } = useForceDeleteDestination();
  const { can, role } = useRole();

  function handleForceDelete() {
    forceDeleteDestination(destination.id, {
      onSuccess: () => {
        toast.success(`"${destination.name}" permanently deleted.`);
        setForceDeleteOpen(false);
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to delete destination.'),
    });
  }

  function handleToggleActive() {
    updateDestination(
      { id: destination.id, payload: { isActive: !destination.isActive } },
      {
        onSuccess: () => {
          toast.success(
            `Destination ${!destination.isActive ? 'activated' : 'deactivated'} successfully.`
          );
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to update destination.');
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
          <DropdownMenuItem onClick={() => router.push(`/destinations/${destination.id}`)}>
            <HugeiconsIcon icon={ViewIcon} />
            View
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push(`/destinations/${destination.id}/edit`)}>
            <HugeiconsIcon icon={PencilEdit02Icon} />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setQuickEditOpen(true)}>
            <HugeiconsIcon icon={ZapIcon} />
            Quick Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() =>
              router.push(`/translations/destination/${destination.id}/es`)
            }
          >
            <HugeiconsIcon icon={TranslateIcon} />
            Manage Translations
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              router.push(`/destinations/${destination.id}/edit?tab=page-content`)
            }
          >
            <HugeiconsIcon icon={File02Icon} />
            Page Content
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push(`/destinations/${destination.id}/edit?tab=seo`)}
          >
            <HugeiconsIcon icon={Search01Icon} />
            SEO
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push(`/destinations/${destination.id}/edit?tab=faqs`)}
          >
            <HugeiconsIcon icon={HelpCircleIcon} />
            Manage FAQs
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleToggleActive}
            disabled={isPending || destination.isSeeded}
          >
            {destination.isActive ? <HugeiconsIcon icon={ToggleOffIcon} /> : <HugeiconsIcon icon={ToggleOnIcon} />}
            {destination.isActive ? 'Deactivate' : 'Activate'}
          </DropdownMenuItem>
          {can('DELETE_DESTINATION') && !destination.isSeeded && destination.isActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                onClick={() => setDeleteOpen(true)}
              >
                <HugeiconsIcon icon={Delete02Icon} />
                Deactivate
              </DropdownMenuItem>
            </>
          )}
          {role === 'ADMIN' && !destination.isSeeded && !destination.isActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                onClick={() => setForceDeleteOpen(true)}
              >
                <HugeiconsIcon icon={Delete02Icon} />
                Force Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DestinationQuickEditSheet
        destination={destination}
        open={quickEditOpen}
        onOpenChange={setQuickEditOpen}
      />

      <DestinationDeleteDialog
        destination={destination}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />

      <ForceDeleteDialog
        open={forceDeleteOpen}
        onOpenChange={setForceDeleteOpen}
        title="Force Delete Destination"
        entityName={destination.name}
        consequenceNote="All hubs, translations, FAQs, page content, and slug registry entries for this destination (including all category and tour slugs under it) will be permanently removed."
        onConfirm={handleForceDelete}
        isPending={isForceDeleting}
        confirmLabel="Force Delete Destination"
      />
    </>
  );
}
