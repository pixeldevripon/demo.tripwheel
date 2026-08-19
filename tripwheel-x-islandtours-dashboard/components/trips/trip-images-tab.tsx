'use client';

/**
 * Photos - the cover, and the order everything else is seen in.
 *
 * The old screen was one uniform grid with six hover-only buttons per tile, a
 * row of scolding badges, and a focal point entered as two numbers between 0
 * and 1. It treated the two things this step actually decides as if they were
 * the same thing. They are not, and the backend has never conflated them:
 *
 * - `isHero` picks the ONE image used on the tour card, in search results and
 *   on social shares. It is a flag, not a position.
 * - `displayOrder` is the sequence a traveller swipes through on the tour page.
 *   The public query is `orderBy: { displayOrder: 'asc' }` over ALL images,
 *   hero included - the cover is not implicitly first.
 *
 * So the screen is two regions. A cover panel that shows the one image doing
 * the selling, and a gallery that shows the sequence and lets you drag it into
 * shape. Nothing about the payloads moved: the cover button still PATCHes
 * `{ isHero: true }`, and a drag PATCHes `{ displayOrder }` on the rows that
 * actually shifted - the same endpoint the two arrow buttons used to hit.
 *
 * Drag is not the only way to reorder. It is a mouse gesture with no keyboard
 * equivalent, so every tile keeps a pair of move buttons that reach the same
 * code path.
 */

