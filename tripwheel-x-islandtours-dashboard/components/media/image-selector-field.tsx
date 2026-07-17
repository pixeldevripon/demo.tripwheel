'use client';

import { useState } from 'react';
import { XIcon, RefreshCwIcon } from 'lucide-react';
import { CloudUploadIcon, ImageAdd02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import MediaSelector from './media-selector';
import type { MediaItem } from '@/types/media';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function urlToMediaItem(url: string): MediaItem {
  return { id: '', userId: '', url, publicId: '', resourceType: 'image', uploadedAt: '' };
}

function getFilename(url: string): string {
  try {
    const parts = new URL(url).pathname.split('/');
    return decodeURIComponent(parts[parts.length - 1] ?? url);
  } catch {
    return url;
  }
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

// ─── Empty upload zone ────────────────────────────────────────────────────────

function UploadZone({
  onClick,
  disabled,
  label,
  hint,
  compact = false,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  hint?: string;
  compact?: boolean;
}) {
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onClick}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'group w-full flex flex-col items-center justify-center border border-dashed border-border',
        'transition-all duration-200 hover:border-primary/60 hover:bg-primary/2',
        disabled ? 'pointer-events-none opacity-50 cursor-not-allowed' : 'cursor-pointer',
        compact ? 'gap-2 py-4 px-3' : 'gap-4 py-10 px-6'
      )}
    >
      {/* Icon container */}
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-muted transition-all duration-200 group-hover:bg-primary/10 group-hover:scale-105',
          compact ? 'size-9' : 'size-14'
        )}
      >
        <HugeiconsIcon
          icon={compact ? ImageAdd02Icon : CloudUploadIcon}
          size={compact ? 18 : 26}
          className="text-muted-foreground group-hover:text-primary transition-colors"
        />
      </div>

      {/* Text */}
      <div className="text-center space-y-1">
        <p
          className={cn(
            'font-semibold',
            compact ? 'text-[11px]' : 'text-xs'
          )}
        >
          {label}
        </p>
        {hint && (
          <p className="text-[10px] text-muted-foreground">{hint}</p>
        )}
      </div>

      {/* CTA - only in full (non-compact) mode */}
      {!compact && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="pointer-events-none"
          tabIndex={-1}
        >
          Browse Media Library
        </Button>
      )}
    </div>
  );
}

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
          <UploadZone
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
              <p className="text-[10px] font-semibold text-muted-foreground">
                Selected · {urls.length}{maxFiles ? ` / ${maxFiles}` : ''}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-auto py-0.5 text-[10px]"
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
                    <XIcon className="size-3" />
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
  const filename = value ? getFilename(value) : null;

  return (
    <div className={cn('overflow-hidden border border-dashed border-border', className)}>
      {value ? (
        <>
          {/* Image preview */}
          <div className="relative">
            <img
              src={value}
              alt="Selected image"
              className="w-full h-44 object-cover block"
            />
          </div>

          {/* Persistent bottom action bar */}
          <div className="flex items-center gap-2 px-3 py-2 border-t border-border bg-background">
            <HugeiconsIcon
              icon={ImageAdd02Icon}
              size={14}
              className="text-muted-foreground shrink-0"
            />
            <p className="flex-1 text-[11px] text-muted-foreground font-mono truncate min-w-0">
              {filename}
            </p>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(true)}
                disabled={disabled}
                className="text-[10px] h-6 px-2"
              >
                <RefreshCwIcon className="size-3" />
                Change
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => onChange(null)}
                disabled={disabled}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-6 w-6"
              >
                <XIcon className="size-3" />
              </Button>
            </div>
          </div>
        </>
      ) : (
        <UploadZone
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
