'use client';

import {
    ArrowDown02Icon,
    ArrowUp02Icon,
    Cancel01Icon,
    Image02Icon,
    ImageAdd02Icon,
    PencilEdit02Icon,
    PlayIcon,
    PlusSignIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { ImageSelectorField } from '@/components/common/image-selector-field';
import { VideoSelectorField } from '@/components/common/video-selector-field';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
    useCreateFeaturedExperience,
    useDeleteFeaturedExperience,
    useFeaturedExperiences,
    useReorderFeaturedExperiences,
    useUpdateFeaturedExperience,
} from '@/hooks/home-page/use-home-page';
import {
    MIN_CURATED_EXPERIENCES,
    RECOMMENDED_MAX_EXPERIENCES,
} from '@/lib/home-page/defaults';
import type { FeaturedExperience } from '@/types/home-page';

/**
 * Top Island Experiences - the only homepage tab that is curation rather than
 * content, which is why it is its own tab and not part of Details.
 *
 * Cards are STANDALONE PRESENTATION (founder, 2026-08-04): an admin-typed
 * label + poster + optional video. They reference no category or hub and link
 * nowhere - the reel is a mood board of the platform's activities. The label
 * is a single admin-entered string, not translated across locales.
 *
 * The heading ABOVE the carousel is per-locale copy and lives in Page Content
 * with the rest of the page's words; this tab is only the deck.
 */
export function HomepageExperiencesTab() {
    return <ExperiencesCurationCard />;
}

/**
 * The curated deck, shown AS a deck.
 *
 * This is a visual section of the public site, so the editor is a grid of the
 * cards themselves rather than a list of names - an admin choosing what leads
 * the homepage is making a visual decision and could not see a single image
 * before. Ordering is the grid order, moved with the same arrow controls the
 * tour-images tab uses.
 *
 * One thing this UI exists to prevent, otherwise silent: below
 * MIN_CURATED_EXPERIENCES showable cards the section stays off the homepage
 * entirely (there is no bundled fallback deck), so adding one or two changes
 * nothing visible. The notice says so with the live count.
 */
