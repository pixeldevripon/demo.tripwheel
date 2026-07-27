'use client';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import MediaGalleryManager from '@/components/media/media-gallery-manager';
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
            <DialogContent className='max-w-none sm:max-w-none w-[calc(100vw-2rem)] lg:w-[calc(100vw-2rem-2*var(--overlay-center-offset,0px))] h-[92dvh] flex flex-col p-0 gap-0 overflow-hidden bg-background rounded-lg'>
                <DialogHeader className='px-6 py-4 border-b shrink-0 flex flex-row items-center justify-between'>
                    <DialogTitle className='text-lg font-bold'>
                        {KIND_TITLE[kind ?? 'all']}
                    </DialogTitle>
                </DialogHeader>
                <div className='flex-1 min-h-0 p-6 overflow-hidden'>
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
