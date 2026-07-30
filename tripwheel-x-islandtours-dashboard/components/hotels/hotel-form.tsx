'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { ImageSelectorField } from '@/components/common/image-selector-field';
import { CheckboxField } from '@/components/settings/settings-fields';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useCreateHotel, useUpdateHotel } from '@/hooks/hotels/use-hotels';
import type { Hotel, HotelCurrency } from '@/types/hotel';

/** The platform prices in these two only (backend `Currency` enum). */
const CURRENCIES: { value: HotelCurrency; label: string }[] = [
    { value: 'USD', label: 'USD - US dollar ($)' },
    { value: 'EUR', label: 'EUR - euro (€)' },
];

/**
 * Every numeric field is a text input in the form and a number (or null) on the
 * wire. An empty box is a CLEAR, not a zero: "no rating yet" and "rated 0" are
 * different things on the card, and `Number('')` is 0, which would silently
 * publish a 0.0-star hotel.
 */
interface HotelValues {
    isEnabled: boolean;
    displayOrder: string;
    imageUrl: string;
    bookingUrl: string;
    rating: string;
    reviewCount: string;
    sleeps: string;
    pricePerNight: string;
    currency: HotelCurrency;
    /** Create only - on an existing hotel the copy lives in the Content tab. */
    title: string;
}

function toFormValue(v: number | null): string {
    return v === null ? '' : String(v);
}

/** `''` clears; anything unparseable is rejected before we get here. */
function toNumberOrNull(v: string): number | null {
    const trimmed = v.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
}

/**
 * The hotel's facts, which are the same in every language. Its WORDS are
 * per-locale and live in the Content tab, exactly as a destination's overview
 * does.
 *
 * One card, one form, one Save - these are the fields of the record itself and
 * they save through one endpoint, so splitting them would mean several round
 * trips to change one hotel.
 *
 * CREATE MODE (`hotel` omitted) adds a single copy field: the name. It is the
 * render gate AND the only label the list can show, so a hotel cannot be created
 * without one - everything else is filled in afterwards, on the same form.
 */
