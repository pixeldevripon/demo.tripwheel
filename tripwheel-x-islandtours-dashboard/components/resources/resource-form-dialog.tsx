'use client';

import { Loading03Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
    useCreateResource,
    useUpdateResource,
} from '@/hooks/resources/use-resources';
import {
    RESOURCE_KIND,
    RESOURCE_KIND_LABEL,
    type Resource,
    type ResourceKind,
} from '@/types/resource';

/** Mirrors the backend DTO so the dialog fails before the round trip. */
const LIMITS = {
    nameMin: 2,
    nameMax: 80,
    capacityMin: 1,
    capacityMax: 100_000,
    notesMax: 500,
};

interface Draft {
    name: string;
    kind: ResourceKind;
    capacity: string;
    notes: string;
}

const EMPTY: Draft = {
    name: '',
    kind: RESOURCE_KIND.GENERIC,
    capacity: '',
    notes: '',
};

/**
 * Create or edit one physical asset.
 *
 * A dialog rather than its own route: a resource is four fields with no
 * translations, no slug and no media, so a full page would be mostly whitespace
 * and two extra navigations.
 *
 * `isActive` is deliberately NOT here. Deactivating is a consequence-bearing act
 * - it stops the asset constraining anything and empties its calendar feed - so
 * it belongs with the other row actions behind a confirmation, not as a checkbox
 * someone can flip while editing a name.
 */
export function ResourceFormDialog({
    open,
    onOpenChange,
    resource,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Absent = create. */
    resource?: Resource | null;
}) {
    const create = useCreateResource();
    const update = useUpdateResource();
    const [draft, setDraft] = useState<Draft>(EMPTY);
    const [error, setError] = useState<string | null>(null);

    const editing = !!resource;

    // Reset on every open so a cancelled edit never leaks into the next one.
    useEffect(() => {
        if (!open) return;
        setError(null);
        setDraft(
            resource
                ? {
                      name: resource.name,
                      kind: resource.kind,
                      capacity: String(resource.capacity),
                      notes: resource.notes ?? '',
                  }
                : EMPTY
        );
    }, [open, resource]);

    const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
        setDraft(prev => ({ ...prev, [key]: value }));

    const name = draft.name.trim();
    const capacity = Number(draft.capacity);
    const capacityValid =
        draft.capacity !== '' &&
        Number.isInteger(capacity) &&
        capacity >= LIMITS.capacityMin &&
        capacity <= LIMITS.capacityMax;
    const valid =
        name.length >= LIMITS.nameMin &&
        name.length <= LIMITS.nameMax &&
        capacityValid &&
        draft.notes.length <= LIMITS.notesMax;

    const pending = create.isPending || update.isPending;

    const submit = () => {
        if (!valid || pending) return;
        setError(null);
        const notes = draft.notes.trim();
        const done = { onSuccess: () => onOpenChange(false) };
        const onError = (e: Error) =>
            setError(e.message || 'Could not save this asset');

        if (resource) {
            update.mutate(
                {
                    id: resource.id,
                    payload: {
                        name,
                        kind: draft.kind,
                        capacity,
                        // null clears it; '' would fail MaxLength-free but keep
                        // an empty string in the column forever.
                        notes: notes === '' ? null : notes,
                    },
                },
                { ...done, onError }
            );
            return;
        }
        create.mutate(
            { name, kind: draft.kind, capacity, ...(notes && { notes }) },
            { ...done, onError }
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-lg'>
                <DialogHeader>
                    <DialogTitle>
                        {editing ? 'Edit asset' : 'Add equipment or staff'}
                    </DialogTitle>
                    <DialogDescription>
                        A boat, vehicle, guide or piece of kit that more than one
                        of your tours uses. Recording it here is what stops two
                        tours being sold onto the same thing at the same time.
                    </DialogDescription>
                </DialogHeader>

                <div className='space-y-4'>
                    <div className='grid gap-4 sm:grid-cols-[1fr_160px]'>
                        <div className='space-y-1.5'>
                            <Label htmlFor='resource-name'>Name</Label>
                            <Input
                                id='resource-name'
                                value={draft.name}
                                maxLength={LIMITS.nameMax}
                                onChange={e => set('name', e.target.value)}
                                placeholder='Sea Breeze'
                            />
                        </div>
                        <div className='space-y-1.5'>
                            <Label htmlFor='resource-kind'>Type</Label>
                            <Select
                                value={draft.kind}
                                onValueChange={v =>
                                    set('kind', v as ResourceKind)
                                }>
                                <SelectTrigger
                                    id='resource-kind'
                                    className='w-full'>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.values(RESOURCE_KIND).map(k => (
                                        <SelectItem key={k} value={k}>
                                            {RESOURCE_KIND_LABEL[k]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className='space-y-1.5'>
                        <Label htmlFor='resource-capacity'>How many?</Label>
                        <Input
                            id='resource-capacity'
                            type='number'
                            min={LIMITS.capacityMin}
                            max={LIMITS.capacityMax}
                            value={draft.capacity}
                            onChange={e => set('capacity', e.target.value)}
                            placeholder='4'
                            className='sm:w-40'
                        />
                        {/* The single most misunderstood field: it is how many of
                            the THING there are, not how many seats you sell. */}
                        <p className='text-xs text-muted-foreground'>
                            Count them the way you sell them - four jet skis,
                            sixty seats, one guide. One boat is 1, not its seat
                            count.
                        </p>
                    </div>

                    <div className='space-y-1.5'>
                        <Label htmlFor='resource-notes'>
                            Notes{' '}
                            <span className='font-normal text-muted-foreground'>
                                (optional)
                            </span>
                        </Label>
                        <Textarea
                            id='resource-notes'
                            rows={2}
                            value={draft.notes}
                            maxLength={LIMITS.notesMax}
                            onChange={e => set('notes', e.target.value)}
                            placeholder='Two skis are down for service in November.'
                        />
                    </div>

                    {/* The backend rejects a duplicate name per operator, which
                        is the realistic failure here - show it in the dialog
                        rather than as a toast behind it. */}
                    {error && (
                        <p className='text-sm text-destructive'>{error}</p>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant='ghost'
                        onClick={() => onOpenChange(false)}
                        disabled={pending}>
                        Cancel
                    </Button>
                    <Button onClick={submit} disabled={!valid || pending}>
                        {pending && (
                            <HugeiconsIcon
                                icon={Loading03Icon}
                                className='size-4 animate-spin'
                            />
                        )}
                        {editing ? 'Save' : 'Add asset'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