import {
    ArrowLeft02Icon,
    ArrowRight02Icon,
    Delete02Icon,
    ImageAdd02Icon,
    Move02Icon,
    PencilEdit02Icon,
    PlusSignIcon,
    StarIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import MediaSelector from '@/components/common/media-selector';
import { Button } from '@/components/ui/button';
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
import { settleAll } from '@/lib/async/settle-all';
import { springPop } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { MediaItem } from '@/types/media';
import type {
    TourImage,
    TripListItem,
    UpdateTourImagePayload,
} from '@/types/trip';

const MAX_IMAGES = 24;

interface TripImagesTabProps {
    trip: TripListItem;
}

/** Clamp a focal coordinate to the 0..1 range the backend expects. */
function clampFocal(n: number): number {
    if (Number.isNaN(n)) return 0.5;
    return Math.min(1, Math.max(0, n));
}

/** Focal point as a CSS `object-position`, so a crop preview is free. */
function focalPosition(x: number | null, y: number | null): string {
    return `${clampFocal(x ?? 0.5) * 100}% ${clampFocal(y ?? 0.5) * 100}%`;
}

export function TripImagesTab({ trip }: TripImagesTabProps) {
    const { data: images, isLoading } = useImages(trip.id);
    const { mutate: addImage, isPending: isAdding } = useAddImage();
    const {
        mutate: updateImage,
        mutateAsync: updateImageAsync,
        isPending: isUpdating,
    } = useUpdateImage();
    const { mutate: removeImage } = useRemoveImage();

    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [selectorOpen, setSelectorOpen] = useState(false);
    const [editing, setEditing] = useState<TourImage | null>(null);
    // The tile being dragged. Held here rather than read back off
    // `dataTransfer`, which browsers deliberately blank during `dragenter` -
    // exactly the moment the drop target needs to know what is moving.
    const [dragId, setDragId] = useState<string | null>(null);

    const serverOrdered = useMemo(
        () => [...(images ?? [])].sort((a, b) => a.displayOrder - b.displayOrder),
        [images],
    );

    // Optimistic order held while a drag is in flight, so tiles move under the
    // cursor instead of snapping back and forth as each PATCH resolves. Cleared
    // whenever the server's own order changes - by then it says the same thing.
    const [draftOrder, setDraftOrder] = useState<string[] | null>(null);
    const serverKey = serverOrdered.map(i => i.id).join(',');
    useEffect(() => {
        setDraftOrder(null);
    }, [serverKey]);

    const ordered = useMemo(() => {
        if (!draftOrder) return serverOrdered;
        const byId = new Map(serverOrdered.map(i => [i.id, i]));
        const picked = draftOrder
            .map(id => byId.get(id))
            .filter((i): i is TourImage => !!i);
        // Anything added while dragging still has to render.
        const seen = new Set(picked.map(i => i.id));
        return [...picked, ...serverOrdered.filter(i => !seen.has(i.id))];
    }, [draftOrder, serverOrdered]);

    const count = ordered.length;
    // New images go AFTER the highest existing displayOrder, not at `count`:
    // after a deletion the max order can exceed count, so `count + index` would
    // collide with an existing row and the public `orderBy displayOrder asc`
    // would tie-break arbitrarily (code-review L8).
    const nextOrder =
        ordered.reduce((m, i) => Math.max(m, i.displayOrder), -1) + 1;
    const cover = ordered.find(img => img.isHero) ?? null;

    function handleMediaSelect(items: MediaItem[]) {
        const remaining = MAX_IMAGES - count;
        const toAdd = items.slice(0, remaining);

        if (items.length > remaining) {
            toast.warning(
                `Only ${remaining} image slots remaining. Added the first ${remaining}.`,
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
                        // Claim the cover whenever the tour has none - not just
                        // when it has no photos at all. Adding from the empty
                        // cover panel used to land the photo in the gallery and
                        // leave the panel still asking for a cover, because the
                        // old test was `count === 0`: delete the cover, add a
                        // replacement, and nothing became the cover.
                        isHero: !cover && index === 0,
                        displayOrder: nextOrder + index,
                    },
                },
                {
                    onError: err =>
                        toast.error(
                            err instanceof Error
                                ? err.message
                                : 'Failed to add image.',
                        ),
                },
            );
        });
    }

    function handleSetCover(imageId: string) {
        updateImage(
            { tripId: trip.id, imageId, payload: { isHero: true } },
            {
                onError: err =>
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to set the cover photo.',
                    ),
            },
        );
    }

    function handleDelete(imageId: string) {
        setDeletingId(imageId);
        removeImage(
            { tripId: trip.id, imageId },
            {
                onSuccess: () => setDeletingId(null),
                onError: err => {
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to remove image.',
                    );
                    setDeletingId(null);
                },
            },
        );
    }

    /** Preview a move locally. Nothing is written until the drag ends. */
    function previewMove(toId: string) {
        if (!dragId) return;
        const ids = ordered.map(i => i.id);
        const from = ids.indexOf(dragId);
        const to = ids.indexOf(toId);
        if (from < 0 || to < 0 || from === to) return;
        const next = [...ids];
        next.splice(to, 0, next.splice(from, 1)[0]);
        setDraftOrder(next);
    }

    /**
     * Write the order out, one PATCH per row that actually moved.
     *
     * There is no bulk-reorder endpoint, so this normalises to 0..n-1 and skips
     * every row already sitting on its number. Dragging one tile one place
     * costs the same two writes the old arrow buttons cost.
     */
    async function commitOrder(list: TourImage[]) {
        const moves = list
            .map((img, index) => ({ img, index }))
            .filter(({ img, index }) => img.displayOrder !== index);
        if (moves.length === 0) return;
        // One PATCH per moved row, but await them together. The old code fired
        // them and, on ANY error, reverted only the local preview — while the
        // rows that already succeeded had persisted their new displayOrder,
        // scrambling the server order silently (code-review H2). Each success
        // invalidates the images query, so the `serverKey` effect above
        // reconciles the UI to the true persisted order.
        const { failed } = await settleAll(moves, ({ img, index }) =>
            updateImageAsync({
                tripId: trip.id,
                imageId: img.id,
                payload: { displayOrder: index },
            }),
        );
        if (failed.length) {
            // Drop the optimistic preview so the reconciled (possibly partial)
            // server order shows instead of a revert that hides the change.
            setDraftOrder(null);
            toast.error(
                'Some images could not be reordered — showing the saved order.',
            );
        }
    }

    /** Keyboard/button equivalent of a one-place drag. */
    function handleNudge(index: number, direction: -1 | 1) {
        const target = index + direction;
        if (target < 0 || target >= ordered.length) return;
        const next = [...ordered];
        next.splice(target, 0, next.splice(index, 1)[0]);
        setDraftOrder(next.map(i => i.id));
        commitOrder(next);
    }

    function handleSaveEdit(payload: UpdateTourImagePayload) {
        if (!editing) return;
        updateImage(
            { tripId: trip.id, imageId: editing.id, payload },
            {
                onSuccess: () => setEditing(null),
                onError: err =>
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to update image.',
                    ),
            },
        );
    }

    if (isLoading) {
        return (
            <div className='space-y-8'>
                <Skeleton className='aspect-[21/9] w-full rounded-xl' />
                <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className='aspect-[4/3] w-full rounded-lg' />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className='space-y-8'>
            <CoverPanel
                cover={cover}
                hasImages={count > 0}
                onEdit={() => cover && setEditing(cover)}
                onPick={() => setSelectorOpen(true)}
            />

            {count > 0 && (
                <section>
                    <header className='mb-3 flex flex-wrap items-end justify-between gap-3'>
                        <div>
                            <h3 className='text-sm font-semibold text-content'>
                                Gallery order
                            </h3>
                            <p className='mt-0.5 text-xs text-content-muted'>
                                The sequence travellers swipe through on your
                                tour page. Drag a photo to move it.
                            </p>
                        </div>
                        <span className='text-xs tabular-nums text-content-muted'>
                            {count} of {MAX_IMAGES}
                        </span>
                    </header>

                    <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'>
                        {ordered.map((img, index) => (
                            <ImageTile
                                key={img.id}
                                img={img}
                                index={index}
                                total={count}
                                isDeleting={deletingId === img.id}
                                isBusy={isUpdating}
                                isDragging={dragId === img.id}
                                onDragBegin={setDragId}
                                onDragOverTile={previewMove}
                                onDragFinish={() => {
                                    setDragId(null);
                                    commitOrder(ordered);
                                }}
                                onNudge={handleNudge}
                                onSetCover={handleSetCover}
                                onDelete={handleDelete}
                                onEdit={() => setEditing(img)}
                            />
                        ))}
                        {count < MAX_IMAGES && (
                            <AddTile
                                disabled={isAdding}
                                onClick={() => setSelectorOpen(true)}
                            />
                        )}
                    </div>
                </section>
            )}

            {/* `kind='image'` matters: the library holds video and audio too,
                and a tour image row is rendered with <img>. A picked reel
                saved fine and then displayed as a broken frame. */}
            <MediaSelector
                open={selectorOpen}
                onOpenChange={setSelectorOpen}
                onMediaSelect={handleMediaSelect}
                multiple
                kind='image'
                maxFiles={MAX_IMAGES - count}
            />

            <ImageEditDialog
                image={editing}
                isSaving={isUpdating}
                onOpenChange={open => {
                    if (!open) setEditing(null);
                }}
                onSave={handleSaveEdit}
            />
        </div>
    );
}

