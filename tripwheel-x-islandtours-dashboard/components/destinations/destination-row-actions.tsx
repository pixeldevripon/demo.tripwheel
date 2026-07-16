'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  EyeIcon,
  PencilIcon,
  Zap,
  LanguagesIcon,
  FileTextIcon,
  SearchIcon,
  HelpCircleIcon,
  ToggleLeftIcon,
  ToggleRightIcon,
  Trash2Icon,
  MoreHorizontalIcon,
} from 'lucide-react';
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
import { DestinationQuickEditDialog } from './destination-quick-edit-dialog';
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
            <MoreHorizontalIcon />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => router.push(`/dashboard/destinations/${destination.id}`)}>
            <EyeIcon />
            View
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push(`/dashboard/destinations/${destination.id}/edit`)}>
            <PencilIcon />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setQuickEditOpen(true)}>
            <Zap />
            Quick Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() =>
              router.push(`/dashboard/destinations/${destination.id}/edit?tab=translations`)
            }
          >
            <LanguagesIcon />
            Manage Translations
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              router.push(`/dashboard/destinations/${destination.id}/edit?tab=page-content`)
            }
          >
            <FileTextIcon />
            Page Content
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push(`/dashboard/destinations/${destination.id}/edit?tab=seo`)}
          >
            <SearchIcon />
            SEO
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push(`/dashboard/destinations/${destination.id}/edit?tab=faqs`)}
          >
            <HelpCircleIcon />
            Manage FAQs
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleToggleActive}
            disabled={isPending || destination.isSeeded}
          >
            {destination.isActive ? <ToggleLeftIcon /> : <ToggleRightIcon />}
            {destination.isActive ? 'Deactivate' : 'Activate'}
          </DropdownMenuItem>
          {can('DELETE_DESTINATION') && !destination.isSeeded && destination.isActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2Icon />
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
                <Trash2Icon />
                Force Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DestinationQuickEditDialog
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
