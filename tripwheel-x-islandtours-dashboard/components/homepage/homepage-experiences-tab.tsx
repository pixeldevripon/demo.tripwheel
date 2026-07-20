'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { HomepageField } from '@/components/homepage/homepage-field';
import { HomepageSectionCard } from '@/components/homepage/homepage-section-card';
import { StatusBadge } from '@/components/common/status-badge';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
  useSaveHomepageSection,
  useUpdateFeaturedExperience,
} from '@/hooks/home-page/use-home-page';
import { useHubs } from '@/hooks/hubs/use-hubs';
import {
  HOMEPAGE_DEFAULTS,
  MIN_CURATED_EXPERIENCES,
  RECOMMENDED_MAX_EXPERIENCES,
} from '@/lib/home-page/defaults';
import type {
  FeaturedEntityType,
  FeaturedExperience,
  HomePageContent,
} from '@/types/home-page';

const orNull = (v: string) => (v.trim() ? v.trim() : null);

export function HomepageExperiencesTab({
  content,
}: {
  content: HomePageContent;
}) {
  return (
    <div className='space-y-6'>
      <ExperiencesHeadingCard content={content} />
      <ExperiencesCurationCard />
    </div>
  );
}

/** The section heading copy - separate save from the curated list below it. */
function ExperiencesHeadingCard({ content }: { content: HomePageContent }) {
  const { save, isPending } = useSaveHomepageSection();
  const english = content.translations.find(t => t.locale === 'en');

  const { register, handleSubmit, reset, watch } = useForm<{
    experiencesTitle: string;
  }>({ defaultValues: { experiencesTitle: '' } });

  useEffect(() => {
    reset({ experiencesTitle: english?.experiencesTitle ?? '' });
  }, [english, reset]);

  const values = watch();

  return (
    <HomepageSectionCard
      title='Section heading'
      translatable
      isPending={isPending}
      onSave={handleSubmit(v => {
        void save({ fields: { experiencesTitle: orNull(v.experiencesTitle) } })
          .then(() => toast.success('Heading published.'))
          .catch(err =>
            toast.error(
              err instanceof Error ? err.message : 'Failed to save.',
            ),
          );
      })}>
      <HomepageField
        label='Title'
        where='The heading above the experiences carousel.'
        value={values.experiencesTitle}
        fallback={HOMEPAGE_DEFAULTS.experiencesTitle}
        maxLength={120}
        register={register('experiencesTitle')}
      />
    </HomepageSectionCard>
  );
}

/**
 * The curated cards.
 *
 * Two things this UI exists to prevent, both of which are otherwise silent:
 *
 * 1. A curated row can be dropped by the public site without any error - the
 *    backend refuses to feature anything with no live tour, so the card simply
 *    never appears. For hubs that bar is HIGHER than the hub page's own (a hub
 *    with no tours still renders a valid page), which is exactly the case an
 *    admin cannot deduce. Every row therefore states whether it is live.
 * 2. Fewer than MIN_CURATED_EXPERIENCES resolved cards and the site ignores
 *    curation entirely, falling back to its bundled deck. An admin who adds two
 *    cards and sees no change on the homepage has hit this.
 */
function ExperiencesCurationCard() {
  const { data: experiences = [], isLoading } = useFeaturedExperiences();
  const create = useCreateFeaturedExperience();
  const update = useUpdateFeaturedExperience();
  const remove = useDeleteFeaturedExperience();

  const [pendingDelete, setPendingDelete] = useState<FeaturedExperience | null>(
    null,
  );

  const activeCount = experiences.filter(e => e.isActive).length;

  return (
    <Card>
      <CardHeader className='border-b pb-8'>
        <CardTitle>Featured cards</CardTitle>
        <p className='m-0 mt-2 text-sm text-content-muted'>
          Categories and hubs only - individual tours are never featured here.
          Each card links to that page, and the photo and title come from it, so
          they always match.
        </p>
      </CardHeader>

      <CardContent className='space-y-4 pt-8'>
        {isLoading ? (
          <div className='space-y-3'>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className='h-16 w-full' />
            ))}
          </div>
        ) : (
          <>
            <CurationNotice count={activeCount} />

            {experiences.length === 0 ? (
              <p className='m-0 text-sm text-content-muted'>
                Nothing featured yet - the homepage is showing its built-in
                cards.
              </p>
            ) : (
              <ul className='m-0 list-none space-y-2 p-0'>
                {experiences.map(exp => (
                  <ExperienceRow
                    key={exp.id}
                    experience={exp}
                    disabled={update.isPending}
                    onToggle={() =>
                      update.mutate({
                        id: exp.id,
                        payload: { isActive: !exp.isActive },
                      })
                    }
                    onOrder={displayOrder =>
                      update.mutate({ id: exp.id, payload: { displayOrder } })
                    }
                    onVideo={videoUrl =>
                      update.mutate({
                        id: exp.id,
                        payload: { videoUrl: videoUrl || null },
                      })
                    }
                    onDelete={() => setPendingDelete(exp)}
                  />
                ))}
              </ul>
            )}

            <AddExperienceForm
              isPending={create.isPending}
              onAdd={(entityType, entityId) =>
                create.mutate(
                  {
                    entityType,
                    entityId,
                    displayOrder: experiences.length,
                  },
                  {
                    onSuccess: () => toast.success('Added to the homepage.'),
                    onError: err =>
                      // The backend returns 409 when this entity is already
                      // featured at the same scope - surface it rather than
                      // letting a double-submit create a duplicate card.
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : 'Could not feature that.',
                      ),
                  },
                )
              }
            />
          </>
        )}
      </CardContent>

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