// ── Cover panel ─────────────────────────────────────────────────────────────

/**
 * The cover gets a panel of its own because it does a different job from every
 * other photo, and because "which one is the cover" was previously a 10px word
 * on one tile among twenty.
 */
function CoverPanel({
    cover,
    hasImages,
    onEdit,
    onPick,
}: {
    cover: TourImage | null;
    hasImages: boolean;
    onEdit: () => void;
    onPick: () => void;
}) {
    return (
        <section>
            <header className='mb-3 mt-3'>
                <h3 className='text-sm font-semibold text-content'>
                    Cover photo
                </h3>
                <p className='mt-0.5 text-xs text-content-muted'>
                    The one image that sells the tour - it is what travellers
                    see on the listing card, in search results and when your
                    page is shared.
                </p>
            </header>

            {cover ? (
                /* Side by side, not full bleed. A 21:9 band the width of the
                   step turned a portrait photo into a face filling the screen -
                   the panel was previewing a crop nothing on the site actually
                   uses. 3:2 at a third of the width is the listing card's real
                   shape, and small enough to read as a preview. */
                <div className='flex flex-col gap-4 sm:flex-row sm:items-start'>
                    <div className='w-full shrink-0 overflow-hidden rounded-lg border border-line bg-surface-sunken sm:w-64'>
                        <div className='aspect-[3/2]'>
                            <img
                                src={cover.url}
                                alt={cover.altText ?? ''}
                                className='size-full object-cover'
                                // 03 §8.3 exception: a focal point is a continuous
                                // 0..1 pair, and Tailwind's object-position scale is
                                // nine fixed keywords - there is no class for it.
                                // eslint-disable-next-line no-restricted-syntax
                                style={{
                                    objectPosition: focalPosition(
                                        cover.focalX,
                                        cover.focalY,
                                    ),
                                }}
                            />
                        </div>
                    </div>
                    <div className='min-w-0 flex-1 space-y-3'>
                        {cover.altText ? (
                            <p className='text-sm text-content'>
                                {cover.altText}
                            </p>
                        ) : (
                            <p className='text-sm text-warning-fg'>
                                No alt text yet - add one so search engines and
                                screen readers can read it.
                            </p>
                        )}
                        <p className='text-xs text-content-muted'>
                            Pick any photo below with the star button to make it
                            the cover.
                        </p>
                        <Button size='sm' variant='outline' onClick={onEdit}>
                            <HugeiconsIcon
                                icon={PencilEdit02Icon}
                                className='size-3.5'
                            />
                            Edit cover
                        </Button>
                    </div>
                </div>
            ) : (
                <EmptyDrop
                    title={
                        hasImages
                            ? 'No cover chosen yet'
                            : 'Add your first photos'
                    }
                    hint={
                        hasImages
                            ? 'Use the star button on any photo below, or add a new one here - it becomes the cover.'
                            : 'Choose them from the media library. The first one becomes your cover.'
                    }
                    actionLabel='Select from gallery'
                    onAction={onPick}
                />
            )}
        </section>
    );
}

