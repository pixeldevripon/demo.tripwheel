'use client';

import {
  Alert02Icon,
  ArrowDown02Icon,
  ArrowUp02Icon,
  Delete02Icon,
  Image02Icon,
  PencilEdit02Icon,
  PlayIcon,
  PlusSignIcon,
  ViewIcon,
  ViewOffIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { ImageSelectorField } from '@/components/common/image-selector-field';
import { StatusBadge } from '@/components/common/status-badge';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useActiveCategories } from '@/hooks/categories/use-categories';
import {
  useCreateFeaturedExperience,
  useDeleteFeaturedExperience,
  useFeaturedExperiences,
  useReorderFeaturedExperiences,
  useUpdateFeaturedExperience,
} from '@/hooks/home-page/use-home-page';
import { useHubs } from '@/hooks/hubs/use-hubs';
import {
  MIN_CURATED_EXPERIENCES,
  RECOMMENDED_MAX_EXPERIENCES,
} from '@/lib/home-page/defaults';
import type {
  FeaturedEntityType,
  FeaturedExperience,
} from '@/types/home-page';

/**
 * Top Island Experiences - the only homepage tab that is curation rather than
 * content, which is why it is its own tab and not part of Details.
 *
 * The heading ABOVE the carousel is per-locale copy and lives in Page Content
 * with the rest of the page's words; this tab is only the deck.
 */
export function HomepageExperiencesTab() {
  return <ExperiencesCurationCard />;
}

/** What the card will actually show: the poster, else the target's own photo. */
function effectiveImage(exp: FeaturedExperience) {
  return exp.posterUrl || exp.entityImage;
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
 * Two things this UI exists to prevent, both otherwise silent:
 *
 * 1. A curated row can be dropped by the public site with no error - nothing
 *    is featured unless its target has a live tour. For hubs that bar is
 *    HIGHER than the hub page's own (a hub with no tours still renders a valid
 *    page), which is exactly the case an admin cannot deduce.
 * 2. Below MIN_CURATED_EXPERIENCES live cards the site ignores curation
 *    entirely and keeps its bundled deck, so adding one or two changes nothing
 *    on the homepage.
 */
