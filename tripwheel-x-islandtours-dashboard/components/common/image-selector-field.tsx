'use client';

import { useState } from 'react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import MediaSelector from '@/components/common/media-selector';
import { MediaUploadZone } from '@/components/common/media-upload-zone';
import type { MediaItem } from '@/types/media';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function urlToMediaItem(url: string): MediaItem {
  return { id: '', userId: '', url, publicId: '', resourceType: 'image', uploadedAt: '' };
}

// ─── Prop types ───────────────────────────────────────────────────────────────

interface SingleProps {
  multiple?: false;
  value?: string | null;
  onChange: (url: string | null) => void;
  maxFiles?: never;
}

interface MultipleProps {
  multiple: true;
  value?: string[];
  onChange: (urls: string[]) => void;
  maxFiles?: number;
}

type ImageSelectorFieldProps = (SingleProps | MultipleProps) & {
  disabled?: boolean;
  className?: string;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ImageSelectorField(props: ImageSelectorFieldProps) {
  const { disabled, className } = props;
  const [open, setOpen] = useState(false);

  // ── Multiple mode ─────────────────────────────────────────────────────────
  if (props.multiple) {
    const { value: urls = [], onChange, maxFiles } = props;
    const remaining = maxFiles ? maxFiles - urls.length : null;
    const canAddMore = remaining === null || remaining > 0;

    function handleSelect(items: MediaItem[]) {
      const next = maxFiles ? items.slice(0, maxFiles) : items;
      onChange(next.map((i) => i.url));
    }

    return (
      <div className={cn('space-y-3', className)}>
        {/* Upload zone - always visible, shrinks to compact when images exist */}
        {canAddMore && (
          <MediaUploadZone
            onClick={() => setOpen(true)}
            disabled={disabled}
            compact={urls.length > 0}
            label={
              urls.length === 0
                ? 'Select images'
                : `Add more${remaining !== null ? ` · ${remaining} remaining` : ''}`
            }
            hint={
              urls.length === 0
                ? maxFiles
                  ? `Up to ${maxFiles} images · JPG, PNG, WebP, GIF`
                  : 'JPG · PNG · WebP · GIF'
                : undefined
            }
          />
        )}

        {/* Preview grid */}
        {urls.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-2xs font-semibold text-muted-foreground">
                Selected · {urls.length}{maxFiles ? ` / ${maxFiles}` : ''}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-auto py-0.5 text-2xs"
                onClick={() => onChange([])}
                disabled={disabled}
              >
                Clear all
              </Button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {urls.map((url) => (
                <div
                  key={url}
                  className="group relative aspect-square overflow-hidden border border-border bg-muted"
                >
                  <img src={url} alt="" className="w-full h-full object-cover block" />
                  {/* Always-visible remove button in corner */}
                  <button
                    type="button"
                    onClick={() => onChange(urls.filter((u) => u !== url))}
                    disabled={disabled}
                    className={cn(
                      'absolute top-1.5 right-1.5 size-5 flex items-center justify-center',
                      'bg-black/60 text-white hover:bg-destructive transition-colors',
                      'disabled:pointer-events-none'
                    )}
                    title="Remove"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <MediaSelector
          open={open}
          onOpenChange={setOpen}
          onMediaSelect={handleSelect}
          multiple
          maxFiles={maxFiles}
          currentSelection={urls.map(urlToMediaItem)}
        />
      </div>
    );
  }

  // ── Single mode ───────────────────────────────────────────────────────────
  const { value, onChange } = props;

  return (
    <div className={cn('space-y-3', className)}>
      {value ? (
        /* One image, so it is sized directly rather than dropped into a 3/4
           column grid - in a narrow container (a card slot, a side-by-side
           form) a grid fraction of a fraction rendered a thumbnail too small
           to judge the photo by. `max-w-48` keeps it about the size it was in
           the wide forms it was designed against. */
        <div className="w-full max-w-48">
          <div
            className={cn(
              'group relative aspect-square overflow-hidden border border-border bg-muted',
              disabled ? 'pointer-events-none opacity-50' : 'cursor-pointer'
            )}
            onClick={disabled ? undefined : () => setOpen(true)}
            title="Change image"
          >
            <img src={value} alt="" className="w-full h-full object-contain block p-2" />
            {/* Always-visible remove button in corner */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              disabled={disabled}
              className={cn(
                'absolute top-1.5 right-1.5 size-5 flex items-center justify-center',
                'bg-black/60 text-white hover:bg-destructive transition-colors',
                'disabled:pointer-events-none'
              )}
              title="Remove"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
            </button>
          </div>
        </div>
      ) : (
        <MediaUploadZone
          onClick={() => setOpen(true)}
          disabled={disabled}
          label="Select an image"
          hint="Choose from your media library · JPG, PNG, WebP, GIF"
        />
      )}

      <MediaSelector
        open={open}
        onOpenChange={setOpen}
        onMediaSelect={(items) => {
          if (items[0]) onChange(items[0].url);
        }}
        multiple={false}
        currentSelection={value ? [urlToMediaItem(value)] : []}
      />
    </div>
  );
}