function EmptyDrop({
    title,
    hint,
    actionLabel,
    onAction,
}: {
    title: string;
    hint: string;
    actionLabel: string;
    onAction: () => void;
}) {
    return (
        <div className='flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface-sunken/40 px-6 py-16 text-center'>
            <HugeiconsIcon
                icon={ImageAdd02Icon}
                className='size-8 text-content-subtle'
            />
            <p className='text-sm font-medium text-content'>{title}</p>
            <p className='max-w-80 text-xs text-content-muted'>{hint}</p>
            <Button size='sm' className='mt-2' onClick={onAction}>
                <HugeiconsIcon icon={PlusSignIcon} className='size-3.5' />
                {actionLabel}
            </Button>
        </div>
    );
}

// ── Gallery tiles ───────────────────────────────────────────────────────────

function AddTile({
    disabled,
    onClick,
}: {
    disabled: boolean;
    onClick: () => void;
}) {
    const reduceMotion = useReducedMotion();
    return (
        <motion.button
            type='button'
            onClick={onClick}
            disabled={disabled}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            transition={springPop}
            className='flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-line-strong bg-surface-sunken/40 text-content-muted transition-colors duration-fast hover:border-primary hover:text-content disabled:opacity-60'>
            <HugeiconsIcon icon={PlusSignIcon} className='size-5' />
            <span className='text-xs font-medium'>Add photos</span>
        </motion.button>
    );
}

interface ImageTileProps {
    img: TourImage;
    index: number;
    total: number;
    isDeleting: boolean;
    isBusy: boolean;
    isDragging: boolean;
    onDragBegin: (imageId: string) => void;
    onDragOverTile: (toId: string) => void;
    onDragFinish: () => void;
    onNudge: (index: number, direction: -1 | 1) => void;
    onSetCover: (imageId: string) => void;
    onDelete: (imageId: string) => void;
    onEdit: () => void;
}

