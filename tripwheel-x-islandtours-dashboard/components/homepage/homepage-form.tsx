'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { ImageSelectorField } from '@/components/common/image-selector-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useActiveDestinations } from '@/hooks/destinations/use-destinations';
import { useUpdateHomePage } from '@/hooks/home-page/use-home-page';
import { DEFAULT_HERO_IMAGE_LABEL } from '@/lib/home-page/defaults';
import type { HomePageContent } from '@/types/home-page';

/** Radix cannot hold an empty-string item value, so each "none" needs a token. */
const AUTO_DESTINATION = '__auto__';
const NO_DESTINATION = '__none__';

/** The design renders exactly three fanned cards - not a growable list. */
const CARD_SLOTS = ['Left card', 'Middle card', 'Front card'] as const;

interface CardValues {
    imageUrl: string;
    destinationId: string;
    isLink: boolean;
}

const EMPTY_SLOT: CardValues = {
    imageUrl: '',
    destinationId: NO_DESTINATION,
    isLink: false,
};

/**
 * Always three slots in the form, however many cards are stored.
 *
 * Fixed slots rather than a `useFieldArray`: the fan has exactly three
 * positions, so "add a card" is not a thing an admin can do, and array
 * bookkeeping (append/remove/reindex) would be state that can desync from a
 * layout that never changes. Empty slots are dropped on save.
 */
function toSlots(cards: HomePageContent['editorialCards']): CardValues[] {
    const stored = [...cards]
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map(c => ({
            imageUrl: c.imageUrl,
            destinationId: c.destinationId ?? NO_DESTINATION,
            isLink: c.isLink,
        }));

    return CARD_SLOTS.map((_, i) => stored[i] ?? { ...EMPTY_SLOT });
}

interface DetailsValues {
    heroImage: string;
    editorialCards: CardValues[];
    editorialDestinationId: string;
}

/**
 * The Details tab: everything on the homepage that is NOT words.
 *
 * Same shape as DestinationForm - one card, one form, one Save - and for the
 * same reason: these are the fields of the record itself and they save through
 * one endpoint (`PATCH /home-page`), so splitting them would mean three round
 * trips to change one banner. The copy that sits ON these images is per-locale
 * and lives in Page Content, exactly as a destination's overview does.
 */
