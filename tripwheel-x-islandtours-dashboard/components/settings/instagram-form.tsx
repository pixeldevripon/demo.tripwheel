'use client';

import {
  Alert02Icon,
  ArrowDown02Icon,
  ArrowUp02Icon,
  Delete02Icon,
  Image02Icon,
  PencilEdit02Icon,
  PlusSignIcon,
  ViewIcon,
  ViewOffIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { ImageSelectorField } from '@/components/common/image-selector-field';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useActiveDestinations } from '@/hooks/destinations/use-destinations';
import {
  useCreateInstagramPost,
  useDeleteInstagramPost,
  useInstagramAccount,
  useInstagramPosts,
  useReorderInstagramPosts,
  useUpdateInstagramAccount,
  useUpdateInstagramPost,
} from '@/hooks/instagram/use-instagram';
import { useSiteInfo } from '@/hooks/settings/use-settings';
import type { InstagramPost } from '@/types/instagram';
import {
  SettingsCard,
  SettingsCardSkeleton,
  TextField,
} from './settings-fields';

/** Brand-wide tiles carry no destination; Select needs a non-empty value. */
const BRAND_WIDE = 'brand-wide';

/** The public grid is 2 x 3. Fewer than this and the section looks half-built. */
const GRID_SIZE = 6;

// ── Account ───────────────────────────────────────────────────────────────--

const accountSchema = z.object({
  username: z.string().optional(),
  profileUrl: z.string().optional(),
});
type AccountFormValues = z.infer<typeof accountSchema>;

/**
 * The handle row above the grid. The public section will not render without a
 * handle - it is the section's heading - so this card says so rather than
 * letting an admin curate six tiles into a page that shows nothing.
 */
function AccountCard() {
  const { data, isLoading } = useInstagramAccount();
  const { data: siteInfo } = useSiteInfo();
  const { mutate, isPending } = useUpdateInstagramAccount();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: { username: '', profileUrl: '' },
  });

  useEffect(() => {
    if (data) {
      reset({
        username: data.username ?? '',
        profileUrl: data.profileUrl ?? '',
      });
    }
  }, [data, reset]);

  if (isLoading) return <SettingsCardSkeleton />;

  const handle = watch('username')?.trim();

  return (
    <SettingsCard
      title="Instagram Account"
      description="The handle shown above the grid on every destination page."
      onSubmit={handleSubmit((v) => mutate(v))}
      isSaving={isPending}
    >
      {siteInfo && !siteInfo.enableInstagram && (
        <p className="flex items-start gap-2 rounded-md bg-surface-inset p-3 text-xs text-content-muted">
          <HugeiconsIcon icon={Alert02Icon} className="mt-px size-3.5 shrink-0" />
          The Instagram section is switched off under Settings &gt; Site, so
          nothing here reaches the public site yet.
        </p>
      )}

      <TextField
        label="Handle"
        registration={register('username')}
        error={errors.username?.message}
        placeholder="island.tours_"
        description="Without the @. Pasting a full profile URL works too."
      />
      <TextField
        label="Profile Link (optional)"
        registration={register('profileUrl')}
        error={errors.profileUrl?.message}
        placeholder="https://www.instagram.com/island.tours_"
        description="Leave empty and the link is built from the handle."
      />

      {!handle && (
        <p className="flex items-start gap-2 text-xs text-danger-fg">
          <HugeiconsIcon icon={Alert02Icon} className="mt-px size-3.5 shrink-0" />
          Without a handle the whole section stays hidden, however many tiles are
          added below.
        </p>
      )}
    </SettingsCard>
  );
}

// ── Tiles ─────────────────────────────────────────────────────────────────--

interface TileDraft {
  imageUrl: string | null;
  permalink: string;
  caption: string;
  altText: string;
  destinationId: string;
}

const EMPTY_DRAFT: TileDraft = {
  imageUrl: null,
  permalink: '',
  caption: '',
  altText: '',
  destinationId: BRAND_WIDE,
};

/**
 * The grid itself. Tiles are curated here rather than pulled from Instagram:
 * their CDN links expire within days and hotlinking them breaks Instagram's
 * terms, so the site always renders our own media. (Automatic syncing lands
 * later and fills these same rows.)
 */