export function HotelForm({ hotel }: { hotel?: Hotel }) {
    const router = useRouter();
    const isEdit = !!hotel;

    const { mutate: create, isPending: creating } = useCreateHotel();
    const { mutate: update, isPending: updating } = useUpdateHotel();
    const isPending = creating || updating;

    const {
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
        formState: { errors },
    } = useForm<HotelValues>({
        defaultValues: {
            isEnabled: true,
            displayOrder: '0',
            imageUrl: '',
            bookingUrl: '',
            rating: '',
            reviewCount: '',
            sleeps: '',
            pricePerNight: '',
            currency: 'USD',
            title: '',
        },
    });

    useEffect(() => {
        if (!hotel) return;
        reset({
            isEnabled: hotel.isEnabled,
            displayOrder: String(hotel.displayOrder),
            imageUrl: hotel.imageUrl ?? '',
            bookingUrl: hotel.bookingUrl ?? '',
            rating: toFormValue(hotel.rating),
            reviewCount: toFormValue(hotel.reviewCount),
            sleeps: toFormValue(hotel.sleeps),
            pricePerNight: toFormValue(hotel.pricePerNight),
            currency: hotel.currency,
            title: '',
        });
    }, [hotel, reset]);

    const values = watch();

    function onSubmit(v: HotelValues) {
        const base = {
            isEnabled: v.isEnabled,
            displayOrder: toNumberOrNull(v.displayOrder) ?? 0,
            imageUrl: v.imageUrl.trim() || null,
            bookingUrl: v.bookingUrl.trim() || null,
            rating: toNumberOrNull(v.rating),
            reviewCount: toNumberOrNull(v.reviewCount),
            sleeps: toNumberOrNull(v.sleeps),
            pricePerNight: toNumberOrNull(v.pricePerNight),
            currency: v.currency,
        };

        const onError = (err: unknown) =>
            toast.error(
                err instanceof Error ? err.message : 'Failed to save the hotel.'
            );

        if (hotel) {
            update(
                { id: hotel.id, payload: base },
                {
                    onSuccess: () => toast.success('Hotel updated successfully.'),
                    onError,
                }
            );
            return;
        }

        create(
            { ...base, title: v.title.trim() },
            {
                onSuccess: created => {
                    toast.success('Hotel created.');
                    // Straight into the editor: a new hotel is almost never
                    // finished, and this is where the rest of its copy lives.
                    router.push(`/hotels/${created.id}/edit`);
                },
                onError,
            }
        );
    }

    return (
        <div className='space-y-6'>
            {hotel && <LiveNotice hotel={hotel} />}

            <Card>
                <CardHeader className='border-b pb-8'>
                    <CardTitle>
                        {isEdit ? 'Hotel Details' : 'New Hotel'}
                    </CardTitle>
                </CardHeader>
                <CardContent className='pt-8'>
                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        className='space-y-6'>
                        {!isEdit && (
                            <Field>
                                <Label>
                                    Name{' '}
                                    <span className='text-destructive'>*</span>
                                </Label>
                                <Input
                                    {...register('title', {
                                        validate: v =>
                                            !!v.trim() || 'A name is required',
                                    })}
                                    placeholder='e.g. Palm Suite Apartment'
                                    aria-invalid={!!errors.title}
                                />
                                <FieldDescription>
                                    The heading on the card, in English. Other
                                    languages are translated afterwards, in the
                                    Content tab.
                                </FieldDescription>
                                <FieldError>{errors.title?.message}</FieldError>
                            </Field>
                        )}

                        <CheckboxField
                            id='hotel-enabled'
                            label='Available to promote'
                            description='Off takes this hotel out of the running without deleting anything. The card then goes to the next one in order.'
                            checked={values.isEnabled}
                            onChange={c => setValue('isEnabled', c)}
                        />

                        <Field>
                            <Label>Photo</Label>
                            <FieldDescription>
                                Fills the left half of the card. Landscape, at
                                least 1176px wide. Required - without it this
                                hotel cannot be promoted.
                            </FieldDescription>
                            <ImageSelectorField
                                value={values.imageUrl || null}
                                onChange={url => setValue('imageUrl', url ?? '')}
                            />
                        </Field>

                        <Field>
                            <Label>Booking link</Label>
                            <Input
                                {...register('bookingUrl', {
                                    validate: v =>
                                        !v.trim() ||
                                        v.trim().startsWith('https://') ||
                                        'Must be a full https:// address',
                                })}
                                placeholder='https://www.airbnb.com/rooms/...'
                                aria-invalid={!!errors.bookingUrl}
                            />
                            <FieldDescription>
                                Where the button sends people. Required - the
                                card&apos;s only action is this click. Set the
                                button text per language in the Content tab if
                                this is not Airbnb.
                            </FieldDescription>
                            <FieldError>{errors.bookingUrl?.message}</FieldError>
                        </Field>

                        {/* The four facts in the meta row. Each is optional and
                            each hides its own part of that row, so a hotel with
                            no price is a shorter card, not a broken one. */}
                        <div className='grid gap-4 sm:grid-cols-2'>
                            <Field>
                                <Label>Rating</Label>
                                <Input
                                    type='number'
                                    step='0.1'
                                    min='0'
                                    max='5'
                                    {...register('rating', {
                                        validate: v => {
                                            if (!v.trim()) return true;
                                            const n = Number(v);
                                            if (!Number.isFinite(n))
                                                return 'Must be a number';
                                            return (
                                                (n >= 0 && n <= 5) ||
                                                'Must be between 0 and 5'
                                            );
                                        },
                                    })}
                                    placeholder='e.g. 4.8'
                                    aria-invalid={!!errors.rating}
                                />
                                <FieldDescription>
                                    The score from wherever it is listed. Out of
                                    5, one decimal.
                                </FieldDescription>
                                <FieldError>{errors.rating?.message}</FieldError>
                            </Field>

                            <Field>
                                <Label>Number of reviews</Label>
                                <Input
                                    type='number'
                                    min='0'
                                    step='1'
                                    {...register('reviewCount')}
                                    placeholder='e.g. 1738'
                                />
                                <FieldDescription>
                                    Shown in brackets after the rating. Empty
                                    shows the rating on its own.
                                </FieldDescription>
                            </Field>

                            <Field>
                                <Label>Sleeps</Label>
                                <Input
                                    type='number'
                                    min='1'
                                    step='1'
                                    {...register('sleeps')}
                                    placeholder='e.g. 4'
                                />
                                <FieldDescription>
                                    How many guests. Renders as &quot;Sleeps
                                    4&quot;, translated.
                                </FieldDescription>
                            </Field>

                            <Field>
                                <Label>
                                    Price per night ({values.currency})
                                </Label>
                                <Input
                                    type='number'
                                    min='0'
                                    step='0.01'
                                    {...register('pricePerNight')}
                                    placeholder='e.g. 160'
                                />
                                <FieldDescription>
                                    Shown as &quot;from ...&quot;. The card
                                    renders the symbol of the currency below, so
                                    enter the number only.
                                </FieldDescription>
                            </Field>
                        </div>

                        <div className='grid gap-4 sm:grid-cols-2'>
                            <Field>
                                <Label>Currency</Label>
                                <Select
                                    value={values.currency}
                                    onValueChange={v =>
                                        setValue('currency', v as HotelCurrency)
                                    }>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CURRENCIES.map(c => (
                                            <SelectItem
                                                key={c.value}
                                                value={c.value}>
                                                {c.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FieldDescription>
                                    The currency the price above is IN. It is
                                    never converted - the card shows this figure
                                    and this symbol to everyone.
                                </FieldDescription>
                            </Field>

                            <Field>
                                <Label>Promotion priority</Label>
                                <Input
                                    type='number'
                                    min='0'
                                    step='1'
                                    {...register('displayOrder')}
                                    placeholder='0'
                                />
                                <FieldDescription>
                                    Which hotel gets the card: the lowest number
                                    wins, among those switched on and complete.
                                    Nothing to do with bookings - those happen on
                                    the booking site, and we never see them.
                                </FieldDescription>
                            </Field>
                        </div>

                        <div className='flex justify-end pt-2'>
                            <Button type='submit' disabled={isPending}>
                                {isPending
                                    ? 'Saving...'
                                    : isEdit
                                      ? 'Save Changes'
                                      : 'Create Hotel'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

/**
 * Whether this hotel is on the public site, and what is missing if it is not.
 *
 * The verdict comes from the backend, computed with the same gate the public read
 * uses, so it cannot drift from reality. It exists because the failure mode is
 * silent: an admin who saves a hotel with no booking link gets a success toast
 * and a card that never appears, with nothing anywhere to explain why.
 */
function LiveNotice({ hotel }: { hotel: Hotel }) {
    if (hotel.isPromoted) {
        return (
            <p className='rounded-md border border-line bg-surface-sunken px-4 py-3 text-sm text-content-muted'>
                This hotel is showing on the thank-you page, after a traveller
                books.
            </p>
        );
    }

    if (!hotel.isEnabled) {
        return (
            <p className='rounded-md border border-line bg-surface-sunken px-4 py-3 text-sm text-content-muted'>
                Switched off - not in the running. Tick &ldquo;Available to
                promote&rdquo; to put it back.
            </p>
        );
    }

    if (hotel.isComplete) {
        return (
            <p className='rounded-md border border-line bg-surface-sunken px-4 py-3 text-sm text-content-muted'>
                Ready, but another hotel has a higher promotion priority. Lower
                this one&apos;s number to promote it instead.
            </p>
        );
    }

    const english = hotel.translations.find(t => t.locale === 'en');
    const missing = [
        !hotel.imageUrl && 'a photo',
        !english?.title?.trim() && 'an English name (Content tab)',
        !hotel.bookingUrl && 'a booking link',
    ].filter(Boolean) as string[];

    return (
        <p className='rounded-md border border-line bg-surface-sunken px-4 py-3 text-sm text-danger-fg'>
            Not ready to show - it still needs {missing.join(', ')}.
        </p>
    );
}
