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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUpdateDestination } from '@/hooks/destinations/use-destinations';
import type { DestinationLocalized } from '@/types/destination';
import { DestinationQuickEditDialog } from './destination-quick-edit-dialog';
import { DestinationDeleteDialog } from './destination-delete-dialog';

interface DestinationRowActionsProps {
  destination: DestinationLocalized;
}

export function DestinationRowActions({ destination }: DestinationRowActionsProps) {
  const router = useRouter();
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { mutate: updateDestination, isPending } = useUpdateDestination();

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

  const deleteButton = (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
      disabled={destination.isSeeded}
      onClick={() => setDeleteOpen(true)}
    >
      <Trash2Icon />
      Delete
    </Button>
  );

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
            onClick={() => router.push(`/dashboard/destinations/${destination.id}/translations`)}
          >
            <LanguagesIcon />
            Manage Translations
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push(`/dashboard/destinations/${destination.id}/page-content`)}
          >
            <FileTextIcon />
            Page Content
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push(`/dashboard/destinations/${destination.id}/faqs`)}
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
          <DropdownMenuSeparator />
          {destination.isSeeded ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="px-2 py-1.5">{deleteButton}</div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Seeded destinations cannot be deleted</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive focus:bg-destructive/10"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2Icon />
              Delete
            </DropdownMenuItem>
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
    </>
  );
}
