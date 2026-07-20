'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { StatusBadge } from '@/components/common/status-badge';
import { VideoSelectorField } from '@/components/common/video-selector-field';
import { TranslationPointer } from '@/components/homepage/translation-pointer';
import {
  SettingsCard,
  TextField,
} from '@/components/settings/settings-fields';
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
import { Field, FieldDescription } from '@/components/ui/field';
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
  describeField,
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

/** Section heading copy - saved separately from the curated list below it. */
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
    <SettingsCard
      title='Section heading'
      description='Saving publishes straight to the live site.'
      isSaving={isPending}
      saveLabel='Save and publish'
      onSubmit={handleSubmit(v => {
        void save({ fields: { experiencesTitle: orNull(v.experiencesTitle) } })
          .then(() => toast.success('Heading published.'))
          .catch(err =>
            toast.error(err instanceof Error ? err.message : 'Failed to save.'),
          );
      })}
    >
      <TextField
        label='Title'
        registration={register('experiencesTitle')}
        placeholder={HOMEPAGE_DEFAULTS.experiencesTitle}
        description={describeField(
          'The heading above the experiences carousel.',
          values.experiencesTitle,
          HOMEPAGE_DEFAULTS.experiencesTitle,
        )}
      />

      <TranslationPointer />
    </SettingsCard>
  );
}

/**
 * The curated cards.
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
  const remove = useDeleteFeaturedExperience();

  const [pendingDelete, setPendingDelete] = useState<FeaturedExperience | null>(
    null,
  );

  const activeCount = experiences.filter(e => e.isActive).length;

  return (
    <Card>
      <CardHeader className='border-b pb-6'>
        <CardTitle>Featured cards</CardTitle>
        <p className='mt-1 text-sm font-normal normal-case tracking-normal text-muted-foreground'>
          Categories and hubs only - individual tours are never featured here.
          Each card links to that page, and takes its title and photo from it,
          so the two can never disagree.
        </p>
      </CardHeader>

      <CardContent className='space-y-6 pt-8'>
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
              <p className='text-sm text-muted-foreground'>
                Nothing featured yet - the homepage is showing its built-in
                cards.
              </p>
            ) : (
              <ul className='m-0 list-none space-y-3 p-0'>
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
                      update.mutate({ id: exp.id, payload: { videoUrl } })
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
                  { entityType, entityId, displayOrder: experiences.length },
                  {
                    onSuccess: () => toast.success('Added to the homepage.'),
                    onError: err =>
                      // 409 when this entity is already featured at the same
                      // scope - surfaced rather than silently duplicating.
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
        onOpenChange={open => !open && setPendingDelete(null)}
      >
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
              }}
            >
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
  onVideo: (url: string | null) => void;
  onDelete: () => void;
}) {
  const missing = experience.entityName === null;

  return (
    <li className='rounded-md border p-4'>
      <div className='flex flex-wrap items-center gap-3'>
        <span className='text-sm font-medium'>
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
            onClick={onToggle}
          >
            {experience.isActive ? 'Hide' : 'Show'}
          </Button>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='text-destructive hover:text-destructive'
            onClick={onDelete}
          >
            Remove
          </Button>
        </div>
      </div>

      {missing && (
        <p className='mt-2 text-xs text-content-muted'>
          The category or hub this pointed at no longer exists, so the homepage
          skips it. Remove this row.
        </p>
      )}

      <div className='mt-4 grid gap-6 sm:grid-cols-2'>
        <Field>
          <Label>Position</Label>
          <FieldDescription>
            Lower numbers sit earlier in the carousel.
          </FieldDescription>
          <Input
            type='number'
            min={0}
            className='w-24'
            defaultValue={experience.displayOrder}
            disabled={disabled}
            onBlur={e => {
              const next = Number(e.target.value);
              if (next !== experience.displayOrder) onOrder(next);
            }}
          />
        </Field>

        <Field>
          <Label>Video</Label>
          <FieldDescription>
            Plays when this card is centred. Optional - without one the card
            shows its photo.
          </FieldDescription>
          <VideoSelectorField
            value={experience.videoUrl}
            onChange={onVideo}
            disabled={disabled}
          />
        </Field>
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
    <div className='space-y-4 border-t pt-6'>
      <div className='grid gap-6 sm:grid-cols-2'>
        <Field>
          <Label>Type</Label>
          <Select
            value={entityType}
            onValueChange={v => {
              setEntityType(v as FeaturedEntityType);
              setEntityId('');
            }}
          >
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
        </Field>
      </div>

      <p className='text-xs text-content-muted'>
        A card only appears once its target has at least one live tour. Hubs are
        held to that too, even though a hub page itself opens without one - a
        featured experience with nothing bookable is a dead end.
      </p>

      <div className='flex justify-end'>
        <Button
          type='button'
          disabled={!entityId || isPending}
          onClick={() => {
            onAdd(entityType, entityId);
            setEntityId('');
          }}
        >
          {isPending ? 'Adding...' : 'Add card'}
        </Button>
      </div>
    </div>
  );
}
