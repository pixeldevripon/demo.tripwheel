'use client';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import MediaGalleryManager from './media-gallery-manager';
import type { MediaItem } from './media-item';

interface MediaSelectorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onMediaSelect: (items: MediaItem[]) => void;
    multiple?: boolean;
    maxFiles?: number;
    currentSelection?: MediaItem[];
}

export default function MediaSelector({
    open,
    onOpenChange,
    onMediaSelect,
    multiple = false,
    maxFiles = 50,
    currentSelection = [],
}: MediaSelectorProps) {
    const handleMediaSelect = (items: MediaItem[]) => {
        onMediaSelect(items);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='max-w-none sm:max-w-none inset-0 w-screen h-screen flex flex-col p-0 gap-0 overflow-hidden bg-background border-none rounded-none translate-x-0 translate-y-0'>
                <DialogHeader className='px-6 py-4 border-b shrink-0 flex flex-row items-center justify-between'>
                    <DialogTitle className='text-lg font-bold tracking-widest uppercase'>Select Media</DialogTitle>
                </DialogHeader>
                <div className='flex-1 min-h-0 p-6 overflow-hidden'>
                    <MediaGalleryManager
                        selector={true}
                        onMediaSelect={handleMediaSelect}
                        multiple={multiple}
                        maxFiles={maxFiles}
                        currentSelection={currentSelection}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
