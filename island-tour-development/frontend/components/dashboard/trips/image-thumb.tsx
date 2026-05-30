'use client';

import { useState } from 'react';
import { ImageIcon, XIcon } from 'lucide-react';
import MediaSelector from '@/components/dashboard/media/media-selector';
import type { MediaItem } from '@/types/media';

export interface ImageThumbProps {
  imageUrl?: string | null;
  onSelect: (url: string) => void;
  onRemove: () => void;
  disabled?: boolean;
}

export function ImageThumb({ imageUrl, onSelect, onRemove, disabled }: ImageThumbProps) {
  const [open, setOpen] = useState(false);

  function handleSelect(items: MediaItem[]) {
    if (items[0]) onSelect(items[0].url);
    setOpen(false);
  }

  return (
    <>
      <div className="group relative size-10 shrink-0 border border-border bg-muted overflow-hidden">
        {imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              disabled={disabled}
              className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove image"
            >
              <XIcon className="size-3.5 text-white" />
            </button>
            <button
              type="button"
              onClick={() => setOpen(true)}
              disabled={disabled}
              className="absolute inset-0"
              title="Change image"
              aria-label="Change image"
            />
          </>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={disabled}
            className="w-full h-full flex items-center justify-center hover:bg-muted/80 transition-colors"
            title="Add image"
          >
            <ImageIcon className="size-4 text-muted-foreground/50" />
          </button>
        )}
      </div>

      <MediaSelector
        open={open}
        onOpenChange={setOpen}
        onMediaSelect={handleSelect}
        multiple={false}
        currentSelection={imageUrl ? [{ id: '', userId: '', url: imageUrl, publicId: '', resourceType: 'image', uploadedAt: '' }] : []}
      />
    </>
  );
}
