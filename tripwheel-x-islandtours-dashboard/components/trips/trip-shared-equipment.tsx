'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loading03Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    useCreateResource,
    useResources,
    useSetTourResources,
} from '@/hooks/resources/use-resources';
import { RESOURCE_MODE_EXPLANATION, type Resource } from '@/types/resource';

/**
 * "Does this tour share equipment or staff with your other tours?"
 *
 * This is the whole of the resource feature that most operators will ever see,
 * and it is deliberately one question with no vocabulary. The operator names
 * the thing and says how many there are; the platform infers everything else
 * from the tour they already configured.
 *
 * ## What it is actually for
 * Two tours running off one boat are, today, two independent departure rows
 * with independent seat counters - so both can be sold to capacity and the
 * operator discovers it at the dock. Ticking a box here is what tells us they
 * are the same boat.
 *
 * ## Nothing is enforced yet
 * Attaching equipment records a fact. It does not change what can be booked
 * until the allocation check ships, which is why this screen can be used freely
 * to describe reality without any risk of refusing a sale.
 */
export function TripSharedEquipment({ tripId }: { tripId: string }) {
    const { data, isLoading } = useResources();
    const setForTour = useSetTourResources(tripId);
    const createResource = useCreateResource();

    const resources = useMemo(() => data?.data ?? [], [data]);

    const attachedIds = useMemo(
        () =>
            resources
                .filter((r) => r.tours.some((t) => t.id === tripId))
                .map((r) => r.id),
        [resources, tripId],
    );

    const [selected, setSelected] = useState<string[]>([]);
    const [adding, setAdding] = useState(false);
    const [name, setName] = useState('');
    const [capacity, setCapacity] = useState('');

    // Server state is the source of truth; local selection only diverges while
    // the operator is mid-edit.
    useEffect(() => setSelected(attachedIds), [attachedIds]);

    const dirty =
        selected.length !== attachedIds.length ||
        selected.some((id) => !attachedIds.includes(id));

    const toggle = (id: string) =>
        setSelected((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );

    const handleAdd = async () => {
        const count = Number(capacity);
        if (!name.trim() || !Number.isInteger(count) || count < 1) return;
        const created = await createResource.mutateAsync({
            name: name.trim(),
            capacity: count,
            tourIds: [tripId],
        });
        setSelected((prev) => [...prev, created.id]);
        setName('');
        setCapacity('');
        setAdding(false);
    };

    if (isLoading) {
        return (
            <p className='text-muted-foreground text-sm'>Loading equipment...</p>
        );
    }

    return (
        <div className='space-y-4'>
            <p className='text-muted-foreground text-sm'>
                If this tour uses the same boat, vehicle or guide as another of
                your tours, tell us here. We will stop the two being sold at the
                same time when there is only one of them.
            </p>

            {resources.length > 0 && (
                <div className='space-y-2'>
                    {resources.map((resource) => (
                        <ResourceRow
                            key={resource.id}
                            resource={resource}
                            tripId={tripId}
                            checked={selected.includes(resource.id)}
                            onToggle={() => toggle(resource.id)}
                        />
                    ))}
                </div>
            )}

            {adding ? (
                <div className='space-y-3 border-t pt-4'>
                    <div className='grid gap-3 sm:grid-cols-[1fr_140px]'>
                        <div className='space-y-1.5'>
                            <Label htmlFor='resource-name'>
                                What is it called?
                            </Label>
                            <Input
                                id='resource-name'
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder='Jet ski fleet'
                            />
                        </div>
                        <div className='space-y-1.5'>
                            <Label htmlFor='resource-capacity'>How many?</Label>
                            <Input
                                id='resource-capacity'
                                type='number'
                                min={1}
                                value={capacity}
                                onChange={(e) => setCapacity(e.target.value)}
                                placeholder='4'
                            />
                        </div>
                    </div>
                    <p className='text-muted-foreground text-xs'>
                        Count them the way you sell them - four jet skis, sixty
                        seats, one guide.
                    </p>
                    <div className='flex items-center gap-2'>
                        <Button
                            size='sm'
                            onClick={handleAdd}
                            disabled={
                                createResource.isPending ||
                                !name.trim() ||
                                !capacity
                            }>
                            {createResource.isPending && (
                                <HugeiconsIcon icon={Loading03Icon} className='mr-2 size-4 animate-spin' />
                            )}
                            Add
                        </Button>
                        <Button
                            size='sm'
                            variant='ghost'
                            onClick={() => setAdding(false)}>
                            Cancel
                        </Button>
                    </div>
                </div>
            ) : (
                <Button
                    size='sm'
                    variant='outline'
                    onClick={() => setAdding(true)}>
                    Add equipment or staff
                </Button>
            )}

            {dirty && (
                <div className='flex items-center gap-2 border-t pt-4'>
                    <Button
                        size='sm'
                        onClick={() => setForTour.mutate(selected)}
                        disabled={setForTour.isPending}>
                        {setForTour.isPending && (
                            <HugeiconsIcon icon={Loading03Icon} className='mr-2 size-4 animate-spin' />
                        )}
                        Save
                    </Button>
                    <Button
                        size='sm'
                        variant='ghost'
                        onClick={() => setSelected(attachedIds)}>
                        Cancel
                    </Button>
                </div>
            )}
        </div>
    );
}

function ResourceRow({
    resource,
    tripId,
    checked,
    onToggle,
}: {
    resource: Resource;
    tripId: string;
    checked: boolean;
    onToggle: () => void;
}) {
    // Which OTHER tours already share this - the reason the operator cares.
    const others = resource.tours.filter((t) => t.id !== tripId);
    const mine = resource.tours.find((t) => t.id === tripId);

    return (
        <label className='flex cursor-pointer items-start gap-3 py-2'>
            <Checkbox
                checked={checked}
                onCheckedChange={onToggle}
                className='mt-0.5'
            />
            <span className='min-w-0 flex-1'>
                <span className='block text-sm font-medium'>
                    {resource.name}
                    <span className='text-muted-foreground ml-2 font-normal'>
                        {resource.capacity} available
                    </span>
                </span>
                <span className='text-muted-foreground block text-xs'>
                    {others.length > 0
                        ? `Also used by ${others.map((t) => t.name).join(', ')}`
                        : 'Not used by any other tour yet'}
                </span>
                {/* The mode is inferred, never chosen - shown so the behaviour
                    is not a surprise, phrased as an outcome not a setting. */}
                {mine && checked && (
                    <span className='text-muted-foreground block text-xs'>
                        {RESOURCE_MODE_EXPLANATION[mine.mode]}
                    </span>
                )}
            </span>
        </label>
    );
}
