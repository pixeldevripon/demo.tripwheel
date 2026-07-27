'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown02Icon, ArrowUp02Icon, Delete02Icon, Image02Icon, PencilEdit02Icon, PlusSignIcon, StarIcon } from '@hugeicons/core-free-icons';

import MediaSelector from '@/components/common/media-selector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
    useAddImage,
    useImages,
    useRemoveImage,
    useUpdateImage,
} from '@/hooks/trips/use-trips';
import type { MediaItem } from '@/types/media';
import type {
    TourImage,
    TripListItem,
    UpdateTourImagePayload,
} from '@/types/trip';
import { useState } from 'react';
import { toast } from 'sonner';

interface TripImagesTabProps {
    trip: TripListItem;
}

// Clamp a raw focal-point string to the 0..1 range the backend expects.
function clampFocal(raw: string): number {
    const n = Number.parseFloat(raw);
    if (Number.isNaN(n)) return 0.5;
    return Math.min(1, Math.max(0, n));
}

export function TripImagesTab({ trip }: TripImagesTabProps) {
    const { data: images, isLoading } = useImages(trip.id);
    const { mutate: addImage, isPending: isAdding } = useAddImage();
    const { mutate: updateImage, isPending: isUpdating } = useUpdateImage();
    const { mutate: removeImage } = useRemoveImage();
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [selectorOpen, setSelectorOpen] = useState(false);
    const [editing, setEditing] = useState<TourImage | null>(null);

    const count = images?.length ?? 0;
    const hasHero = images?.some(img => img.isHero) ?? false;

    // Stable display order: the reorder controls act on this sorted view.
    const ordered = [...(images ?? [])].sort(
        (a, b) => a.displayOrder - b.displayOrder
    );

    function handleMediaSelect(items: MediaItem[]) {
        const remaining = 24 - count;
        const toAdd = items.slice(0, remaining);

        if (items.length > remaining) {
            toast.warning(
                `Only ${remaining} image slots remaining. Added the first ${remaining}.`
            );
        }

        toAdd.forEach((item, index) => {
            addImage(
                {
                    tripId: trip.id,
                    payload: {
                        url: item.url,
                        width: item.width ?? 1920,
                        height: item.height ?? 1080,
                        altText: item.altText || item.fileName || undefined,
                        isHero: count === 0 && index === 0,
                        displayOrder: count + index,
                    },
                },
                {
                    onSuccess: () => {
                        if (index === 0)
                            toast.success(
                                `${toAdd.length} image${toAdd.length > 1 ? 's' : ''} added.`
                            );
                    },
                    onError: err =>
                        toast.error(
                            err instanceof Error
                                ? err.message
                                : 'Failed to add image.'
                        ),
                }
            );
        });
    }

    function handleSetHero(imageId: string) {
        updateImage(
            { tripId: trip.id, imageId, payload: { isHero: true } },
            {
                onSuccess: () => toast.success('Hero image updated.'),
                onError: err =>
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to set hero.'
                    ),
            }
        );
    }

    function handleDelete(imageId: string) {
        setDeletingId(imageId);
        removeImage(
            { tripId: trip.id, imageId },
            {
                onSuccess: () => {
                    toast.success('Image removed.');
                    setDeletingId(null);
                },
                onError: err => {
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to remove image.'
                    );
                    setDeletingId(null);
                },
            }
        );
    }

    // Swap displayOrder with the neighbour in the given direction.
    function handleMove(index: number, direction: 'up' | 'down') {
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= ordered.length) return;

        const current = ordered[index];
        const neighbour = ordered[targetIndex];

        updateImage(
            {
                tripId: trip.id,
                imageId: current.id,
                payload: { displayOrder: neighbour.displayOrder },
            },
            {
                onError: err =>
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to reorder image.'
                    ),
            }
        );
        updateImage(
            {
                tripId: trip.id,
                imageId: neighbour.id,
                payload: { displayOrder: current.displayOrder },
            },
            {
                onError: err =>
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to reorder image.'
                    ),
            }
        );
    }

    function handleSaveEdit(payload: UpdateTourImagePayload) {
        if (!editing) return;
        updateImage(
            { tripId: trip.id, imageId: editing.id, payload },
            {
                onSuccess: () => {
                    toast.success('Image details updated.');
                    setEditing(null);
                },
                onError: err =>
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to update image.'
                    ),
            }
        );
    }

    return (
        <Card>
            <CardHeader className='border-b pb-4'>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                    <div className='flex flex-wrap items-center gap-3'>
                        <CardTitle className='font-sans text-base'>
                            Images
                        </CardTitle>
                    <Badge variant='secondary'>{count}/24 images</Badge>
                    {count < 5 && (
                        <Badge variant='destructive'>
                            Need at least 5 to publish
                        </Badge>
                    )}
                    {!hasHero && count > 0 && (
                        <Badge
                            variant='outline'
                            className='border-warning-border text-warning-fg'>
                            No hero image set
                        </Badge>
                    )}
                    </div>
                    <Button
                        size='sm'
                        onClick={() => setSelectorOpen(true)}
                        disabled={isAdding || count >= 24}>
                        <HugeiconsIcon icon={PlusSignIcon} className='size-3.5' />
                        Select from Gallery
                    </Button>
                </div>
            </CardHeader>
            <CardContent className='pt-6'>
            {/* Image grid */}
            {isLoading ? (
                <div className='grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-4'>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton
                            key={i}
                            className='aspect-video w-full rounded-md'
                        />
                    ))}
                </div>
            ) : ordered.length > 0 ? (
                <div className='grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-4'>
                    {ordered.map((img, index) => (
                        <ImageCard
                            key={img.id}
                            img={img}
                            index={index}
                            total={ordered.length}
                            isUpdating={isUpdating}
                            isDeleting={deletingId === img.id}
                            onSetHero={handleSetHero}
                            onDelete={handleDelete}
                            onMove={handleMove}
                            onEdit={() => setEditing(img)}
                        />
                    ))}
                </div>
            ) : (
                <div className='flex flex-col items-center gap-2 py-16 text-muted-foreground border border-dashed border-foreground/15'>
                    <HugeiconsIcon icon={Image02Icon} className='size-10 opacity-30' />
                    <p className='text-sm'>No images yet.</p>
                    <Button
                        size='sm'
                        variant='outline'
                        onClick={() => setSelectorOpen(true)}>
                        Select from Gallery
                    </Button>
                </div>
            )}

            <MediaSelector
                open={selectorOpen}
                onOpenChange={setSelectorOpen}
                onMediaSelect={handleMediaSelect}
                multiple
                maxFiles={24 - count}
            />

            <ImageEditDialog
                image={editing}
                isSaving={isUpdating}
                onOpenChange={open => {
                    if (!open) setEditing(null);
                }}
                onSave={handleSaveEdit}
            />
            </CardContent>
        </Card>
    );
}

