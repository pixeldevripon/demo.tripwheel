'use client';

import {
  Alert02Icon,
  ArrowDown02Icon,
  ArrowUp02Icon,
  Cancel01Icon,
  Image02Icon,
  PencilEdit02Icon,
  PlayIcon,
  PlusSignIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { ImageSelectorField } from '@/components/common/image-selector-field';
import MediaSelector from '@/components/common/media-selector';
import { StatusBadge } from '@/components/common/status-badge';
import { VideoSelectorField } from '@/components/common/video-selector-field';
import { getMediaKind } from '@/lib/media/media-kind';
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
  useCreateInstagramPosts,
  useDeleteInstagramPost,
  useInstagramAccount,
  useInstagramPosts,
  useReorderInstagramPosts,
  useUpdateInstagramAccount,
  useUpdateInstagramPost,
} from '@/hooks/instagram/use-instagram';
import { useSiteInfo, useUpdateSiteInfo } from '@/hooks/settings/use-settings';
import type {
  CreateInstagramPostPayload,
  InstagramLayout,
  InstagramPost,
} from '@/types/instagram';
import type { MediaItem } from '@/types/media';
import {
  CheckboxField,
  SettingsCard,
  SettingsCardSkeleton,
  TextField,
} from './settings-fields';

/** Brand-wide tiles carry no destination; Select needs a non-empty value. */
const BRAND_WIDE = 'brand-wide';

/**
 * How many live tiles each layout wants before the section looks finished: the
 * curated grid is 2 x 3; the gallery is three rows of five (and five rows of
 * three on a phone), so 15 is what fills its last row at both widths. Mirrors
 * DEFAULT_LIMIT_BY_LAYOUT in the backend's instagram.service.ts.
 */
const SLOTS_BY_LAYOUT: Record<InstagramLayout, number> = {
  GRID: 6,
  GALLERY: 15,
};

// ── Section settings ──────────────────────────────────────────────────────--

const accountSchema = z.object({
  enabled: z.boolean(),
  username: z.string().optional(),
  profileUrl: z.string().optional(),
  layout: z.enum(['GRID', 'GALLERY']),
});
type AccountFormValues = z.infer<typeof accountSchema>;

const LAYOUT_HINT: Record<InstagramLayout, string> = {
  GRID: 'Six rounded cards in two rows, with generous spacing. Reads as part of the page.',
  GALLERY:
    'Fifteen 4:5 portraits packed five across with hairline gaps. Reads like the Instagram profile itself.',
};

/**
 * Everything about the section except its tiles: whether it renders at all, the
 * handle heading it, the outbound link, and which of the two layouts draws it.
 *
 * The on/off switch lives HERE rather than with the other integrations,
 * because it is meaningless without the handle and tiles beside it - and the
 * public section will not render without a handle either, which this card says
 * out loud instead of letting an admin curate into an invisible page.
 *
 * Two writes on one Save (the feed's own row, and SiteInfo for the switch),
 * with the settings write skipped unless the switch actually moved.
 */
function AccountCard() {
  const { data, isLoading } = useInstagramAccount();
  const { data: siteInfo, isLoading: siteLoading } = useSiteInfo();
  const { mutate: saveAccount, isPending } = useUpdateInstagramAccount();
  const { mutate: saveSiteInfo, isPending: savingSite } = useUpdateSiteInfo();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      enabled: false,
      username: '',
      profileUrl: '',
      layout: 'GRID',
    },
  });

  useEffect(() => {
    if (data && siteInfo) {
      reset({
        enabled: siteInfo.enableInstagram ?? false,
        username: data.username ?? '',
        profileUrl: data.profileUrl ?? '',
        layout: data.layout ?? 'GRID',
      });
    }
  }, [data, siteInfo, reset]);

  if (isLoading || siteLoading) return <SettingsCardSkeleton />;

  const handle = watch('username')?.trim();
  const enabled = watch('enabled');
  const layout = watch('layout');

  function onSubmit(values: AccountFormValues) {
    saveAccount({
      username: values.username,
      profileUrl: values.profileUrl,
      layout: values.layout,
    });
    if (values.enabled !== (siteInfo?.enableInstagram ?? false)) {
      saveSiteInfo({ enableInstagram: values.enabled });
    }
  }

  return (
    <SettingsCard
      title="Instagram Section"
      description="The band of Instagram tiles on every destination page."
      onSubmit={handleSubmit(onSubmit)}
      isSaving={isPending || savingSite}
    >
      <CheckboxField
        id="enableInstagram"
        label="Show the Instagram section"
        description="Off hides it on every destination page, tiles and all."
        checked={enabled}
        onChange={(c) => setValue('enabled', c, { shouldDirty: true })}
      />

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

      <Field>
        <Label>Layout</Label>
        <Select
          value={layout}
          onValueChange={(v) =>
            setValue('layout', v as InstagramLayout, { shouldDirty: true })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="GRID">Curated grid</SelectItem>
            <SelectItem value="GALLERY">Instagram gallery</SelectItem>
          </SelectContent>
        </Select>
        <FieldDescription>{LAYOUT_HINT[layout]}</FieldDescription>
      </Field>

      {enabled && !handle && (
        <p className="flex items-start gap-2 text-xs text-danger-fg">
          <HugeiconsIcon icon={Alert02Icon} className="mt-px size-3.5 shrink-0" />
          Without a handle the whole section stays hidden, however many tiles are
          added below - it is the heading the section is built around.
        </p>
      )}
    </SettingsCard>
  );
}

