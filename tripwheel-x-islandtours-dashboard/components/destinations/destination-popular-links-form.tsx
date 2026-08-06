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
import type {
    PopularLinkInput,
    PopularLinkPlacement,
} from '@/types/destination';

/**
 * Ceiling, not a target. mck-02 draws FOUR and four is still the shape to aim
 * for - the row is a single line under the hero search, and every extra link
 * buys less attention for the ones already there. The cap exists so the hero
 * cannot be filled by accident; the backend enforces the same number.
 */
const MAX_LINKS = 8;

/** The shape the mockup draws, and what a fresh island starts with. */
const SUGGESTED_LINKS = 4;

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
 * What each placement is called and how it behaves when nobody curates it. Kept
 * as data rather than branching in the JSX: the two lists are the same editor
 * over the same three page types, and only the words differ.
 */
const PLACEMENT_COPY: Record<
    PopularLinkPlacement,
    { title: string; description: (max: number) => string }
> = {
    HERO_POPULAR: {
        title: 'Hero "Popular" links',
        description: max =>
            `Quick links under this island's hero search, in order. Four is the shape the design uses; up to ${max} are allowed, though each extra one takes attention from the rest. Empty falls back to the automatic row, and a link whose page is not live is skipped on the site.`,
    },
    SEARCH_PANEL: {
        title: 'Search panel starting points',
        description: max =>
            `What the search field offers the moment a visitor clicks it, before they type. Categories and hubs are grouped first, then collections - the order here decides the order inside each group. Up to ${max}. The island's top tours and a "See all" link are added automatically below them. Empty falls back to the island's own live pages.`,
    },
};

/**
 * One island's curated quick links, for either placement.
 *
 * Curation rather than an automatic ranking because both surfaces make an
 * editorial claim: no order over live data produced the row the founder wanted
 * for Curacao, since Off-Road Tours is fifth by sort order and joint-fourth by
 * tour count and so fell outside a row of four however it was sorted.
 *
 * Leave every slot empty and the island falls back to its automatic list (its
 * hub, its lead collection, then its categories), which is what an uncurated
 * island gets.
 *
 * One Save for the whole section: the endpoint is replace-all, and slot order is
 * assigned from position there, so a per-slot save would let two open editors
 * interleave into an order neither of them chose. The two placements save
 * independently, so editing one never disturbs the other.
 */
export function DestinationPopularLinksForm({
    destinationId,
    destinationSlug,
    placement = 'HERO_POPULAR',
}: {
    destinationId: string;
    destinationSlug: string;
    placement?: PopularLinkPlacement;
}) {
    const { data: links, isLoading } = useDestinationPopularLinks(
        destinationId,
        placement
    );
    const { data: hubs } = useActiveHubs(destinationId);
    const { data: collections } = useCollectionsByDestination(destinationSlug);
    const { data: categories } = useActiveCategories();
    const { mutate: save, isPending } = useReplaceDestinationPopularLinks();
    const copy = PLACEMENT_COPY[placement];

    /*
     * The rows are the links themselves, not a fixed grid of slots. A blank row
     * is one an admin asked for and has not filled yet - it is dropped on save,
     * so an abandoned row costs nothing.
     */
    const [slots, setSlots] = useState<SlotValue[]>(
        Array<SlotValue>(SUGGESTED_LINKS).fill('')
    );

    useEffect(() => {
        if (!links) return;
        const saved = links.slice(0, MAX_LINKS).map(toSlotValue);
        // A curated island shows exactly what it has; an empty one opens with
        // the mockup's four, so the common case needs no "Add" clicking.
        setSlots(
            saved.length > 0
                ? saved
                : Array<SlotValue>(SUGGESTED_LINKS).fill('')
        );
    }, [links]);

    function onSave() {
        // Empty slots collapse out, so clearing the middle one closes the gap
        // rather than leaving a hole in the rendered row.
        const payload = slots
            .map(toPayload)
            .filter((entry): entry is PopularLinkInput => entry !== null);

        save(
            { id: destinationId, links: payload, placement },
            {
                onSuccess: () =>
                    toast.success(
                        payload.length === 0
                            ? 'Cleared - this island is back on the automatic list'
                            : `Saved ${payload.length} link${payload.length === 1 ? '' : 's'}`
                    ),
                onError: (error: Error) => toast.error(error.message),
            }
        );
    }

    return (
        <Card>
            <CardHeader className='border-b pb-4'>
                <CardTitle className='text-lg font-medium'>
                    {copy.title}
                </CardTitle>
                <FieldDescription>
                    {copy.description(MAX_LINKS)}
                </FieldDescription>
            </CardHeader>
            <CardContent className='pt-6'>
                {isLoading ? (
                    <div className='space-y-2'>
                        {Array.from({ length: SUGGESTED_LINKS }).map((_, i) => (
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
                                {/* Removes the ROW, not just its value - with a
                                    variable-length list, blanking in place
                                    would leave a gap the admin then has to
                                    tidy. One row always remains. */}
                                <Button
                                    type='button'
                                    variant='ghost'
                                    size='icon'
                                    aria-label={`Remove link ${index + 1}`}
                                    disabled={slots.length === 1 && !value}
                                    className='size-7 text-muted-foreground'
                                    onClick={() =>
                                        setSlots(current =>
                                            current.length === 1
                                                ? ['']
                                                : current.filter(
                                                      (_, i) => i !== index
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

                <div className='mt-4 flex items-center justify-between gap-3'>
                    <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        disabled={slots.length >= MAX_LINKS || isLoading}
                        onClick={() => setSlots(current => [...current, ''])}>
                        Add link
                    </Button>
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
