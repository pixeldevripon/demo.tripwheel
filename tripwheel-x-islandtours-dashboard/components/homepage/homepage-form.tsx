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
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useActiveCategories } from '@/hooks/categories/use-categories';
import { useHubs } from '@/hooks/hubs/use-hubs';
import { useActiveDestinations } from '@/hooks/destinations/use-destinations';
import { useUpdateHomePage } from '@/hooks/home-page/use-home-page';
import { DEFAULT_HERO_IMAGE_LABEL } from '@/lib/home-page/defaults';
import type { HomePageContent } from '@/types/home-page';

/** Radix cannot hold an empty-string item value, so each "none" needs a token. */
const AUTO_DESTINATION = '__auto__';
const NO_TARGET = '__none__';

/**
 * The card select holds categories AND hubs in one dropdown, so the value
 * encodes the type: `cat:<id>` / `hub:<id>`. Decoded back to the API's
 * {categoryId, hubId} pair on save.
 */
const CAT_PREFIX = 'cat:';
const HUB_PREFIX = 'hub:';
const encodeTarget = (categoryId: string | null, hubId: string | null) =>
    categoryId
        ? CAT_PREFIX + categoryId
        : hubId
          ? HUB_PREFIX + hubId
          : NO_TARGET;
function decodeTarget(value: string | undefined): {
    categoryId: string | null;
    hubId: string | null;
} {
    if (value?.startsWith(CAT_PREFIX))
        return { categoryId: value.slice(CAT_PREFIX.length), hubId: null };
    if (value?.startsWith(HUB_PREFIX))
        return { categoryId: null, hubId: value.slice(HUB_PREFIX.length) };
    return { categoryId: null, hubId: null };
}

/** The design renders exactly three fanned cards - not a growable list. */
const CARD_SLOTS = ['Left card', 'Middle card', 'Front card'] as const;

interface CardValues {
    imageUrl: string;
    /** Encoded target: `cat:<id>`, `hub:<id>`, or the none sentinel. */
    target: string;
    isLink: boolean;
}

const EMPTY_SLOT: CardValues = {
    imageUrl: '',
    target: NO_TARGET,
    isLink: false,
};

/**
 * A real entity id, or null.
 *
 * The selects carry sentinels (`__none__`, `__auto__`) because Radix cannot
 * hold an empty-string item value, and a form field can also simply be `''`
 * before anything is chosen. NONE of those are ids, and the API validates the
 * field as a UUID - so every one of them has to collapse to null here rather
 * than being posted and rejected. Comparing against the sentinel alone is what
 * let `''` through and produced "destinationId must be a UUID" on save.
 *
 * Shared by the island and the category selects - both post a UUID or nothing.
 */
function realId(value: string | undefined): string | null {
    if (!value) return null;
    if (value === NO_TARGET || value === AUTO_DESTINATION) return null;
    return value;
}

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
            target: encodeTarget(c.categoryId, c.hubId),
            isLink: c.isLink,
        }));

    return CARD_SLOTS.map((_, i) => stored[i] ?? { ...EMPTY_SLOT });
}

/**
 * Which stored slots the site is serving WITHOUT their link, because the
 * category has nothing bookable on the banner's island. Keyed by slot index,
 * which is the deck's own order.
 */