// ── Tiles ─────────────────────────────────────────────────────────────────--

interface TileDraft {
  imageUrl: string | null;
  videoUrl: string | null;
  permalink: string;
  caption: string;
  altText: string;
  destinationId: string;
}

const EMPTY_DRAFT: TileDraft = {
  imageUrl: null,
  videoUrl: null,
  permalink: '',
  caption: '',
  altText: '',
  destinationId: BRAND_WIDE,
};

/**
 * Still frame for a video picked straight from the library.
 *
 * Every post needs an `imageUrl` - it is what the public grid paints first and
 * all a reduced-motion visitor ever sees - so a video cannot become a tile
 * without a poster. Cloudinary renders one from the same public id by swapping
 * the extension, which is what makes picking a video in the same multi-select
 * as the photos possible at all. Returns null for anything not served from our
 * Cloudinary video pipeline, so the caller skips it loudly rather than saving a
 * tile whose poster is an .mp4.
 */
function videoPoster(url: string): string | null {
  if (!url.includes('/video/upload/')) return null;
  const poster = url.replace(/\.[a-z0-9]{2,5}(?:\?.*)?$/i, '.jpg');
  return poster === url ? null : poster;
}

/**
 * One library pick -> one tile payload. Photos go in as-is; videos go in as
 * poster + video. Alt text rides along from the media record so a freshly added
 * tile is already accessible before anyone opens it to edit.
 */
function tilePayloadFor(item: MediaItem): CreateInstagramPostPayload | null {
  const kind = getMediaKind(item);
  const common = {
    imagePublicId: item.publicId || undefined,
    altText: item.altText || undefined,
    width: item.width,
    height: item.height,
  };

  if (kind === 'video') {
    const poster = videoPoster(item.url);
    return poster ? { ...common, imageUrl: poster, videoUrl: item.url } : null;
  }
  // 'svg', 'audio' and 'file' are not photographs and have no business in the
  // feed, so they are skipped rather than quietly turned into broken tiles.
  return kind === 'image' ? { ...common, imageUrl: item.url } : null;
}

/**
 * The grid itself. Tiles are curated here rather than pulled from Instagram:
 * their CDN links expire within days and hotlinking them breaks Instagram's
 * terms, so the site always renders our own media. (Automatic syncing lands
 * later and fills these same rows.)
 */