function ExperiencesCurationCard() {
  const { data: experiences = [], isLoading } = useFeaturedExperiences();
  const create = useCreateFeaturedExperience();
  const update = useUpdateFeaturedExperience();
  const reorder = useReorderFeaturedExperiences();
  const remove = useDeleteFeaturedExperience();

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<FeaturedExperience | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FeaturedExperience | null>(
    null,
  );

  // The grid order IS the carousel order; the arrows act on this sorted view.
  const ordered = [...experiences].sort(
    (a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id),
  );
  const activeCount = ordered.filter(e => e.isActive).length;
  const isBusy = update.isPending || reorder.isPending;

  function handleMove(index: number, direction: 'up' | 'down') {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= ordered.length) return;

    const next = [...ordered];
    [next[index], next[target]] = [next[target], next[index]];

    reorder.mutate(next, {
      onError: err =>
        toast.error(
          err instanceof Error ? err.message : 'Failed to reorder the cards.',
        ),
    });
  }

  function handleToggle(exp: FeaturedExperience) {
    update.mutate(
      { id: exp.id, payload: { isActive: !exp.isActive } },
      {
        onSuccess: () =>
          toast.success(exp.isActive ? 'Card hidden.' : 'Card is live.'),
        onError: err =>
          toast.error(
            err instanceof Error ? err.message : 'Failed to update the card.',
          ),
      },
    );
  }

  function handleSaveMedia(payload: {
    posterUrl: string | null;
    videoUrl: string | null;
  }) {
    if (!editing) return;
    update.mutate(
      { id: editing.id, payload },
      {
        onSuccess: () => {
          toast.success('Card media updated.');
          setEditing(null);
        },
        onError: err =>
          toast.error(
            err instanceof Error ? err.message : 'Failed to save the media.',
          ),
      },
    );
  }

  return (
    <Card>
      <CardHeader className='border-b pb-4'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <div className='flex flex-wrap items-center gap-3'>
              <CardTitle className='text-lg font-semibold'>
                Featured Cards
              </CardTitle>
              {!isLoading && ordered.length > 0 && (
                <Badge variant='secondary'>
                  {activeCount} live of {ordered.length}
                </Badge>
              )}
            </div>
            <CardDescription>
              Categories and hubs only - individual tours are never featured
              here. Each card links to that page and takes its title from it, so
              the two can never disagree.
            </CardDescription>
          </div>
          <Button
            size='sm'
            onClick={() => setAddOpen(true)}
            disabled={create.isPending}>
            <HugeiconsIcon icon={PlusSignIcon} className='size-3.5' />
            Feature a page
          </Button>
        </div>
      </CardHeader>

      <CardContent className='space-y-6 pt-6'>
        {isLoading ? (
          <div className='grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4'>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className='aspect-[3/4] w-full rounded-md' />
            ))}
          </div>
        ) : (
          <>
            <CurationNotice count={activeCount} />

            {ordered.length === 0 ? (
              <div className='flex flex-col items-center gap-2 rounded-md border border-dashed border-line py-16 text-content-muted'>
                <HugeiconsIcon
                  icon={Image02Icon}
                  className='size-10 opacity-30'
                />
                <p className='text-sm'>
                  Nothing featured yet - the homepage is showing its built-in
                  cards.
                </p>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => setAddOpen(true)}>
                  Feature a page
                </Button>
              </div>
            ) : (
              <div className='grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4'>
                {ordered.map((exp, index) => (
                  <ExperienceCard
                    key={exp.id}
                    experience={exp}
                    index={index}
                    total={ordered.length}
                    disabled={isBusy}
                    onMove={handleMove}
                    onToggle={() => handleToggle(exp)}
                    onEdit={() => setEditing(exp)}
                    onDelete={() => setPendingDelete(exp)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>

      <AddExperienceDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        isPending={create.isPending}
        onAdd={(entityType, entityId) =>
          create.mutate(
            { entityType, entityId, displayOrder: ordered.length },
            {
              onSuccess: () => {
                toast.success('Added to the homepage.');
                setAddOpen(false);
              },
              // 409 when this entity is already featured at the same scope -
              // surfaced rather than silently duplicating.
              onError: err =>
                toast.error(
                  err instanceof Error ? err.message : 'Could not feature that.',
                ),
            },
          )
        }
      />

      <CardMediaDialog
        experience={editing}
        isSaving={update.isPending}
        onOpenChange={open => !open && setEditing(null)}
        onSave={handleSaveMedia}
      />

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={open => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this card?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.entityName ?? 'This card'} stops appearing on the
              homepage. The category or hub itself is not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) remove.mutate(pendingDelete.id);
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
        The homepage needs at least {MIN_CURATED_EXPERIENCES} live cards before
        it uses your selection - below that it keeps its built-in deck, so these{' '}
        {count} are not showing yet.
      </p>
    );
  }

  if (count > RECOMMENDED_MAX_EXPERIENCES) {
    return (
      <p className='rounded-md bg-surface-inset p-3 text-xs text-content-muted'>
        {count} active cards. The carousel is designed around{' '}
        {RECOMMENDED_MAX_EXPERIENCES} - beyond that the dot row crowds and only
        the first eight ever render.
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
  onToggle,
  onEdit,
  onDelete,
}: {
  experience: FeaturedExperience;
  index: number;
  total: number;
  disabled: boolean;
  onMove: (index: number, direction: 'up' | 'down') => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const missing = experience.entityName === null;
  const image = effectiveImage(experience);

  return (
    <div className='group relative overflow-hidden rounded-md border border-line bg-surface-raised focus-within:ring-2 focus-within:ring-ring/30'>
      <div className='relative aspect-[3/4] bg-surface-inset'>
        {image ? (
          // Cloudinary URLs on an admin-only screen: next/image would buy
          // nothing here and its config is the public site's concern.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=''
            className={
              experience.isActive
                ? 'size-full object-cover'
                : 'size-full object-cover opacity-40 grayscale'
            }
          />
        ) : (
          <div className='flex size-full flex-col items-center justify-center gap-1 text-content-subtle'>
            <HugeiconsIcon icon={Image02Icon} className='size-8 opacity-40' />
            <span className='px-2 text-center text-xs'>
              No photo - the site uses its bundled card art
            </span>
          </div>
        )}

        {/* Position, always visible: the number IS the carousel order. */}
        <span className='absolute left-2 top-2 rounded-full bg-n-1000/70 px-2 py-0.5 text-2xs font-medium text-n-0 tabular-nums'>
          {index + 1}
        </span>

        {experience.videoUrl && (
          <span className='absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-n-1000/70 px-2 py-0.5 text-2xs font-medium text-n-0'>
            <HugeiconsIcon icon={PlayIcon} className='size-3' />
            Video
          </span>
        )}

        {!experience.isActive && (
          <span className='absolute inset-x-2 bottom-2 rounded-md bg-n-1000/70 px-2 py-1 text-center text-2xs font-medium text-n-0'>
            Hidden from the homepage
          </span>
        )}

        {/* Reorder (bottom-left on hover), matching the tour-images tab. */}
        <div className='absolute bottom-2 left-2 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100'>
          <Button
            size='icon-sm'
            variant='secondary'
            onClick={() => onMove(index, 'up')}
            disabled={disabled || index === 0}
            title='Move earlier'>
            <HugeiconsIcon icon={ArrowUp02Icon} className='size-3' />
          </Button>
          <Button
            size='icon-sm'
            variant='secondary'
            onClick={() => onMove(index, 'down')}
            disabled={disabled || index === total - 1}
            title='Move later'>
            <HugeiconsIcon icon={ArrowDown02Icon} className='size-3' />
          </Button>
        </div>

        {/* Edit / show-hide / remove (top-right on hover). */}
        <div className='absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100'>
          <Button
            size='icon-sm'
            variant='secondary'
            onClick={onEdit}
            disabled={disabled}
            title='Poster and video'>
            <HugeiconsIcon icon={PencilEdit02Icon} className='size-3' />
          </Button>
          <Button
            size='icon-sm'
            variant='secondary'
            onClick={onToggle}
            disabled={disabled}
            title={
              experience.isActive
                ? 'Hide from the homepage'
                : 'Show on the homepage'
            }>
            <HugeiconsIcon
              icon={experience.isActive ? ViewOffIcon : ViewIcon}
              className='size-3'
            />
          </Button>
          <Button
            size='icon-sm'
            variant='destructive'
            onClick={onDelete}
            title='Remove card'>
            <HugeiconsIcon icon={Delete02Icon} className='size-3' />
          </Button>
        </div>
      </div>

      <div className='space-y-1.5 p-3'>
        <p className='truncate text-sm font-medium'>
          {experience.entityName ?? 'Deleted item'}
        </p>
        <div className='flex flex-wrap items-center gap-1.5'>
          <StatusBadge variant='neutral'>
            {experience.entityType === 'HUB' ? 'Hub' : 'Category'}
          </StatusBadge>
          {missing && <StatusBadge variant='danger'>Target deleted</StatusBadge>}
          {!experience.posterUrl && !missing && experience.entityImage && (
            <span className='text-xs text-content-muted'>
              Using the page photo
            </span>
          )}
        </div>
        {missing && (
          <p className='flex items-start gap-1.5 text-xs text-danger-fg'>
            <HugeiconsIcon
              icon={Alert02Icon}
              className='mt-px size-3 shrink-0'
            />
            The category or hub this pointed at no longer exists, so the homepage
            skips it. Remove this card.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Poster and video, together in one dialog.
 *
 * They belong together because they are one decision: the poster is what the
 * card shows when it is not the centred slide, AND the frame the video holds
 * before it plays. Editing them apart is what made the old inline row both tall
 * and confusing.
 */
function CardMediaDialog({
  experience,
  isSaving,
  onOpenChange,
  onSave,
}: {
  experience: FeaturedExperience | null;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: {
    posterUrl: string | null;
    videoUrl: string | null;
  }) => void;
}) {
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    setPosterUrl(experience?.posterUrl ?? null);
    setVideoUrl(experience?.videoUrl ?? null);
  }, [experience]);

  const fallback = experience?.entityImage ?? null;

  return (
    <Dialog open={Boolean(experience)} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>
            {experience?.entityName ?? 'Card'} media
          </DialogTitle>
          <DialogDescription>
            The photo and video for this card only. Neither changes the category
            or hub page itself.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-6 py-2'>
          <Field>
            <Label>Poster</Label>
            <FieldDescription>
              The still shown on the card, and the frame the video holds before
              it plays. Portrait crops work best - the slot is taller than it is
              wide.
              {!posterUrl &&
                (fallback
                  ? ' Empty, so this card is using the photo from the page it links to.'
                  : ' Empty, and that page has no photo either, so the site is using its bundled card art.')}
            </FieldDescription>
            <ImageSelectorField value={posterUrl} onChange={setPosterUrl} />
          </Field>

          <Field>
            <Label>Video</Label>
            <FieldDescription>
              Plays when this card is the centred slide. Optional - without one
              the card just shows its poster.
            </FieldDescription>
            <VideoSelectorField value={videoUrl} onChange={setVideoUrl} />
          </Field>
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type='button'
            disabled={isSaving}
            onClick={() => onSave({ posterUrl, videoUrl })}>
            {isSaving ? 'Saving...' : 'Save media'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Pick a category or hub to feature. Tours are deliberately not offered.
 *
 * A dialog rather than a permanently open form at the bottom of the grid:
 * adding is occasional, and the form was competing with the deck for attention.
 */
function AddExperienceDialog({
  open,
  onOpenChange,
  isPending,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  onAdd: (entityType: FeaturedEntityType, entityId: string) => void;
}) {
  const [entityType, setEntityType] = useState<FeaturedEntityType>('CATEGORY');
  const [entityId, setEntityId] = useState('');

  const { data: categories = [] } = useActiveCategories();
  const { data: hubsPage } = useHubs({ limit: 100 });
  const hubs = hubsPage?.data ?? [];

  const options =
    entityType === 'CATEGORY'
      ? categories.map(c => ({ id: c.id, name: c.name }))
      : hubs.map(h => ({ id: h.id, name: h.name }));

  useEffect(() => {
    if (!open) setEntityId('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Feature a page</DialogTitle>
          <DialogDescription>
            The card takes its title and link from the page you choose. Add its
            poster and video afterwards.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-6 py-2'>
          <Field>
            <Label>Type</Label>
            <Select
              value={entityType}
              onValueChange={v => {
                setEntityType(v as FeaturedEntityType);
                setEntityId('');
              }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='CATEGORY'>Category</SelectItem>
                <SelectItem value='HUB'>Hub</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <Label>{entityType === 'CATEGORY' ? 'Category' : 'Hub'}</Label>
            <Select value={entityId} onValueChange={setEntityId}>
              <SelectTrigger>
                <SelectValue placeholder='Choose one' />
              </SelectTrigger>
              <SelectContent>
                {options.map(o => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              A card only appears once its target has at least one live tour.
              Hubs are held to that too, even though a hub page itself opens
              without one - a featured experience with nothing bookable is a dead
              end.
            </FieldDescription>
          </Field>
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type='button'
            disabled={!entityId || isPending}
            onClick={() => onAdd(entityType, entityId)}>
            {isPending ? 'Adding...' : 'Add card'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