function ImageTile({
    img,
    index,
    total,
    isDeleting,
    isBusy,
    isDragging,
    onDragBegin,
    onDragOverTile,
    onDragFinish,
    onNudge,
    onSetCover,
    onDelete,
    onEdit,
}: ImageTileProps) {
    return (
        <div
            draggable
            onDragStart={e => {
                // Firefox refuses to start a drag with no payload attached, and
                // the id is unreadable during `dragenter` anyway (browsers
                // withhold it), so the source is tracked in React state instead.
                e.dataTransfer.setData('text/plain', img.id);
                e.dataTransfer.effectAllowed = 'move';
                onDragBegin(img.id);
            }}
            onDragEnd={onDragFinish}
            onDragOver={e => e.preventDefault()}
            onDragEnter={() => onDragOverTile(img.id)}
            className={cn(
                'group relative overflow-hidden rounded-lg border border-line bg-surface-sunken transition-opacity duration-fast',
                isDragging && 'opacity-40',
                isDeleting && 'pointer-events-none opacity-50',
            )}>
            <div className='aspect-[4/3]'>
                <img
                    src={img.url}
                    alt={img.altText ?? ''}
                    draggable={false}
                    className='size-full object-cover'
                    // 03 §8.3 exception: continuous focal point, see CoverPanel.
                    // eslint-disable-next-line no-restricted-syntax
                    style={{
                        objectPosition: focalPosition(img.focalX, img.focalY),
                    }}
                />
            </div>

            {/* Position + cover state stay visible. They are what the grid is
                for, so hiding them behind hover made the grid say nothing. */}
            <div className='pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-linear-to-b from-black/45 to-transparent p-2'>
                <span className='rounded-full bg-black/45 px-2 py-0.5 text-xs font-medium tabular-nums text-white'>
                    {index + 1}
                </span>
                {img.isHero && (
                    <span className='inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-xs font-medium text-content'>
                        <HugeiconsIcon
                            icon={StarIcon}
                            className='size-3 text-warning-solid'
                        />
                        Cover
                    </span>
                )}
            </div>

            {/* Actions on hover / keyboard focus. `focus-within` matters: the
                buttons are reachable by Tab, and an invisible focused button is
                a trap. */}
            <div className='absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-linear-to-t from-black/55 to-transparent p-2 opacity-0 transition-opacity duration-fast group-hover:opacity-100 group-focus-within:opacity-100'>
                <div className='flex gap-1'>
                    <TileButton
                        label='Move earlier'
                        icon={ArrowLeft02Icon}
                        disabled={isBusy || index === 0}
                        onClick={() => onNudge(index, -1)}
                    />
                    <TileButton
                        label='Move later'
                        icon={ArrowRight02Icon}
                        disabled={isBusy || index === total - 1}
                        onClick={() => onNudge(index, 1)}
                    />
                </div>
                <div className='flex gap-1'>
                    {!img.isHero && (
                        <TileButton
                            label='Make cover'
                            icon={StarIcon}
                            disabled={isBusy}
                            onClick={() => onSetCover(img.id)}
                        />
                    )}
                    <TileButton
                        label='Edit alt text and focal point'
                        icon={PencilEdit02Icon}
                        disabled={isBusy}
                        onClick={onEdit}
                    />
                    <TileButton
                        label='Remove photo'
                        icon={Delete02Icon}
                        danger
                        disabled={isDeleting}
                        onClick={() => onDelete(img.id)}
                    />
                </div>
            </div>

            {/* Drag affordance - the cursor alone never announced this. */}
            <span className='pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white opacity-0 transition-opacity duration-fast group-hover:opacity-100'>
                <HugeiconsIcon icon={Move02Icon} className='size-4' />
            </span>
        </div>
    );
}

function TileButton({
    label,
    icon,
    onClick,
    disabled,
    danger,
}: {
    label: string;
    icon: typeof StarIcon;
    onClick: () => void;
    disabled?: boolean;
    danger?: boolean;
}) {
    const reduceMotion = useReducedMotion();
    return (
        <motion.button
            type='button'
            title={label}
            aria-label={label}
            onClick={onClick}
            disabled={disabled}
            whileTap={reduceMotion ? undefined : { scale: 0.9 }}
            transition={springPop}
            className={cn(
                'grid size-6 place-items-center rounded-md bg-white/95 text-content transition-colors duration-fast disabled:opacity-40',
                danger ? 'hover:bg-danger-solid hover:text-white' : 'hover:bg-white',
            )}>
            <HugeiconsIcon icon={icon} className='size-3.5' />
        </motion.button>
    );
}

