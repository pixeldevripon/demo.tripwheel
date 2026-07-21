'use client';

import { Video01Icon } from '@hugeicons/core-free-icons';
import { useState } from 'react';

import MediaSelector from '@/components/common/media-selector';
import { MediaUploadZone } from '@/components/common/media-upload-zone';
import { getMediaKind } from '@/lib/media/media-kind';
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
                <MediaUploadZone
                    onClick={() => setOpen(true)}
                    disabled={disabled}
                    icon={Video01Icon}
                    label='Select a video'
                    hint='Choose from your media library · MP4, WebM or MOV'
                />
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
