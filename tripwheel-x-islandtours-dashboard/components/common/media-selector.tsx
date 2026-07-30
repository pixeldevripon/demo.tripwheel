'use client';

import MediaGalleryManager from '@/components/media/media-gallery-manager';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import type { MediaItem, MediaTypeFilter } from '@/types/media';

const KIND_TITLE: Record<MediaTypeFilter, string> = {
    all: 'Select Media',
    image: 'Select an Image',
    video: 'Select a Video',
    audio: 'Select Audio',
    svg: 'Select an SVG',
};

interface MediaSelectorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onMediaSelect: (items: MediaItem[]) => void;
    multiple?: boolean;
    maxFiles?: number;
    currentSelection?: MediaItem[];
    /** Restrict the library to one asset kind (e.g. 'video'). */
    kind?: MediaTypeFilter;
}

export default function MediaSelector({
    open,
    onOpenChange,
    onMediaSelect,
    multiple = false,
    maxFiles = 50,
    currentSelection = [],
    kind,
}: MediaSelectorProps) {
    const handleMediaSelect = (items: MediaItem[]) => {
        onMediaSelect(items);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='max-w-none sm:max-w-none w-[calc(100vw-2rem)] h-[92dvh] flex flex-col p-0 gap-0 overflow-hidden bg-background rounded-lg'>
                <DialogHeader className='px-6 py-4 border-b shrink-0 flex flex-row items-center justify-between'>
                    <DialogTitle className='text-lg font-medium'>
                        {KIND_TITLE[kind ?? 'all']}
                    </DialogTitle>
                </DialogHeader>
                {/* `flex flex-col` is load-bearing, not decoration. Without it
                    this box is a BLOCK, so the `flex-1 min-h-0` on
                    MediaGalleryManager below is inert and the gallery renders at
                    its natural height - which `overflow-hidden` then crops,
                    silently taking the bottom of the panel with it. */}
                <div className='flex min-h-0 flex-1 flex-col p-6 overflow-hidden'>
                    <MediaGalleryManager
                        selector={true}
                        onMediaSelect={handleMediaSelect}
                        multiple={multiple}
                        maxFiles={maxFiles}
                        currentSelection={currentSelection}
                        kind={kind}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}