// ── Image card ──────────────────────────────────────────────────────────────

interface ImageCardProps {
    img: TourImage;
    index: number;
    total: number;
    isUpdating: boolean;
    isDeleting: boolean;
    onSetHero: (imageId: string) => void;
    onDelete: (imageId: string) => void;
    onMove: (index: number, direction: 'up' | 'down') => void;
    onEdit: () => void;
}

function ImageCard({
    img,
    index,
    total,
    isUpdating,
    isDeleting,
    onSetHero,
    onDelete,
    onMove,
    onEdit,
}: ImageCardProps) {
    return (
        <div className='relative group ring-1 ring-foreground/10 overflow-hidden rounded-md'>
            <div className='aspect-video bg-muted'>
                <img
                    src={img.url}
                    alt={img.altText ?? 'Trip image'}
                    className='size-full object-cover'
                />
            </div>
            <div className='p-2 space-y-1'>
                <div className='flex items-center justify-between gap-2'>
                    {img.isHero ? (
                        <div className='flex items-center gap-1'>
                            <HugeiconsIcon icon={StarIcon} className='size-3 text-warning-solid' />
                            <span className='text-xs text-warning-fg font-medium'>
                                Hero
                            </span>
                        </div>
                    ) : (
                        <span className='text-xs text-muted-foreground'>
                            #{index + 1}
                        </span>
                    )}
                    {img.altText && (
                        <span className='text-xs text-muted-foreground truncate'>
                            {img.altText}
                        </span>
                    )}
                </div>
            </div>

            {/* Reorder controls (bottom-left on hover) */}
            <div className='absolute bottom-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                <Button
                    size='icon-sm'
                    variant='secondary'
                    onClick={() => onMove(index, 'up')}
                    disabled={isUpdating || index === 0}
                    title='Move earlier'>
                    <HugeiconsIcon icon={ArrowUp02Icon} className='size-3' />
                </Button>
                <Button
                    size='icon-sm'
                    variant='secondary'
                    onClick={() => onMove(index, 'down')}
                    disabled={isUpdating || index === total - 1}
                    title='Move later'>
                    <HugeiconsIcon icon={ArrowDown02Icon} className='size-3' />
                </Button>
            </div>

            {/* Edit / hero / delete (top-right on hover) */}
            <div className='absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                <Button
                    size='icon-sm'
                    variant='secondary'
                    onClick={onEdit}
                    disabled={isUpdating}
                    title='Edit alt text and focal point'>
                    <HugeiconsIcon icon={PencilEdit02Icon} className='size-3' />
                </Button>
                {!img.isHero && (
                    <Button
                        size='icon-sm'
                        variant='secondary'
                        onClick={() => onSetHero(img.id)}
                        disabled={isUpdating}
                        title='Set as hero'>
                        <HugeiconsIcon icon={StarIcon} className='size-3' />
                    </Button>
                )}
                <Button
                    size='icon-sm'
                    variant='destructive'
                    onClick={() => onDelete(img.id)}
                    disabled={isDeleting}
                    title='Remove image'>
                    <HugeiconsIcon icon={Delete02Icon} className='size-3' />
                </Button>
            </div>
        </div>
    );
}

