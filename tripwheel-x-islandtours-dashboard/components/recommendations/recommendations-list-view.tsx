'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { PlusSignIcon, Settings02Icon } from '@hugeicons/core-free-icons';

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
import {
    useDeleteRecommendation,
    useRecommendations,
} from '@/hooks/recommendations/use-recommendations';
import {
    RECOMMENDATION_PLACEMENTS,
    RECOMMENDATION_PLACEMENT_LABELS,
    recommendationName,
    type Recommendation,
} from '@/types/recommendation';
import { RecommendationsTable } from './recommendations-table';

export function RecommendationsListView() {
    const { can } = useRole();
    const canManage = can('MANAGE_EDITORIAL');

    const { data: recommendations, isLoading } = useRecommendations();
    const { mutate: remove, isPending: removing } = useDeleteRecommendation();
    const [target, setTarget] = useState<Recommendation | null>(null);

    return (
        <div className='space-y-4'>
            {/* What each surface is doing, stated once above the list. Without it
                an admin has to read every status badge to answer the only
                question they came here with. */}
            {!isLoading && (
                <div className='rounded-md border border-line bg-surface-sunken px-4 py-3 text-sm text-content-muted'>
                    <p className='mb-1 font-medium text-content'>
                        Currently promoted
                    </p>
                    <ul className='space-y-0.5'>
                        {RECOMMENDATION_PLACEMENTS.map((p) => {
                            const winners = (recommendations ?? []).filter((r) =>
                                r.featuredPlacements.includes(p),
                            );
                            return (
                                <li key={p}>
                                    <span className='font-medium'>
                                        {RECOMMENDATION_PLACEMENT_LABELS[p]}:
                                    </span>{' '}
                                    {winners.length > 0
                                        ? winners
                                              .map((w) => recommendationName(w))
                                              .join(', ')
                                        : 'nothing shown'}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            {isLoading ? (
                <div className='space-y-2 p-4'>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className='h-12 w-full rounded-none' />
                    ))}
                </div>
            ) : (
                <RecommendationsTable
                    data={recommendations ?? []}
                    canManage={canManage}
                    onDelete={setTarget}
                    actionSlot={
                        canManage ? (
                            <div className='flex items-center gap-2'>
                                <Button asChild size='sm' variant='outline'>
                                    <Link href='/recommendations/categories'>
                                        <HugeiconsIcon icon={Settings02Icon} />
                                        Categories
                                    </Link>
                                </Button>
                                <Button asChild size='sm'>
                                    <Link href='/recommendations/new'>
                                        <HugeiconsIcon icon={PlusSignIcon} />
                                        New Recommendation
                                    </Link>
                                </Button>
                            </div>
                        ) : undefined
                    }
                />
            )}

            <AlertDialog
                open={!!target}
                onOpenChange={(o) => !o && setTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete this recommendation?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            &ldquo;{target ? recommendationName(target) : ''}
                            &rdquo; and its copy in every language will be
                            permanently deleted. This cannot be undone - switch it
                            off instead if you only want to stop promoting it.
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
                                        toast.success('Recommendation deleted');
                                        setTarget(null);
                                    },
                                    onError: (err) =>
                                        toast.error(err.message),
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