function TilesCard() {
  const { data: posts = [], isLoading } = useInstagramPosts();
  const { data: destinations = [] } = useActiveDestinations();
  const create = useCreateInstagramPost();
  const update = useUpdateInstagramPost();
  const reorder = useReorderInstagramPosts();
  const remove = useDeleteInstagramPost();

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<InstagramPost | null>(null);
  const [pendingDelete, setPendingDelete] = useState<InstagramPost | null>(null);

  // This sorted view IS the public order; the arrows act on it.
  const ordered = [...posts].sort(
    (a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id),
  );
  const liveCount = ordered.filter((p) => p.isActive).length;
  const isBusy = update.isPending || reorder.isPending;

  function handleMove(index: number, direction: 'up' | 'down') {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= ordered.length) return;

    const next = [...ordered];
    [next[index], next[target]] = [next[target], next[index]];
    reorder.mutate({
      items: next.map((p, i) => ({ id: p.id, displayOrder: i })),
    });
  }

  function handleToggle(post: InstagramPost) {
    update.mutate({ id: post.id, payload: { isActive: !post.isActive } });
  }

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle className="text-lg font-semibold">Feed Tiles</CardTitle>
              {!isLoading && ordered.length > 0 && (
                <Badge variant="secondary">
                  {liveCount} showing of {ordered.length}
                </Badge>
              )}
            </div>
            <CardDescription>
              The first {GRID_SIZE} live tiles fill the grid. A tile links to its
              Instagram post; leave the link empty and it opens the profile
              instead.
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => setAddOpen(true)}
            disabled={create.isPending}
          >
            <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
            Add tile
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[384/337] w-full rounded-md" />
            ))}
          </div>
        ) : ordered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-line py-16 text-content-muted">
            <HugeiconsIcon icon={Image02Icon} className="size-10 opacity-30" />
            <p className="text-sm">
              No tiles yet - the Instagram section is hidden on every
              destination page.
            </p>
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
              Add the first tile
            </Button>
          </div>
        ) : (
          <>
            {liveCount > 0 && liveCount < GRID_SIZE && (
              <p className="rounded-md bg-surface-inset p-3 text-xs text-content-muted">
                {liveCount} of {GRID_SIZE} slots filled - the grid renders short
                until there are {GRID_SIZE}.
              </p>
            )}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {ordered.map((post, index) => (
                <TileCard
                  key={post.id}
                  post={post}
                  index={index}
                  total={ordered.length}
                  disabled={isBusy}
                  onMove={handleMove}
                  onToggle={() => handleToggle(post)}
                  onEdit={() => setEditing(post)}
                  onDelete={() => setPendingDelete(post)}
                />
              ))}
            </div>
          </>
        )}
      </CardContent>

      <TileDialog
        open={addOpen}
        title="Add a tile"
        description="Pick the photo from the media library, then point it at the post it came from."
        destinations={destinations}
        isSaving={create.isPending}
        onOpenChange={setAddOpen}
        onSave={(draft) => {
          if (!draft.imageUrl) return;
          create.mutate(
            {
              imageUrl: draft.imageUrl,
              permalink: draft.permalink || undefined,
              caption: draft.caption || undefined,
              altText: draft.altText || undefined,
              destinationId:
                draft.destinationId === BRAND_WIDE
                  ? undefined
                  : draft.destinationId,
            },
            { onSuccess: () => setAddOpen(false) },
          );
        }}
      />

      <TileDialog
        open={Boolean(editing)}
        title="Edit tile"
        description="Changes go live on the public site as soon as you save."
        post={editing}
        destinations={destinations}
        isSaving={update.isPending}
        onOpenChange={(open) => !open && setEditing(null)}
        onSave={(draft) => {
          if (!editing || !draft.imageUrl) return;
          update.mutate(
            {
              id: editing.id,
              payload: {
                imageUrl: draft.imageUrl,
                permalink: draft.permalink,
                caption: draft.caption,
                altText: draft.altText,
                destinationId:
                  draft.destinationId === BRAND_WIDE
                    ? null
                    : draft.destinationId,
              },
            },
            { onSuccess: () => setEditing(null) },
          );
        }}
      />

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this tile?</AlertDialogTitle>
            <AlertDialogDescription>
              It disappears from the destination pages. The photo stays in the
              media library.
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