function ExperiencesCurationCard() {
    const { data: experiences = [], isLoading } = useFeaturedExperiences();
    const create = useCreateFeaturedExperience();
    const update = useUpdateFeaturedExperience();
    const reorder = useReorderFeaturedExperiences();
    const remove = useDeleteFeaturedExperience();

    const [addOpen, setAddOpen] = useState(false);
    const [editing, setEditing] = useState<FeaturedExperience | null>(null);
    const [pendingDelete, setPendingDelete] =
        useState<FeaturedExperience | null>(null);

    // The grid order IS the carousel order; the arrows act on this sorted view.
    const ordered = [...experiences].sort(
        (a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id)
    );
    // Cards that can actually REACH the homepage: switched on AND carrying a
    // poster - the public site drops a posterless card (a grey rectangle is
    // not a card), and the minimum-to-show rule is applied to what survives.
    const showingCount = ordered.filter(e => e.isActive && e.posterUrl).length;
    const isBusy = update.isPending || reorder.isPending;

    function handleMove(index: number, direction: 'up' | 'down') {
        const target = direction === 'up' ? index - 1 : index + 1;
        if (target < 0 || target >= ordered.length) return;

        const next = [...ordered];
        [next[index], next[target]] = [next[target], next[index]];

        reorder.mutate(next, {
            onError: err =>
                toast.error(
                    err instanceof Error
                        ? err.message
                        : 'Failed to reorder the cards.'
                ),
        });
    }

    // ONE dialog for both paths (founder, 2026-08-04: adding is one step, not
    // "create, then reopen for media") - creating and editing are the same
    // form: label + poster + video.
    function handleSaveCard(payload: {
        title: string;
        posterUrl: string | null;
        videoUrl: string | null;
    }) {
        if (editing) {
            update.mutate(
                { id: editing.id, payload },
                {
                    onSuccess: () => {
                        toast.success('Card updated.');
                        setEditing(null);
                    },
                    onError: err =>
                        toast.error(
                            err instanceof Error
                                ? err.message
                                : 'Failed to save the card.'
                        ),
                }
            );
            return;
        }
        create.mutate(
            { ...payload, displayOrder: ordered.length },
            {
                onSuccess: created => {
                    toast.success('Added to the homepage.', {
                        duration: 10_000,
                        action: {
                            label: 'Undo',
                            onClick: () =>
                                remove.mutate(created.id, {
                                    onSuccess: () =>
                                        toast.success(
                                            'Card removed from the homepage.'
                                        ),
                                    onError: err =>
                                        toast.error(
                                            err instanceof Error
                                                ? err.message
                                                : 'Undo failed - the card is still on the homepage.'
                                        ),
                                }),
                        },
                    });
                    setAddOpen(false);
                },
                onError: err =>
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Could not add that card.'
                    ),
            }
        );
    }

    return (
        <Card>
            <CardHeader className='border-b pb-4'>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                    <div>
                        <div className='flex flex-wrap items-center gap-3'>
                            <CardTitle className='text-lg font-medium'>
                                Featured Cards
                            </CardTitle>
                            {!isLoading && ordered.length > 0 && (
                                <Badge variant='secondary'>
                                    {showingCount} showing of {ordered.length}
                                </Badge>
                            )}
                        </div>
                        <CardDescription>
                            Standalone presentation cards - a label, a poster
                            and an optional video. They link nowhere and
                            reference nothing; the reel is a mood board of what
                            the islands offer.
                        </CardDescription>
                    </div>
                    <Button
                        size='sm'
                        onClick={() => setAddOpen(true)}
                        disabled={create.isPending}>
                        <HugeiconsIcon
                            icon={PlusSignIcon}
                            className='size-3.5'
                        />
                        Add a card
                    </Button>
                </div>
            </CardHeader>

            <CardContent className='space-y-6 pt-6'>
                {isLoading ? (
                    <div className='grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-4'>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton
                                key={i}
                                className='aspect-[3/4] w-full rounded-md'
                            />
                        ))}
                    </div>
                ) : (
                    <>
                        <CurationNotice count={showingCount} />

                        {ordered.length === 0 ? (
                            <div className='flex flex-col items-center gap-2 rounded-md border border-dashed border-line py-16 text-content-muted'>
                                <HugeiconsIcon
                                    icon={Image02Icon}
                                    className='size-10 opacity-30'
                                />
                                <p className='text-sm'>
                                    No cards yet - the homepage section is
                                    hidden until there are{' '}
                                    {MIN_CURATED_EXPERIENCES} to show.
                                </p>
                                <Button
                                    size='sm'
                                    variant='outline'
                                    onClick={() => setAddOpen(true)}>
                                    Add a card
                                </Button>
                            </div>
                        ) : (
                            <div className='grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-4'>
                                {ordered.map((exp, index) => (
                                    <ExperienceCard
                                        key={exp.id}
                                        experience={exp}
                                        index={index}
                                        total={ordered.length}
                                        disabled={isBusy}
                                        onMove={handleMove}
                                        onEdit={() => setEditing(exp)}
                                        onDelete={() => setPendingDelete(exp)}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </CardContent>

            <CardDialog
                open={addOpen || Boolean(editing)}
                experience={editing}
                isSaving={create.isPending || update.isPending}
                onOpenChange={open => {
                    if (!open) {
                        setAddOpen(false);
                        setEditing(null);
                    }
                }}
                onSave={handleSaveCard}
            />

            <AlertDialog
                open={Boolean(pendingDelete)}
                onOpenChange={open => !open && setPendingDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove this card?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingDelete?.title ?? 'This card'} stops
                            appearing on the homepage.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep it</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (pendingDelete)
                                    remove.mutate(pendingDelete.id);
                                setPendingDelete(null);
                            }}>
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}

/** States plainly what the current card count means for the live homepage. */
function CurationNotice({ count }: { count: number }) {
    if (count === 0) return null;

    if (count < MIN_CURATED_EXPERIENCES) {
        return (
            <p className='rounded-md bg-surface-inset p-3 text-xs text-content-muted'>
                The homepage needs at least {MIN_CURATED_EXPERIENCES} live cards
                before the section shows - below that it stays off the page
                entirely, so these {count} are not showing yet.
            </p>
        );
    }

    if (count > RECOMMENDED_MAX_EXPERIENCES) {
        return (
            <p className='rounded-md bg-surface-inset p-3 text-xs text-content-muted'>
                {count} active cards. The carousel is designed around{' '}
                {RECOMMENDED_MAX_EXPERIENCES} - beyond that the dot row crowds
                and only the first eight ever render.
            </p>
        );
    }

    return null;
}

/**
 * One card, drawn at the carousel's own portrait ratio so the grid reads as a
 * preview of the section rather than a table of it. Controls appear on hover
 * (and on focus, so they are reachable from the keyboard).
 */
function ExperienceCard({
    experience,
    index,
    total,
    disabled,
    onMove,
    onEdit,
    onDelete,
}: {
    experience: FeaturedExperience;
    index: number;
    total: number;
    disabled: boolean;
    onMove: (index: number, direction: 'up' | 'down') => void;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const poster = experience.posterUrl;

    return (
        <div className='group relative overflow-hidden rounded-md border border-line bg-surface-raised focus-within:ring-2 focus-within:ring-ring/30'>
            <div className='relative aspect-[3/4] bg-surface-inset'>
                {/*
                 * The whole surface opens the edit dialog - the poster IS the thing
                 * you click a card to change. It is a sibling of the control buttons,
                 * never their parent: a button inside a button is invalid and the
                 * inner one stops working.
                 */}
                <button
                    type='button'
                    onClick={onEdit}
                    disabled={disabled}
                    aria-label={`Edit ${experience.title}`}
                    className='absolute inset-0 cursor-pointer disabled:cursor-not-allowed'>
                    {poster ? (
                        // Cloudinary URLs on an admin-only screen: next/image would buy
                        // nothing here and its config is the public site's concern.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={poster}
                            alt=''
                            className={
                                experience.isActive
                                    ? 'size-full object-cover'
                                    : 'size-full object-cover opacity-40 grayscale'
                            }
                        />
                    ) : (
                        /*
                         * No poster. The public site DROPS a posterless card, so the
                         * slot asks for the media it is missing and says what that
                         * means, rather than pretending the card is done.
                         */
                        <span className='flex size-full flex-col items-center justify-center gap-2 border border-dashed border-line p-3 text-center transition-colors hover:border-primary/60 hover:bg-primary/2'>
                            <span className='flex size-10 items-center justify-center rounded-full bg-muted'>
                                <HugeiconsIcon
                                    icon={ImageAdd02Icon}
                                    className='size-5 text-content-muted'
                                />
                            </span>
                            <span className='text-xs font-medium'>
                                Add poster and video
                            </span>
                            <span className='text-xs font-medium text-danger-fg'>
                                Not showing - a card needs a poster
                            </span>
                        </span>
                    )}
                </button>

                {/* Position, always visible: the number IS the carousel order. */}
                <span className='pointer-events-none absolute left-2 top-2 rounded-full bg-n-1000/70 px-2 py-0.5 text-2xs font-medium text-n-0 tabular-nums'>
                    {index + 1}
                </span>

                {experience.videoUrl && (
                    // Fades on hover: the action buttons take this corner.
                    <span className='pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-n-1000/70 px-2 py-0.5 text-2xs font-medium text-n-0 transition-opacity group-focus-within:opacity-0 group-hover:opacity-0'>
                        <HugeiconsIcon icon={PlayIcon} className='size-3' />
                        Video
                    </span>
                )}

                {!experience.isActive && (
                    <span className='pointer-events-none absolute inset-x-2 bottom-2 rounded-md bg-n-1000/70 px-2 py-1 text-center text-2xs font-medium text-n-0'>
                        Hidden from the homepage
                    </span>
                )}

                {/* Reorder (bottom-left on hover), matching the tour-images tab. */}
                <div className='absolute bottom-2 left-2 z-10 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100'>
                    <Button
                        size='icon-sm'
                        variant='secondary'
                        onClick={() => onMove(index, 'up')}
                        disabled={disabled || index === 0}
                        title='Move earlier'>
                        <HugeiconsIcon
                            icon={ArrowUp02Icon}
                            className='size-3'
                        />
                    </Button>
                    <Button
                        size='icon-sm'
                        variant='secondary'
                        onClick={() => onMove(index, 'down')}
                        disabled={disabled || index === total - 1}
                        title='Move later'>
                        <HugeiconsIcon
                            icon={ArrowDown02Icon}
                            className='size-3'
                        />
                    </Button>
                </div>

                {/* Remove: always visible, not hover-revealed - the same corner control
            every other media field in this dashboard uses (ImageSelectorField,
            the Instagram tiles), so removing a card works the way removing a
            picked image already does. */}
                <button
                    type='button'
                    onClick={onDelete}
                    title='Remove card'
                    className='absolute right-1.5 top-1.5 z-10 flex size-5 items-center justify-center bg-black/60 text-white transition-colors hover:bg-destructive'>
                    <HugeiconsIcon icon={Cancel01Icon} className='size-3' />
                    <span className='sr-only'>Remove card</span>
                </button>

                {/* Edit affordance: centred, revealed on hover, with no chip or surface
            of its own - the icon sits straight on the image so the card reads as
            one target rather than a photo with a button parked on it.
            `pointer-events-none` on purpose: the whole card is ALREADY the edit
            button (the <button inset-0> above), so this must not intercept the
            click, and a second nested button would be invalid markup anyway.
            Only over a real poster - the empty slot has its own "Add poster and
            video" prompt, which says more than a pencil would. */}
                {poster && (
                    <span className='pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-white opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100'>
                        <HugeiconsIcon
                            icon={PencilEdit02Icon}
                            className='size-7 drop-shadow-lg'
                        />
                    </span>
                )}
            </div>

            <div className='p-3'>
                <p className='truncate text-sm font-medium'>
                    {experience.title}
                </p>
            </div>
        </div>
    );
}
/**
 * Label, poster and video, together in ONE dialog for both creating and
 * editing (founder, 2026-08-04: adding a card is one step, not "create, then
 * reopen for media"). A card is one decision: the poster is what the card
 * shows when it is not the centred slide, AND the frame the video holds
 * before it plays.
 */
function CardDialog({
    open,
    experience,
    isSaving,
    onOpenChange,
    onSave,
}: {
    open: boolean;
    /** Null = creating a new card. */
    experience: FeaturedExperience | null;
    isSaving: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (payload: {
        title: string;
        posterUrl: string | null;
        videoUrl: string | null;
    }) => void;
}) {
    const [title, setTitle] = useState('');
    const [posterUrl, setPosterUrl] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);

    // Re-seed on every open: from the row when editing, blank when creating.
    useEffect(() => {
        if (!open) return;
        setTitle(experience?.title ?? '');
        setPosterUrl(experience?.posterUrl ?? null);
        setVideoUrl(experience?.videoUrl ?? null);
    }, [open, experience]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-lg'>
                <DialogHeader>
                    <DialogTitle>
                        {experience ? experience.title : 'Add a card'}
                    </DialogTitle>
                    <DialogDescription>
                        The label, photo and video for this card. Cards are
                        presentation only - they do not link anywhere.
                    </DialogDescription>
                </DialogHeader>

                <div className='space-y-6 py-2'>
                    <Field>
                        <Label>Label</Label>
                        <FieldDescription>
                            Shown on the card exactly as typed, in every
                            language.
                        </FieldDescription>
                        <Input
                            value={title}
                            maxLength={80}
                            autoFocus={!experience}
                            onChange={e => setTitle(e.target.value)}
                            placeholder='e.g. Sunset Cruises'
                        />
                    </Field>

                    <Field>
                        <Label>Poster</Label>
                        <FieldDescription>
                            The still shown on the card, and the frame the video
                            holds before it plays. Portrait crops work best -
                            the slot is taller than it is wide. Without one the
                            homepage skips this card.
                        </FieldDescription>
                        <ImageSelectorField
                            value={posterUrl}
                            onChange={setPosterUrl}
                        />
                    </Field>

                    <Field>
                        <Label>Video</Label>
                        <FieldDescription>
                            Plays when this card is the centred slide. Optional
                            - without one the card just shows its poster.
                        </FieldDescription>
                        <VideoSelectorField
                            value={videoUrl}
                            onChange={setVideoUrl}
                        />
                    </Field>
                </div>

                <DialogFooter>
                    <Button
                        type='button'
                        variant='outline'
                        disabled={isSaving}
                        onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        type='button'
                        disabled={isSaving || title.trim().length === 0}
                        onClick={() =>
                            onSave({
                                title: title.trim(),
                                posterUrl,
                                videoUrl,
                            })
                        }>
                        {isSaving
                            ? 'Saving...'
                            : experience
                              ? 'Save card'
                              : 'Add card'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