function TilesCard() {
  const { data: posts = [], isLoading } = useInstagramPosts();
  const { data: account } = useInstagramAccount();
  const { data: destinations = [] } = useActiveDestinations();
  const createMany = useCreateInstagramPosts();
  const update = useUpdateInstagramPost();
  const reorder = useReorderInstagramPosts();
  const remove = useDeleteInstagramPost();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState<InstagramPost | null>(null);
  const [pendingDelete, setPendingDelete] = useState<InstagramPost | null>(null);

  // This sorted view IS the public order; the arrows act on it.
  const ordered = [...posts].sort(
    (a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id),
  );
  const slots = SLOTS_BY_LAYOUT[account?.layout ?? 'GRID'];
  const isBusy = update.isPending || reorder.isPending || createMany.isPending;

  function handleMove(index: number, direction: 'up' | 'down') {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= ordered.length) return;

    const next = [...ordered];
    [next[index], next[target]] = [next[target], next[index]];
    reorder.mutate({
      items: next.map((p, i) => ({ id: p.id, displayOrder: i })),
    });
  }

  /**
   * The whole point of the multi-select: a pick of twelve photos becomes twelve
   * tiles in one go, in the order they were picked, each ready to open and
   * refine. Nothing here asks for a caption or a link first - those are the
   * per-tile details, and demanding them up front is what made adding a feed a
   * twelve-dialog chore.
   */
  function handlePicked(items: MediaItem[]) {
    const payloads = items
      .map(tilePayloadFor)
      .filter((p): p is CreateInstagramPostPayload => p !== null);

    const skipped = items.length - payloads.length;
    if (skipped > 0) {
      toast.warning(
        `Skipped ${skipped} file${skipped === 1 ? '' : 's'} - a tile needs a photo or a video from our own library.`,
      );
    }
    if (payloads.length > 0) createMany.mutate(payloads);
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
                  {ordered.length} tile{ordered.length === 1 ? '' : 's'}
                </Badge>
              )}
            </div>
            <CardDescription>
              The first {slots} fill the{' '}
              {account?.layout === 'GALLERY' ? 'gallery' : 'grid'}. Pick as many
              photos and videos as you like in one go, then click any tile to
              set its link, caption and island.
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => setPickerOpen(true)}
            disabled={createMany.isPending}
          >
            <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
            {createMany.isPending ? 'Adding...' : 'Add tiles'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
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
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPickerOpen(true)}
            >
              Add the first tiles
            </Button>
          </div>
        ) : (
          <>
            {ordered.length < slots && (
              <p className="rounded-md bg-surface-inset p-3 text-xs text-content-muted">
                {ordered.length} of {slots} slots filled - the section renders
                short until there are {slots}.
              </p>
            )}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {ordered.map((post, index) => (
                <TileCard
                  key={post.id}
                  post={post}
                  index={index}
                  total={ordered.length}
                  disabled={isBusy}
                  onMove={handleMove}
                  onEdit={() => setEditing(post)}
                  onDelete={() => setPendingDelete(post)}
                />
              ))}
            </div>
          </>
        )}
      </CardContent>

      {/* Adding is a library pick, not a form: photos and videos together, as
          many as wanted, straight into tiles. Everything else about a tile is
          edited on the tile itself. */}
      <MediaSelector
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onMediaSelect={handlePicked}
        multiple
      />

      <TileDialog
        open={Boolean(editing)}
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
                // '' clears the video, so removing it retypes the tile back to
                // a photo instead of leaving a stale reel attached.
                videoUrl: draft.videoUrl ?? '',
                permalink: draft.permalink,
                caption: draft.caption,
                altText: draft.altText,
                // There is no hide/show any more, so "live" is the only state a
                // tile has. Sending it on save normalises any row left inactive
                // by the old toggle - otherwise such a row would sit in this
                // grid looking perfectly normal while never rendering on the
                // site, with nothing in the UI to explain why.
                isActive: true,
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
  onEdit,
  onDelete,
}: {
  post: InstagramPost;
  index: number;
  total: number;
  disabled: boolean;
  onMove: (index: number, direction: 'up' | 'down') => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const synced = post.source === 'API';

  return (
    <div className="group overflow-hidden rounded-md border border-line">
      <div className="relative aspect-[384/337] bg-surface-inset">
        {/* The poster, matching what the public grid paints first. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={post.imageUrl} alt="" className="size-full object-cover" />

        {/* The tile IS the edit control - a sibling of the corner actions
            rather than a wrapper around them, so no button ends up nested
            inside another. A pencil in the corner made editing look like one
            more small target competing with three others, when it is the thing
            an admin came here to do. */}
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled || synced}
          title={synced ? 'Synced from Instagram' : 'Edit tile'}
          className="absolute inset-0 flex items-center justify-center transition-colors hover:bg-n-1000/40 disabled:cursor-not-allowed"
        >
          <HugeiconsIcon
            icon={PencilEdit02Icon}
            className="size-5 text-n-0 opacity-0 transition-opacity group-hover:opacity-100 group-disabled:opacity-0"
          />
          <span className="sr-only">Edit tile</span>
        </button>

        {/* The number IS the position in the public grid. */}
        <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-n-1000/70 px-2 py-0.5 text-2xs font-medium text-n-0 tabular-nums">
          {index + 1}
        </span>

        {post.videoUrl && (
          <span className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-n-1000/70 px-2 py-0.5 text-2xs font-medium text-n-0">
            <HugeiconsIcon icon={PlayIcon} className="size-3" />
            Video
          </span>
        )}

        {/* Always visible, not hover-revealed - the same corner control every
            other media field in this dashboard uses (see ImageSelectorField),
            so removing a tile works the way removing a picked image already
            does. */}
        <button
          type="button"
          onClick={onDelete}
          title="Remove tile"
          className="absolute right-1.5 top-1.5 z-10 flex size-5 items-center justify-center bg-black/60 text-white transition-colors hover:bg-destructive"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
          <span className="sr-only">Remove tile</span>
        </button>

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

/**
 * Everything about one tile. Reached by clicking the tile itself - tiles are
 * created straight from a media pick, so this is where a photo becomes an
 * actual post: where it links, what it says, which island it belongs to.
 */
function TileDialog({
  open,
  post,
  destinations,
  isSaving,
  onOpenChange,
  onSave,
}: {
  open: boolean;
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
            videoUrl: post.videoUrl,
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
          <DialogTitle>Edit tile</DialogTitle>
          <DialogDescription>
            Changes go live on the public site as soon as you save.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field>
            <Label>Photo</Label>
            <FieldDescription>
              Served from our media library, never hotlinked from Instagram -
              their image links expire. On a reel this is the poster.
            </FieldDescription>
            <ImageSelectorField
              value={draft.imageUrl}
              onChange={(url) => setDraft((d) => ({ ...d, imageUrl: url }))}
            />
          </Field>

          <Field>
            <Label>Video (optional)</Label>
            <FieldDescription>
              For a reel or video post. It plays muted and looped over the
              poster, and visitors who ask for reduced motion see the poster
              alone - so the photo above is still required.
            </FieldDescription>
            <VideoSelectorField
              value={draft.videoUrl}
              onChange={(url) => setDraft((d) => ({ ...d, videoUrl: url }))}
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

          {/* No "post type" or "pinned" control. Both existed only to drive
              corner badges (carousel stack, reel, pin), and the public tiles no
              longer draw any - that glyph set is Instagram's product chrome, not
              ours. The columns still exist on the row, so a badge could come
              back as a design decision without a migration. */}

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