function unlinkableSlots(
    cards: HomePageContent['editorialCards']
): Set<number> {
    const dead = new Set<number>();
    [...cards]
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .forEach((card, index) => {
            if (
                (card.categoryId || card.hubId) &&
                card.isLink &&
                !card.hasLiveTours
            ) {
                dead.add(index);
            }
        });
    return dead;
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
    const { data: categories = [] } = useActiveCategories();
    const { data: hubsPage } = useHubs({ limit: 100 });
    const hubs = hubsPage?.data ?? [];

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
    // Computed from what is SAVED, not from the form: the gate is a fact about
    // the live site, and it only changes when a save changes it.
    const unlinkable = unlinkableSlots(content.editorialCards);
    const islandSlug = content.resolvedDestinationSlug;

    function onSubmit(v: DetailsValues) {
        update(
            {
                heroImage: v.heroImage.trim() || null,
                // A slot with no photo is not a card - the deck falls back to
                // its bundled art for that position instead of rendering a hole.
                editorialCards: v.editorialCards
                    .filter(c => c.imageUrl.trim())
                    .map(c => {
                        const { categoryId, hubId } = decodeTarget(c.target);
                        return {
                            imageUrl: c.imageUrl.trim(),
                            categoryId,
                            hubId,
                            // A link with nowhere to go is not a link. The
                            // backend normalises this too; sending it already
                            // consistent means the two can never disagree.
                            isLink: categoryId || hubId ? c.isLink : false,
                        };
                    }),
                editorialDestinationId: realId(v.editorialDestinationId),
            },
            {
                onSuccess: () =>
                    toast.success('Homepage updated successfully.'),
                onError: err =>
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to update the homepage.'
                    ),
            }
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

                        {/* The island comes FIRST because everything below it
                            depends on it: the cards open categories ON this
                            island, so choosing it is the first decision. */}
                        <Field>
                            <Label>CTA Island</Label>
                            <Select
                                value={values.editorialDestinationId}
                                onValueChange={v =>
                                    setValue('editorialDestinationId', v)
                                }>
                                <SelectTrigger className='max-w-md'>
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
                                The island this banner is about. The big button
                                opens it, and each card below opens one of its
                                categories. Left automatic, the site picks the
                                launch island, then the first active one - and
                                an island you archive later falls back the same
                                way rather than linking somewhere broken.
                            </FieldDescription>
                        </Field>

                        <Field>
                            <Label>CTA Card Photos</Label>
                            <FieldDescription>
                                The three angled cards in the banner, in fan
                                order. Portrait crops work best. Each card can
                                point at a category or a hub - it then shows
                                that page&apos;s name, in every language, and
                                opens it on the island above (a hub links only
                                when it belongs to that island). Empty slots
                                are skipped and the deck keeps its built-in
                                photo for whatever is left over.
                            </FieldDescription>

                            <div className='grid gap-4 sm:grid-cols-3'>
                                {CARD_SLOTS.map((slotLabel, index) => {
                                    return (
                                        <EditorialCardSlot
                                            key={slotLabel}
                                            index={index}
                                            slotLabel={slotLabel}
                                            categories={categories}
                                            hubs={hubs}
                                            value={values.editorialCards[index]}
                                            noLiveTours={unlinkable.has(index)}
                                            islandSlug={islandSlug}
                                            onImageChange={url => {
                                                setValue(
                                                    `editorialCards.${index}.imageUrl`,
                                                    url ?? ''
                                                );
                                                if (!url) {
                                                    // An empty slot has nothing
                                                    // to link, so it must not
                                                    // keep a stale target.
                                                    setValue(
                                                        `editorialCards.${index}.target`,
                                                        NO_TARGET
                                                    );
                                                    setValue(
                                                        `editorialCards.${index}.isLink`,
                                                        false
                                                    );
                                                }
                                            }}
                                            onTargetChange={target => {
                                                setValue(
                                                    `editorialCards.${index}.target`,
                                                    target
                                                );
                                                // Choosing a page means you
                                                // want the link; switching back
                                                // to none cannot leave a link
                                                // pointing nowhere.
                                                setValue(
                                                    `editorialCards.${index}.isLink`,
                                                    target !== NO_TARGET
                                                );
                                            }}
                                            onLinkModeChange={isLink =>
                                                setValue(
                                                    `editorialCards.${index}.isLink`,
                                                    isLink
                                                )
                                            }
                                        />
                                    );
                                })}
                            </div>
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
    categories,
    hubs,
    value,
    noLiveTours,
    islandSlug,
    onImageChange,
    onTargetChange,
    onLinkModeChange,
}: {
    index: number;
    slotLabel: string;
    categories: { id: string; name: string }[];
    hubs: { id: string; name: string }[];
    value: CardValues | undefined;
    /** Saved state: the site is serving this card without its link. */
    noLiveTours: boolean;
    islandSlug: string | null;
    onImageChange: (url: string | null) => void;
    onTargetChange: (target: string) => void;
    onLinkModeChange: (isLink: boolean) => void;
}) {
    // `||`, not `??`: an empty string is "no island chosen" just as much as a
    // null is. With `??` an empty value slipped past, so the select fell back
    // to its placeholder while the link-mode control below it appeared - the
    // slot claimed to link to an island it did not have.
    const target = value?.target || NO_TARGET;
    const hasTarget = target !== NO_TARGET;

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
                <Select value={target} onValueChange={onTargetChange}>
                    {/* SelectTrigger is `w-fit`; every other select in the app
                        stretches only because <Field> puts `*:w-full` on its
                        children, and these two sit in a plain div. */}
                    <SelectTrigger className='w-full'>
                        <SelectValue placeholder='No link' />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NO_TARGET}>
                            No link - photo only
                        </SelectItem>
                        <SelectGroup>
                            <SelectLabel>Categories</SelectLabel>
                            {categories.map(c => (
                                <SelectItem
                                    key={c.id}
                                    value={CAT_PREFIX + c.id}>
                                    {c.name}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                        <SelectGroup>
                            <SelectLabel>Hubs</SelectLabel>
                            {hubs.map(h => (
                                <SelectItem
                                    key={h.id}
                                    value={HUB_PREFIX + h.id}>
                                    {h.name}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>

                {hasTarget && (
                    <Select
                        value={value?.isLink ? 'link' : 'static'}
                        onValueChange={v => onLinkModeChange(v === 'link')}>
                        <SelectTrigger className='w-full'>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value='link'>
                                Clickable - opens the page
                            </SelectItem>
                            <SelectItem value='static'>
                                Name only - not clickable
                            </SelectItem>
                        </SelectContent>
                    </Select>
                )}

                {noLiveTours && (
                    <p className='text-xs font-medium text-danger-fg'>
                        Not linked - this page would not open
                        {islandSlug ? ` on ${islandSlug}` : ' on that island'}
                        (a category needs a live tour there; a hub must belong
                        to that island). The card still shows.
                    </p>
                )}

                <p className='text-xs text-content-muted'>
                    {!value?.imageUrl
                        ? 'Empty - this slot keeps its built-in photo.'
                        : !hasTarget
                          ? 'Photo only, with the built-in caption.'
                          : value.isLink
                            ? "Shows the page's name and opens it on the island above."
                            : "Shows the page's name. Not clickable."}
                </p>
            </div>
        </div>
    );
}

