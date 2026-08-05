'use client';

import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { FieldDescription } from '@/components/ui/field';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useActiveCategories } from '@/hooks/categories/use-categories';
import { useCollectionsByDestination } from '@/hooks/collections/use-collections';
import {
    useDestinationPopularLinks,
    useReplaceDestinationPopularLinks,
} from '@/hooks/destinations/use-destinations';
import { useActiveHubs } from '@/hooks/hubs/use-hubs';
import type { PopularLinkInput } from '@/types/destination';

/** The hero row holds four (mck-02); the backend rejects a fifth. */
const MAX_LINKS = 4;

/**
 * A slot's chosen target, encoded as one string so a single Select can offer all
 * three entity types. `''` is an empty slot, which is simply not sent.
 */
type SlotValue = '' | `category:${string}` | `hub:${string}` | `collection:${string}`;

function toSlotValue(link: {
    categoryId: string | null;
    hubId: string | null;
    collectionId: string | null;
}): SlotValue {
    if (link.hubId) return `hub:${link.hubId}`;
    if (link.collectionId) return `collection:${link.collectionId}`;
    if (link.categoryId) return `category:${link.categoryId}`;
    return '';
}

function toPayload(value: SlotValue): PopularLinkInput | null {
    if (!value) return null;
    const [kind, id] = value.split(':');
    if (kind === 'hub') return { hubId: id };
    if (kind === 'collection') return { collectionId: id };
    return { categoryId: id };
}

/**
 * The island hero's curated "Popular" quick links.
 *
 * Curation rather than an automatic ranking because "Popular" is an editorial
 * claim: no order over live data produced the row the founder wanted for
 * Curacao, since Off-Road Tours is fifth by sort order and joint-fourth by tour
 * count and so fell outside a row of four however it was sorted.
 *
 * Leave every slot empty and the island falls back to the automatic row (its
 * hub, its lead collection, then its categories), which is what an uncurated
 * island gets.
 *
 * One Save for the whole section: the endpoint is replace-all, and slot order is
 * assigned from position there, so a per-slot save would let two open editors
 * interleave into an order neither of them chose.
 */
export function DestinationPopularLinksForm({
    destinationId,
    destinationSlug,
}: {
    destinationId: string;
    destinationSlug: string;
}) {
    const { data: links, isLoading } = useDestinationPopularLinks(destinationId);
    const { data: hubs } = useActiveHubs(destinationId);
    const { data: collections } = useCollectionsByDestination(destinationSlug);
    const { data: categories } = useActiveCategories();
    const { mutate: save, isPending } = useReplaceDestinationPopularLinks();

    const [slots, setSlots] = useState<SlotValue[]>(
        Array<SlotValue>(MAX_LINKS).fill('')
    );

    useEffect(() => {
        if (!links) return;
        const next = Array<SlotValue>(MAX_LINKS).fill('');
        links.slice(0, MAX_LINKS).forEach((link, i) => {
            next[i] = toSlotValue(link);
        });
        setSlots(next);
    }, [links]);

    function onSave() {
        // Empty slots collapse out, so clearing the middle one closes the gap
        // rather than leaving a hole in the rendered row.
        const payload = slots
            .map(toPayload)
            .filter((entry): entry is PopularLinkInput => entry !== null);

        save(
            { id: destinationId, links: payload },
            {
                onSuccess: () =>
                    toast.success(
                        payload.length === 0
                            ? 'Cleared - this island is back on the automatic row'
                            : `Saved ${payload.length} popular link${payload.length === 1 ? '' : 's'}`
                    ),
                onError: (error: Error) => toast.error(error.message),
            }
        );
    }

    return (
        <Card>
            <CardHeader className='border-b pb-4'>
                <CardTitle className='text-lg font-medium'>
                    Hero &ldquo;Popular&rdquo; links
                </CardTitle>
                <FieldDescription>
                    Up to four quick links under this island&rsquo;s hero
                    search. Empty falls back to the automatic row; a link whose
                    page is not live is skipped on the site.
                </FieldDescription>
            </CardHeader>
            <CardContent className='pt-6'>
                {isLoading ? (
                    <div className='space-y-2'>
                        {Array.from({ length: MAX_LINKS }).map((_, i) => (
                            <Skeleton key={i} className='h-9 w-full' />
                        ))}
                    </div>
                ) : (
                    /* Hairline rows rather than four bordered fields: this is
                       one ordered list, and a box per slot read as four
                       unrelated settings. */
                    <div className='divide-y rounded-md border'>
                        {slots.map((value, index) => (
                            <div
                                key={index}
                                className='flex items-center gap-2 px-2'>
                                <span className='w-4 shrink-0 text-center text-xs tabular-nums text-muted-foreground'>
                                    {index + 1}
                                </span>
                                <Select
                                    value={value}
                                    onValueChange={next =>
                                        setSlots(current =>
                                            current.map((slot, i) =>
                                                i === index
                                                    ? (next as SlotValue)
                                                    : slot
                                            )
                                        )
                                    }>
                                    <SelectTrigger
                                        size='sm'
                                        className='flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent'>
                                        <SelectValue placeholder='Empty' />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(
                                            [
                                                ['Hubs', 'hub', hubs],
                                                [
                                                    'Collections',
                                                    'collection',
                                                    collections,
                                                ],
                                                [
                                                    'Categories',
                                                    'category',
                                                    categories,
                                                ],
                                            ] as const
                                        ).map(([label, kind, options]) =>
                                            (options ?? []).length === 0 ? null : (
                                                <SelectGroup key={kind}>
                                                    <SelectLabel>
                                                        {label}
                                                    </SelectLabel>
                                                    {(options ?? []).map(
                                                        option => (
                                                            <SelectItem
                                                                key={option.id}
                                                                value={`${kind}:${option.id}`}>
                                                                {option.name}
                                                            </SelectItem>
                                                        )
                                                    )}
                                                </SelectGroup>
                                            )
                                        )}
                                    </SelectContent>
                                </Select>
                                {/* One quiet control, and only where there is
                                    something to clear - four permanent buttons
                                    were four times the visual weight of the
                                    thing they act on. */}
                                <Button
                                    type='button'
                                    variant='ghost'
                                    size='icon'
                                    aria-label={`Clear slot ${index + 1}`}
                                    className={
                                        value
                                            ? 'size-7 text-muted-foreground'
                                            : 'invisible size-7'
                                    }
                                    onClick={() =>
                                        setSlots(current =>
                                            current.map((slot, i) =>
                                                i === index ? '' : slot
                                            )
                                        )
                                    }>
                                    <HugeiconsIcon
                                        icon={Cancel01Icon}
                                        size={14}
                                        strokeWidth={2}
                                    />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}

                <div className='mt-4 flex justify-end'>
                    <Button
                        type='button'
                        size='sm'
                        onClick={onSave}
                        disabled={isPending || isLoading}>
                        {isPending ? 'Saving...' : 'Save'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
