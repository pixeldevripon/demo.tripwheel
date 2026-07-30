'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { PlusSignIcon } from '@hugeicons/core-free-icons';

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

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
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRole } from '@/contexts/role-context';
import { useDeleteHotel, useHotels } from '@/hooks/hotels/use-hotels';
import { hotelName, type Hotel } from '@/types/hotel';
import { HotelsTable } from './hotels-table';

export function HotelsListView() {
    const { can } = useRole();
    const canManage = can('MANAGE_EDITORIAL');

    const { data: hotels, isLoading } = useHotels();
    const { mutate: remove, isPending: removing } = useDeleteHotel();
    const [target, setTarget] = useState<Hotel | null>(null);

    const promoted = hotels?.find(h => h.isPromoted);

    return (
        <div className='space-y-4'>
            {/* What the site is doing, stated once above the list. Without it an
                admin has to read four status badges to answer the only question
                they came here with. */}
            {!isLoading && (
                <p className='rounded-md border border-line bg-surface-sunken px-4 py-3 text-sm text-content-muted'>
                    {promoted ? (
                        <>
                            <span className='font-medium text-content'>
                                {hotelName(promoted)}
                            </span>{' '}
                            is showing on the thank-you page, after a traveller
                            books. Only one hotel shows at a time - the first
                            switched-on, complete one in order.
                        </>
                    ) : (
                        'No hotel is showing right now. The card needs one that is switched on and has a photo, an English name and a booking link.'
                    )}
                </p>
            )}

            {isLoading ? (
                <div className='space-y-2 p-4'>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className='h-12 w-full rounded-none' />
                    ))}
                </div>
            ) : (
                <HotelsTable
                    data={hotels ?? []}
                    canManage={canManage}
                    onDelete={setTarget}
                    actionSlot={
                        canManage ? (
                            <Button asChild size='sm'>
                                <Link href='/hotels/new'>
                                    <HugeiconsIcon icon={PlusSignIcon} />
                                    New Hotel
                                </Link>
                            </Button>
                        ) : undefined
                    }
                />
            )}

            <AlertDialog
                open={!!target}
                onOpenChange={o => !o && setTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this hotel?</AlertDialogTitle>
                        <AlertDialogDescription>
                            &ldquo;{target ? hotelName(target) : ''}&rdquo; and
                            its copy in every language will be permanently
                            deleted. This cannot be undone - switch it off
                            instead if you only want to stop promoting it.
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
                                        toast.success('Hotel deleted');
                                        setTarget(null);
                                    },
                                    onError: err => toast.error(err.message),
                                });
                            }}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
