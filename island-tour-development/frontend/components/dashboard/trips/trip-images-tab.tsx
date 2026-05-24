'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { StarIcon, Trash2Icon, ImageIcon, PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import MediaSelector from '@/components/dashboard/media/media-selector';
import { useImages, useAddImage, useUpdateImage, useRemoveImage } from '@/hooks/trips/use-trips';
import type { MediaItem } from '@/types/media';
import type { TripListItem } from '@/types/trip';

interface TripImagesTabProps {
  trip: TripListItem;
}

export function TripImagesTab({ trip }: TripImagesTabProps) {
  const { data: images, isLoading } = useImages(trip.id);
  const { mutate: addImage, isPending: isAdding } = useAddImage();
  const { mutate: updateImage, isPending: isUpdating } = useUpdateImage();
  const { mutate: removeImage } = useRemoveImage();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);

  const count = images?.length ?? 0;
  const hasHero = images?.some((img) => img.isHero) ?? false;

  function handleMediaSelect(items: MediaItem[]) {
    const remaining = 24 - count;
    const toAdd = items.slice(0, remaining);

    if (items.length > remaining) {
      toast.warning(`Only ${remaining} image slots remaining. Added the first ${remaining}.`);
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
            if (index === 0) toast.success(`${toAdd.length} image${toAdd.length > 1 ? 's' : ''} added.`);
          },
          onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to add image.'),
        }
      );
    });
  }

  function handleSetHero(imageId: string) {
    updateImage(
      { tripId: trip.id, imageId, payload: { isHero: true } },
      {
        onSuccess: () => toast.success('Hero image updated.'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to set hero.'),
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
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to remove image.');
          setDeletingId(null);
        },
      }
    );
  }

  return (
    <div className="space-y-6">
      {/* Status + action row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{count}/24 images</Badge>
          {count < 5 && (
            <Badge variant="destructive">Need at least 5 to publish</Badge>
          )}
          {!hasHero && count > 0 && (
            <Badge variant="outline" className="border-amber-500 text-amber-600">
              No hero image set
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => setSelectorOpen(true)}
          disabled={isAdding || count >= 24}
        >
          <PlusIcon className="size-3.5" />
          Select from Gallery
        </Button>
      </div>

      {/* Image grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-video w-full rounded-none" />
          ))}
        </div>
      ) : images && images.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((img) => (
            <div key={img.id} className="relative group ring-1 ring-foreground/10 overflow-hidden rounded-none">
              <div className="aspect-video bg-muted">
                <img
                  src={img.url}
                  alt={img.altText ?? 'Trip image'}
                  className="size-full object-cover"
                />
              </div>
              <div className="p-2 space-y-1">
                {img.isHero && (
                  <div className="flex items-center gap-1">
                    <StarIcon className="size-3 text-amber-500 fill-amber-500" />
                    <span className="text-xs text-amber-600 font-medium">Hero</span>
                  </div>
                )}
                {img.altText && (
                  <p className="text-xs text-muted-foreground truncate">{img.altText}</p>
                )}
                <p className="text-xs text-muted-foreground">{img.width}×{img.height}</p>
              </div>
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!img.isHero && (
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={() => handleSetHero(img.id)}
                    disabled={isUpdating}
                    title="Set as hero"
                  >
                    <StarIcon className="size-3" />
                  </Button>
                )}
                <Button
                  size="xs"
                  variant="destructive"
                  onClick={() => handleDelete(img.id)}
                  disabled={deletingId === img.id}
                  title="Remove image"
                >
                  <Trash2Icon className="size-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground border border-dashed border-foreground/15">
          <ImageIcon className="size-10 opacity-30" />
          <p className="text-sm">No images yet.</p>
          <Button size="sm" variant="outline" onClick={() => setSelectorOpen(true)}>
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
    </div>
  );
}