/** Says plainly what the current card count means for the live homepage. */
function CurationNotice({ count }: { count: number }) {
  if (count === 0) return null;

  if (count < MIN_CURATED_EXPERIENCES) {
    return (
      <p className='m-0 rounded-md bg-muted p-3 text-xs text-content-muted'>
        The homepage needs at least {MIN_CURATED_EXPERIENCES} live cards before
        it uses your selection - below that it keeps its built-in deck, so these{' '}
        {count} are not showing yet.
      </p>
    );
  }

  if (count > RECOMMENDED_MAX_EXPERIENCES) {
    return (
      <p className='m-0 rounded-md bg-muted p-3 text-xs text-content-muted'>
        {count} active cards. The carousel is designed around{' '}
        {RECOMMENDED_MAX_EXPERIENCES} - beyond that the row of dots crowds and
        only the first eight ever render.
      </p>
    );
  }

  return null;
}

function ExperienceRow({
  experience,
  disabled,
  onToggle,
  onOrder,
  onVideo,
  onDelete,
}: {
  experience: FeaturedExperience;
  disabled: boolean;
  onToggle: () => void;
  onOrder: (order: number) => void;
  onVideo: (url: string) => void;
  onDelete: () => void;
}) {
  const [video, setVideo] = useState(experience.videoUrl ?? '');
  const missing = experience.entityName === null;

  return (
    <li className='rounded-md border p-4'>
      <div className='flex flex-wrap items-center gap-3'>
        <span className='font-medium'>
          {experience.entityName ?? 'Deleted item'}
        </span>
        <StatusBadge variant='neutral'>
          {experience.entityType === 'HUB' ? 'Hub' : 'Category'}
        </StatusBadge>
        {missing ? (
          <StatusBadge variant='danger'>Target deleted</StatusBadge>
        ) : experience.isActive ? (
          <StatusBadge variant='success'>Active</StatusBadge>
        ) : (
          <StatusBadge variant='neutral'>Hidden</StatusBadge>
        )}

        <div className='ml-auto flex items-center gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={disabled}
            onClick={onToggle}>
            {experience.isActive ? 'Hide' : 'Show'}
          </Button>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='text-destructive hover:text-destructive'
            onClick={onDelete}>
            Remove
          </Button>
        </div>
      </div>

      {missing ? (
        <p className='m-0 mt-2 text-xs text-content-muted'>
          The category or hub this pointed at no longer exists, so the homepage
          skips it. Remove this row.
        </p>
      ) : null}

      <div className='mt-3 flex flex-wrap items-end gap-4'>
        <div className='w-24'>
          <Label className='text-xs'>Position</Label>
          <Input
            type='number'
            min={0}
            defaultValue={experience.displayOrder}
            disabled={disabled}
            onBlur={e => {
              const next = Number(e.target.value);
              if (next !== experience.displayOrder) onOrder(next);
            }}
          />
        </div>

        <div className='min-w-60 flex-1'>
          <Label className='text-xs'>Video (optional)</Label>
          <Input
            value={video}
            placeholder='https://...'
            disabled={disabled}
            onChange={e => setVideo(e.target.value)}
            onBlur={() => {
              if (video !== (experience.videoUrl ?? '')) onVideo(video);
            }}
          />
        </div>
      </div>
    </li>
  );
}

/** Pick a category or hub to feature. Tours are deliberately not offered. */
function AddExperienceForm({
  isPending,
  onAdd,
}: {
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

  return (
    <div className='flex flex-wrap items-end gap-3 border-t pt-6'>
      <div className='w-40'>
        <Label className='text-xs'>Type</Label>
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
      </div>

      <div className='min-w-60 flex-1'>
        <Label className='text-xs'>
          {entityType === 'CATEGORY' ? 'Category' : 'Hub'}
        </Label>
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
      </div>

      <Button
        type='button'
        size='sm'
        disabled={!entityId || isPending}
        onClick={() => {
          onAdd(entityType, entityId);
          setEntityId('');
        }}>
        {isPending ? 'Adding...' : 'Add card'}
      </Button>

      <p className='m-0 w-full text-xs text-content-muted'>
        A card only appears once its target has at least one live tour. Hubs are
        held to that too, even though a hub page itself opens without one - a
        featured experience with nothing bookable is a dead end.
      </p>
    </div>
  );
}
