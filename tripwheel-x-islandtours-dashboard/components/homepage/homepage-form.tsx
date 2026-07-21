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

/** Radix cannot hold an empty-string item value, so "automatic" needs a token. */
const AUTO_DESTINATION = '__auto__';

interface DetailsValues {
    heroImage: string;
    editorialImages: string[];
    editorialDestinationId: string;
}

/**
 * The Details tab: everything on the homepage that is NOT words.
 *
 * Same shape as DestinationForm - one card, one form, one Save - and for the
 * same reason: these are the fields of the record itself, they save through one
 * endpoint (`PATCH /home-page`), so splitting them across three cards would
 * mean three round trips to change one banner. The copy that sits ON these
 * images is per-locale and lives in Page Content, exactly as a destination's
 * overview does.
 */
export function HomepageForm({ content }: { content: HomePageContent }) {
    const { mutate: update, isPending } = useUpdateHomePage();
    const { data: destinations = [] } = useActiveDestinations();

    const { handleSubmit, reset, watch, setValue } = useForm<DetailsValues>({
        defaultValues: {
            heroImage: '',
            editorialImages: [],
            editorialDestinationId: AUTO_DESTINATION,
        },
    });

    useEffect(() => {
        reset({
            heroImage: content.heroImage ?? '',
            editorialImages: content.editorialImages ?? [],
            editorialDestinationId:
                content.editorialDestinationId ?? AUTO_DESTINATION,
        });
    }, [content, reset]);

    const values = watch();

    function onSubmit(v: DetailsValues) {
        update(
            {
                heroImage: v.heroImage.trim() || null,
                editorialImages: v.editorialImages,
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
                                The three angled cards beside the copy in the
                                banner near the bottom of the page, in fan order
                                (left, middle, front). Portrait crops work best.
                                {values.editorialImages.length < 3 &&
                                    ' The deck always shows three cards - any you leave empty keep their built-in photo.'}
                            </FieldDescription>
                            <ImageSelectorField
                                multiple
                                maxFiles={3}
                                value={values.editorialImages}
                                onChange={urls =>
                                    setValue('editorialImages', urls)
                                }
                            />
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
                                Which island the button opens. Left automatic,
                                the site picks the launch island, then the first
                                active one. An island you archive later falls
                                back the same way rather than linking somewhere
                                broken.
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