export function HomepageForm({ content }: { content: HomePageContent }) {
    const { mutate: update, isPending } = useUpdateHomePage();
    const { data: destinations = [] } = useActiveDestinations();

    const { handleSubmit, reset, watch, setValue } = useForm<DetailsValues>({
        defaultValues: {
            heroImage: '',
            editorialCards: CARD_SLOTS.map(() => ({ ...EMPTY_SLOT })),
            editorialDestinationId: AUTO_DESTINATION,
        },
    });

    useEffect(() => {
        reset({
            heroImage: content.heroImage ?? '',
            editorialCards: toSlots(content.editorialCards),
            editorialDestinationId:
                content.editorialDestinationId ?? AUTO_DESTINATION,
        });
    }, [content, reset]);

    const values = watch();

    function onSubmit(v: DetailsValues) {
        update(
            {
                heroImage: v.heroImage.trim() || null,
                // A slot with no photo is not a card - the deck falls back to
                // its bundled art for that position instead of rendering a hole.
                editorialCards: v.editorialCards
                    .filter(c => c.imageUrl.trim())
                    .map(c => ({
                        imageUrl: c.imageUrl.trim(),
                        destinationId:
                            c.destinationId === NO_DESTINATION
                                ? null
                                : c.destinationId,
                        isLink: c.isLink,
                    })),
                editorialDestinationId:
                    v.editorialDestinationId === AUTO_DESTINATION
                        ? null
                        : v.editorialDestinationId,
            },
            {
                onSuccess: () => toast.success('Homepage updated successfully.'),
                onError: err =>
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to update the homepage.',
                    ),
            },
        );
    }

    return (
        <div className='space-y-6'>
            <Card>
                <CardHeader className='border-b pb-8'>
                    <CardTitle>Homepage Details</CardTitle>
                </CardHeader>
                <CardContent className='pt-8'>
                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        className='space-y-6'>
                        <Field>
                            <Label>Hero Image</Label>
                            <FieldDescription>
                                Fills the top of the homepage behind the
                                headline. Landscape, at least 1920px wide.
                                {!values.heroImage &&
                                    ` Currently showing the built-in default: ${DEFAULT_HERO_IMAGE_LABEL}.`}
                            </FieldDescription>
                            <ImageSelectorField
                                value={values.heroImage || null}
                                onChange={url =>
                                    setValue('heroImage', url ?? '')
                                }
                            />
                        </Field>

                        <Field>
                            <Label>CTA Card Photos</Label>
                            <FieldDescription>
                                The three angled cards in the banner near the
                                bottom of the page, in fan order. Portrait crops
                                work best. Each card can point at an island - it
                                then shows that island&apos;s name, in every
                                language, and opens its page. Empty slots are
                                skipped and the deck keeps its built-in photo
                                for whatever is left over.
                            </FieldDescription>

                            <div className='grid gap-4 sm:grid-cols-3'>
                                {CARD_SLOTS.map((slotLabel, index) => {
                                    return (
                                        <EditorialCardSlot
                                            key={slotLabel}
                                            index={index}
                                            slotLabel={slotLabel}
                                            destinations={destinations}
                                            value={values.editorialCards[index]}
                                            onImageChange={url => {
                                                setValue(
                                                    `editorialCards.${index}.imageUrl`,
                                                    url ?? '',
                                                );
                                                if (!url) {
                                                    // An empty slot has nothing
                                                    // to link, so it must not
                                                    // keep a stale island.
                                                    setValue(
                                                        `editorialCards.${index}.destinationId`,
                                                        NO_DESTINATION,
                                                    );
                                                    setValue(
                                                        `editorialCards.${index}.isLink`,
                                                        false,
                                                    );
                                                }
                                            }}
                                            onDestinationChange={destinationId => {
                                                setValue(
                                                    `editorialCards.${index}.destinationId`,
                                                    destinationId,
                                                );
                                                // Choosing an island means you
                                                // want the link; switching back
                                                // to none cannot leave a link
                                                // pointing nowhere.
                                                setValue(
                                                    `editorialCards.${index}.isLink`,
                                                    destinationId !==
                                                        NO_DESTINATION,
                                                );
                                            }}
                                            onLinkModeChange={isLink =>
                                                setValue(
                                                    `editorialCards.${index}.isLink`,
                                                    isLink,
                                                )
                                            }
                                        />
                                    );
                                })}
                            </div>
                        </Field>

                        <Field>
                            <Label>CTA Button Links To</Label>
                            <Select
                                value={values.editorialDestinationId}
                                onValueChange={v =>
                                    setValue('editorialDestinationId', v)
                                }>
                                <SelectTrigger>
                                    <SelectValue placeholder='Choose automatically' />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={AUTO_DESTINATION}>
                                        Choose automatically
                                    </SelectItem>
                                    {destinations.map(d => (
                                        <SelectItem key={d.id} value={d.id}>
                                            {d.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FieldDescription>
                                Which island the big button opens - separate
                                from the cards above. Left automatic, the site
                                picks the launch island, then the first active
                                one. An island you archive later falls back the
                                same way rather than linking somewhere broken.
                            </FieldDescription>
                        </Field>

                        <div className='flex justify-end pt-2'>
                            <Button type='submit' disabled={isPending}>
                                {isPending ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

/**
 * One fan slot: the photo, the island it advertises, and whether it is
 * clickable.
 *
 * The link control is a separate select rather than a checkbox because "shows
 * the name but does not link" is a real editorial choice, not an edge case -
 * naming an island you are not ready to send traffic to.
 */
function EditorialCardSlot({
    index,
    slotLabel,
    destinations,
    value,
    onImageChange,
    onDestinationChange,
    onLinkModeChange,
}: {
    index: number;
    slotLabel: string;
    destinations: { id: string; name: string }[];
    value: CardValues | undefined;
    onImageChange: (url: string | null) => void;
    onDestinationChange: (destinationId: string) => void;
    onLinkModeChange: (isLink: boolean) => void;
}) {
    const destinationId = value?.destinationId ?? NO_DESTINATION;
    const hasDestination = destinationId !== NO_DESTINATION;

    return (
        <div className='space-y-3 rounded-md border border-line p-3'>
            <p className='text-xs font-medium text-content-muted'>
                {index + 1}. {slotLabel}
            </p>

            <ImageSelectorField
                value={value?.imageUrl || null}
                onChange={onImageChange}
            />

            <div className='space-y-2'>
                <Select
                    value={destinationId}
                    onValueChange={onDestinationChange}>
                    <SelectTrigger>
                        <SelectValue placeholder='No island' />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NO_DESTINATION}>
                            No island - photo only
                        </SelectItem>
                        {destinations.map(d => (
                            <SelectItem key={d.id} value={d.id}>
                                {d.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {hasDestination && (
                    <Select
                        value={value?.isLink ? 'link' : 'static'}
                        onValueChange={v => onLinkModeChange(v === 'link')}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value='link'>
                                Clickable - opens the island
                            </SelectItem>
                            <SelectItem value='static'>
                                Name only - not clickable
                            </SelectItem>
                        </SelectContent>
                    </Select>
                )}

                <p className='text-xs text-content-muted'>
                    {!value?.imageUrl
                        ? 'Empty - this slot keeps its built-in photo.'
                        : !hasDestination
                          ? 'Photo only, with the built-in caption.'
                          : value.isLink
                            ? 'Shows the island name and opens its page.'
                            : 'Shows the island name. Not clickable.'}
                </p>
            </div>
        </div>
    );
}