// ── Edit dialog (alt text + focal point) ──────────────────────────────────────

interface ImageEditDialogProps {
    image: TourImage | null;
    isSaving: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (payload: UpdateTourImagePayload) => void;
}

function ImageEditDialog({
    image,
    isSaving,
    onOpenChange,
    onSave,
}: ImageEditDialogProps) {
    const [altText, setAltText] = useState('');
    const [focalX, setFocalX] = useState('0.5');
    const [focalY, setFocalY] = useState('0.5');
    // Re-seed the local form whenever a different image is opened.
    const [seededId, setSeededId] = useState<string | null>(null);

    if (image && image.id !== seededId) {
        setSeededId(image.id);
        setAltText(image.altText ?? '');
        setFocalX(String(image.focalX ?? 0.5));
        setFocalY(String(image.focalY ?? 0.5));
    }

    function handleSubmit() {
        onSave({
            altText: altText.trim() === '' ? undefined : altText.trim(),
            focalX: clampFocal(focalX),
            focalY: clampFocal(focalY),
        });
    }

    return (
        <Dialog open={image !== null} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-md'>
                <DialogHeader>
                    <DialogTitle className=' '>
                        Edit Image
                    </DialogTitle>
                    <DialogDescription>
                        Update the alt text and focal point. The focal point (0
                        to 1) keeps the most important part of the image in view
                        when it is cropped.
                    </DialogDescription>
                </DialogHeader>

                {image && (
                    <div className='space-y-4'>
                        <div className='aspect-video bg-muted overflow-hidden'>
                            <img
                                src={image.url}
                                alt={altText || 'Trip image'}
                                className='size-full object-cover'
                            />
                        </div>

                        <Field>
                            <Label>
                                Alt Text
                            </Label>
                            <Input
                                value={altText}
                                onChange={e => setAltText(e.target.value)}
                                placeholder='Describe the image for accessibility'
                            />
                        </Field>

                        <div className='grid grid-cols-2 gap-3'>
                            <Field>
                                <Label>
                                    Focal X
                                </Label>
                                <Input
                                    type='number'
                                    min={0}
                                    max={1}
                                    step={0.1}
                                    value={focalX}
                                    onChange={e => setFocalX(e.target.value)}
                                />
                            </Field>
                            <Field>
                                <Label>
                                    Focal Y
                                </Label>
                                <Input
                                    type='number'
                                    min={0}
                                    max={1}
                                    step={0.1}
                                    value={focalY}
                                    onChange={e => setFocalY(e.target.value)}
                                />
                            </Field>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button
                        variant='outline'
                        size='sm'
                        onClick={() => onOpenChange(false)}
                        disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button
                        size='sm'
                        onClick={handleSubmit}
                        disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
