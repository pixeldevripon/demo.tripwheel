'use client';

import { useMediaInfinite, prependMediaToCache } from '@/hooks/media/use-media';
import { useUploadStore } from '@/lib/stores/use-upload-store';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import MediaGallery from './media-gallery';
import type { MediaItem } from '@/types/media';
import MediaSearchControls from './media-search-controls';

interface MediaGalleryManagerProps {
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
}: MediaGalleryManagerProps) => {
    const queryClient = useQueryClient();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectMode, setSelectMode] = useState(false);
    const [bulkSelectedItems, setBulkSelectedItems] = useState<MediaItem[]>([]);

    // ── TanStack Query - pages through the whole library ────────────────────
    // refetchOnWindowFocus: true (set in QueryClient defaults + hook) means
    // the gallery automatically refreshes when the user returns to this tab.
    const {
        data,
        isLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useMediaInfinite();
    const mediaItems = useMemo(
        () => data?.pages.flatMap(page => page.data) ?? [],
        [data],
    );
    const totalCount = data?.pages[0]?.total ?? mediaItems.length;

    const isUploading = useUploadStore(s => s.uploadingFiles.length > 0);

    // Sync external selection (selector mode)
    useEffect(() => {
        setBulkSelectedItems(currentSelection || []);
    }, [currentSelection]);

    /* ── Handle newly uploaded files ─────────────────────────────────── */
    function handleUploadSuccess(newItems: MediaItem[]) {
        // Insert directly into TanStack Query cache - no extra network round-trip
        prependMediaToCache(queryClient, newItems);
    }

    /* ── Insert selected items into parent form ──────────────────────── */
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

    /* ── Bulk selection helpers ──────────────────────────────────────── */
    function handleBulkSelection(action: 'all' | 'clear') {
        if (action === 'clear') {
            setBulkSelectedItems([]);
        } else {
            const lower = searchTerm.toLowerCase();
            const filtered = searchTerm
                ? mediaItems.filter(
                      item =>
                          item?.originalName?.toLowerCase().includes(lower) ||
                          item?.fileName?.toLowerCase().includes(lower)
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
                    loading={isLoading}
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
                totalCount={totalCount}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                onLoadMore={() => fetchNextPage()}
                loading={isLoading && !isUploading}
                selector={selector}
                handleInserToForm={handleInsertToForm}
                currentSelection={currentSelection}
                multiple={multiple}
                maxFiles={maxFiles}
                onUploadSuccess={handleUploadSuccess}
            />
        </div>
    );
};

export default MediaGalleryManager;