function TileCard({
  post,
  index,
  total,
  disabled,
  onMove,
  onToggle,
  onEdit,
  onDelete,
}: {
  post: InstagramPost;
  index: number;
  total: number;
  disabled: boolean;
  onMove: (index: number, direction: 'up' | 'down') => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const synced = post.source === 'API';

  return (
    <div className="group overflow-hidden rounded-md border border-line">
      <div className="relative aspect-[384/337] bg-surface-inset">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={post.thumbnailUrl || post.imageUrl}
          alt=""
          className={
            post.isActive
              ? 'size-full object-cover'
              : 'size-full object-cover opacity-40 grayscale'
          }
        />

        {/* The number IS the position in the public grid. */}
        <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-n-1000/70 px-2 py-0.5 text-2xs font-medium text-n-0 tabular-nums">
          {index + 1}
        </span>

        {!post.isActive && (
          <span className="pointer-events-none absolute inset-x-2 bottom-2 rounded-md bg-n-1000/70 px-2 py-1 text-center text-2xs font-medium text-n-0">
            Hidden from the site
          </span>
        )}

        <div className="absolute bottom-2 left-2 z-10 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <Button
            size="icon-sm"
            variant="secondary"
            onClick={() => onMove(index, 'up')}
            disabled={disabled || index === 0}
            title="Move earlier"
          >
            <HugeiconsIcon icon={ArrowUp02Icon} className="size-3" />
          </Button>
          <Button
            size="icon-sm"
            variant="secondary"
            onClick={() => onMove(index, 'down')}
            disabled={disabled || index === total - 1}
            title="Move later"
          >
            <HugeiconsIcon icon={ArrowDown02Icon} className="size-3" />
          </Button>
        </div>

        <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <Button
            size="icon-sm"
            variant="secondary"
            onClick={onEdit}
            disabled={disabled || synced}
            title={synced ? 'Synced from Instagram' : 'Edit tile'}
          >
            <HugeiconsIcon icon={PencilEdit02Icon} className="size-3" />
          </Button>
          <Button
            size="icon-sm"
            variant="secondary"
            onClick={onToggle}
            disabled={disabled}
            title={post.isActive ? 'Hide from the site' : 'Show on the site'}
          >
            <HugeiconsIcon
              icon={post.isActive ? ViewOffIcon : ViewIcon}
              className="size-3"
            />
          </Button>
          <Button
            size="icon-sm"
            variant="destructive"
            onClick={onDelete}
            title="Remove tile"
          >
            <HugeiconsIcon icon={Delete02Icon} className="size-3" />
          </Button>
        </div>
      </div>

      <div className="space-y-1.5 p-3">
        <p className="truncate text-sm">
          {post.caption || (
            <span className="text-content-muted">No caption</span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge variant="neutral">
            {post.destinationName ?? 'All islands'}
          </StatusBadge>
          {synced && <StatusBadge variant="neutral">Synced</StatusBadge>}
          {!post.permalink && (
            <StatusBadge variant="neutral">Links to profile</StatusBadge>
          )}
        </div>
      </div>
    </div>
  );
}

function TileDialog({
  open,
  title,
  description,
  post,
  destinations,
  isSaving,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  title: string;
  description: string;
  post?: InstagramPost | null;
  destinations: { id: string; name: string }[];
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: TileDraft) => void;
}) {
  const [draft, setDraft] = useState<TileDraft>(EMPTY_DRAFT);

  // Reset every time the dialog opens, so an abandoned edit never leaks into
  // the next tile.
  useEffect(() => {
    if (!open) return;
    setDraft(
      post
        ? {
            imageUrl: post.imageUrl,
            permalink: post.permalink ?? '',
            caption: post.caption ?? '',
            altText: post.altText ?? '',
            destinationId: post.destinationId ?? BRAND_WIDE,
          }
        : EMPTY_DRAFT,
    );
  }, [open, post]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field>
            <Label>Photo</Label>
            <FieldDescription>
              Served from our media library, never hotlinked from Instagram -
              their image links expire.
            </FieldDescription>
            <ImageSelectorField
              value={draft.imageUrl}
              onChange={(url) => setDraft((d) => ({ ...d, imageUrl: url }))}
            />
          </Field>

          <Field>
            <Label htmlFor="ig-permalink">Post link</Label>
            <Input
              id="ig-permalink"
              value={draft.permalink}
              onChange={(e) =>
                setDraft((d) => ({ ...d, permalink: e.target.value }))
              }
              placeholder="https://www.instagram.com/p/..."
            />
            <FieldDescription>
              Empty opens the profile instead, so a tile is never a dead link.
            </FieldDescription>
          </Field>

          <Field>
            <Label htmlFor="ig-caption">Caption</Label>
            <Textarea
              id="ig-caption"
              value={draft.caption}
              onChange={(e) =>
                setDraft((d) => ({ ...d, caption: e.target.value }))
              }
              rows={2}
            />
            <FieldDescription>
              Not shown on the grid. Used as the tile&apos;s alt text (hashtags
              and mentions stripped) unless you set one below.
            </FieldDescription>
          </Field>

          <Field>
            <Label htmlFor="ig-alt">Alt text</Label>
            <Input
              id="ig-alt"
              value={draft.altText}
              onChange={(e) =>
                setDraft((d) => ({ ...d, altText: e.target.value }))
              }
              placeholder="Catamaran at sunset"
            />
          </Field>

          <Field>
            <Label>Show on</Label>
            <Select
              value={draft.destinationId}
              onValueChange={(v) =>
                setDraft((d) => ({ ...d, destinationId: v }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={BRAND_WIDE}>All islands</SelectItem>
                {destinations.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name} only
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!draft.imageUrl) {
                toast.error('Pick a photo for the tile.');
                return;
              }
              onSave(draft);
            }}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save tile'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Settings &gt; Instagram. The public grid renders from these rows on every
 * destination page - no third-party embed, so it is server-rendered with the
 * rest of the page and carries no extra cookies.
 */
export function InstagramForm() {
  return (
    <div className="space-y-6">
      <AccountCard />
      <TilesCard />
    </div>
  );
}