// ── Edit dialog: alt text + focal point ─────────────────────────────────────

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
    const [focal, setFocal] = useState({ x: 0.5, y: 0.5 });
    const [seededId, setSeededId] = useState<string | null>(null);

    if (image && image.id !== seededId) {
        setSeededId(image.id);
        setAltText(image.altText ?? '');
        setFocal({
            x: clampFocal(image.focalX ?? 0.5),
            y: clampFocal(image.focalY ?? 0.5),
        });
    }
    // Reset the seed when the dialog closes, so reopening the SAME image re-seeds
    // from the server instead of showing the edits the operator just discarded
    // (code-review M9). Guarded → self-terminating, like the seed above.
    if (image === null && seededId !== null) {
        setSeededId(null);
    }

    function handleSubmit() {
        onSave({
            altText: altText.trim() === '' ? undefined : altText.trim(),
            focalX: focal.x,
            focalY: focal.y,
        });
    }

    return (
        <Dialog open={image !== null} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-lg'>
                <DialogHeader>
                    <DialogTitle>Edit photo</DialogTitle>
                    <DialogDescription>
                        Click the photo to choose the part that must stay in
                        frame when it is cropped.
                    </DialogDescription>
                </DialogHeader>

                {image && (
                    <div className='space-y-4'>
                        <FocalPicker
                            url={image.url}
                            alt={altText}
                            focal={focal}
                            onChange={setFocal}
                        />

                        <Field>
                            <Label>Alt text</Label>
                            <Input
                                value={altText}
                                onChange={e => setAltText(e.target.value)}
                                placeholder='Snorkellers above a reef at Playa Kalki'
                            />
                        </Field>
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
                    <Button size='sm' onClick={handleSubmit} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Focal point by pointing at it.
 *
 * Writes the same two 0..1 floats the number inputs did - this is presentation
 * only. What it adds is the answer to the question those inputs could not
 * answer: what does 0.3 / 0.7 actually look like once the card crops it. The
 * two previews are the shapes the public site really uses, a wide listing card
 * and a square thumbnail.
 */
function FocalPicker({
    url,
    alt,
    focal,
    onChange,
}: {
    url: string;
    alt: string;
    focal: { x: number; y: number };
    onChange: (next: { x: number; y: number }) => void;
}) {
    const frame = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState(false);

    function pick(clientX: number, clientY: number) {
        const box = frame.current?.getBoundingClientRect();
        if (!box || box.width === 0 || box.height === 0) return;
        onChange({
            x: clampFocal((clientX - box.left) / box.width),
            y: clampFocal((clientY - box.top) / box.height),
        });
    }

    return (
        <div className='space-y-3'>
            <div
                ref={frame}
                onPointerDown={e => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setDragging(true);
                    pick(e.clientX, e.clientY);
                }}
                onPointerMove={e => {
                    if (dragging) pick(e.clientX, e.clientY);
                }}
                onPointerUp={e => {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                    setDragging(false);
                }}
                className='relative aspect-video cursor-crosshair touch-none overflow-hidden rounded-lg bg-surface-sunken select-none'>
                <img
                    src={url}
                    alt={alt}
                    draggable={false}
                    className='size-full object-cover'
                />
                <span
                    aria-hidden
                    className='pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md ring-1 ring-black/30'
                    // 03 §8.3 exception: the ring tracks a continuous pointer position.
                    // eslint-disable-next-line no-restricted-syntax
                    style={{
                        left: `${focal.x * 100}%`,
                        top: `${focal.y * 100}%`,
                    }}
                />
            </div>

            <div className='flex items-center gap-3'>
                <CropPreview
                    url={url}
                    focal={focal}
                    label='Listing card'
                    className='aspect-[3/2] w-32'
                />
                <CropPreview
                    url={url}
                    focal={focal}
                    label='Thumbnail'
                    className='aspect-square w-16'
                />
                <p className='text-xs text-content-muted'>
                    Drag the ring to keep the important part in frame.
                </p>
            </div>
        </div>
    );
}

function CropPreview({
    url,
    focal,
    label,
    className,
}: {
    url: string;
    focal: { x: number; y: number };
    label: string;
    className?: string;
}) {
    return (
        <div className='shrink-0'>
            <div
                className={cn(
                    'overflow-hidden rounded-md bg-surface-sunken',
                    className,
                )}>
                <img
                    src={url}
                    alt=''
                    draggable={false}
                    className='size-full object-cover'
                    // 03 §8.3 exception: continuous focal point, see CoverPanel.
                    // eslint-disable-next-line no-restricted-syntax
                    style={{ objectPosition: focalPosition(focal.x, focal.y) }}
                />
            </div>
            <p className='mt-1 text-center text-xs text-content-subtle'>
                {label}
            </p>
        </div>
    );
}
