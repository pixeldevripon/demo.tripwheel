'use client';

import { getAllMedia } from '@/app/_actions/mediaActions';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import MediaGallery from './media-gallery';
import type { MediaItem } from './media-item';
import MediaSearchControls from './media-search-controls';

interface MediaGalleryManagerProps {
    /** Initial media prefetched on the server (SSR) */
    media?: MediaItem[];
    /** Selector mode — used when embedding the gallery inside a form */
    selector?: boolean;
    onMediaSelect?: (items: MediaItem[]) => void;
    currentSelection?: MediaItem[];
    multiple?: boolean;
    maxFiles?: number;
}

const MediaGalleryManager = ({
    selector = false,
    onMediaSelect,
    currentSelection,
    multiple,
    maxFiles,
    media,
}: MediaGalleryManagerProps) => {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectMode, setSelectMode] = useState(false);
    const [bulkSelectedItems, setBulkSelectedItems] = useState<MediaItem[]>([]);
    const [mediaItems, setMediaItems] = useState<MediaItem[]>(media || []);
    const [loading, setLoading] = useState(false);

    // Refresh from API on mount (latest data, regardless of SSR prefetch)
    useEffect(() => {
        // Only fetch if we don't have media already, or if we want to ensure latest on mount
        // Let's still fetch but be careful not to overwrite with empty on error
        fetchMedia();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync external selection
    useEffect(() => {
        setBulkSelectedItems(currentSelection || []);
    }, [currentSelection]);

    async function fetchMedia() {
        try {
            setLoading(true);
            const res = await getAllMedia('limit=100&page=1');
            console.log('Client-side media response:', res);

            if (res?.success) {
                setMediaItems(res.result?.media || []);
            } else {
                console.error('Failed to fetch media on client:', res?.error);
                // If we already have media from SSR, don't clear it on client failure
                if (!mediaItems || mediaItems.length === 0) {
                    setMediaItems([]);
                }
            }
        } catch (err) {
            console.error('Error in fetchMedia:', err);
        } finally {
            setLoading(false);
        }
    }

    /* ─── Insert selected items into parent form ─────────────────────── */
    function handleInsertToForm() {
        if (bulkSelectedItems.length === 0) {
            toast.warning('Please select at least one image');
            return;
        }
        if (!multiple && bulkSelectedItems.length > 1) {
            toast.warning('Only one image can be selected');
            return;
        }
        if (multiple && maxFiles && bulkSelectedItems.length > maxFiles) {
            toast.warning(`Maximum ${maxFiles} images allowed`);
            return;
        }
        onMediaSelect?.(bulkSelectedItems);
    }

    /* ─── Bulk selection helpers ─────────────────────────────────────── */
    function handleBulkSelection(action: 'all' | 'clear') {
        if (action === 'clear') {
            setBulkSelectedItems([]);
        } else {
            const filtered = searchTerm
                ? mediaItems.filter(
                      item =>
                          item?.originalName
                              ?.toLowerCase()
                              .includes(searchTerm.toLowerCase()) ||
                          item?.fileName
                              ?.toLowerCase()
                              .includes(searchTerm.toLowerCase())
                  )
                : mediaItems;
            setBulkSelectedItems(filtered);
        }
    }

    function handleCancelSelection() {
        setBulkSelectedItems([]);
        setSelectMode(false);
    }

    return (
        <div className='flex flex-col flex-1 min-h-0'>
            <div className='mt-2 shrink-0'>
                <MediaSearchControls
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    setIsFormOpen={setIsFormOpen}
                    setSelectMode={setSelectMode}
                    selectMode={selectMode}
                    handleBulkSelection={handleBulkSelection}
                    handleCancelSelection={handleCancelSelection}
                    mediaItems={mediaItems}
                    bulkSelectedItems={bulkSelectedItems}
                    selector={selector}
                    loading={loading}
                />
            </div>

            <MediaGallery
                searchTerm={searchTerm}
                viewMode={viewMode}
                isFormOpen={isFormOpen}
                setIsFormOpen={setIsFormOpen}
                selectMode={selectMode}
                bulkSelectedItems={bulkSelectedItems}
                setbulkSelectedItems={setBulkSelectedItems}
                mediaItems={mediaItems}
                setMediaItems={setMediaItems}
                loading={loading}
                selector={selector}
                handleInserToForm={handleInsertToForm}
                currentSelection={currentSelection}
                multiple={multiple}
                maxFiles={maxFiles}
            />
        </div>
    );
};

export default MediaGalleryManager;

