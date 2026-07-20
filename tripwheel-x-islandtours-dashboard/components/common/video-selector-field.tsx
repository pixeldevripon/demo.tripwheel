'use client';

import { useState } from 'react';

import MediaSelector from '@/components/common/media-selector';
import { getMediaKind } from '@/components/media/media-kind';
import { Button } from '@/components/ui/button';
import type { MediaItem } from '@/types/media';

/**
 * Single-video picker backed by the media library - the video counterpart to
 * ImageSelectorField.
 *
 * Exists because every media field in this dashboard must go through the
 * library: a pasted URL cannot be validated, cannot be re-found later, and
 * silently breaks when the source moves.
 *
 * Kind is tested with `getMediaKind`, never `resourceType === 'video'`:
 * Cloudinary stores AUDIO under resourceType 'video', so the raw field would
 * happily accept an mp3 for a video slot.
 */
export function VideoSelectorField({
    value,
    onChange,
    disabled,
}: {
    value: string | null;
    onChange: (url: string | null) => void;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);

    function handleSelect(items: MediaItem[]) {
        const picked = items.find(item => getMediaKind(item) === 'video');
        if (picked) onChange(picked.url);
    }

    return (
        <>
            {value ? (
                <div className='space-y-2'>
                    <div className='relative w-full max-w-80 overflow-hidden rounded-md border bg-surface-inset'>
                        <video
                            src={value}
                            aria-label='Selected video preview'
                            muted
                            playsInline
                            preload='metadata'
                            controls
                            className='h-40 w-full object-cover'
                        />
                    </div>
                    <div className='flex gap-2'>
                        <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            disabled={disabled}
                            onClick={() => setOpen(true)}>
                            Change video
                        </Button>
                        <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            disabled={disabled}
                            onClick={() => onChange(null)}>
                            Remove
                        </Button>
                    </div>
                </div>
            ) : (
                <button
                    type='button'
                    disabled={disabled}
                    onClick={() => setOpen(true)}
                    className='flex h-24 w-full max-w-80 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed bg-surface-inset text-sm text-content-muted transition-colors hover:border-primary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50'>
                    <span className='font-medium'>Browse media library</span>
                    <span className='text-xs'>MP4, WebM or MOV</span>
                </button>
            )}

            <MediaSelector
                open={open}
                onOpenChange={setOpen}
                onMediaSelect={handleSelect}
                kind='video'
            />
        </>
    );
}
