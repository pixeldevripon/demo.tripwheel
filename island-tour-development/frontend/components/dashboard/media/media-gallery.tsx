'use client';

import { useDeleteMedia, useBulkDeleteMedia, mediaKeys } from '@/hooks/media/use-media';
import { useUploadStore } from '@/lib/stores/use-upload-store';
import { Button } from '@/components/ui/button';
import { Delete02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import BulkActionSpinner from './bulk-action-spinner';
import DeleteConfirmationDialog from './delete-confirmation-dialog';
import MasonrySkeletonWithStyles from './loading-skeleton';
import MediaGridUi from './media-grid-ui';
import type { MediaItem } from '@/types/media';
import MediaListUi from './media-list-ui';
import { MediaUploader } from './media-uploader';
import MediaViewer from './media-viewer';
import NoMediaUi from './no-media-ui';

interface MediaGalleryProps {
    searchTerm?: string;
    viewMode?: 'grid' | 'list';
    isFormOpen: boolean;
    setIsFormOpen: (open: boolean) => void;
    selectMode?: boolean;
    bulkSelectedItems?: MediaItem[];
    setbulkSelectedItems: React.Dispatch<React.SetStateAction<MediaItem[]>>;
    mediaItems: MediaItem[];
    loading?: boolean;
    selector?: boolean;
    handleInserToForm?: () => void;
    currentSelection?: MediaItem[];
    multiple?: boolean;
    maxFiles?: number;
    /** Called after upload - parent inserts items into TQ cache */
    onUploadSuccess: (items: MediaItem[]) => void;
}

export default function MediaGallery({
    searchTerm = '',
    viewMode = 'grid',
    isFormOpen,
    setIsFormOpen,
    selectMode,
    bulkSelectedItems = [],
    setbulkSelectedItems,
    mediaItems,
    loading,
    selector,
    handleInserToForm,
    currentSelection,
    multiple,
    maxFiles,
    onUploadSuccess,
}: MediaGalleryProps) {
    const queryClient = useQueryClient();
    const [isShowConfirm, setIsShowConfirm] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);

    // Upload state comes from Zustand - persists across tab switches
    const { uploadingFiles, uploadProgress, previewUrls } = useUploadStore();

    // TanStack Query delete mutations
    const deleteMutation = useDeleteMedia();
    const bulkDeleteMutation = useBulkDeleteMedia();
    const isDeleting = deleteMutation.isPending || bulkDeleteMutation.isPending;

    const filteredItems = useMemo(() => {
        if (!mediaItems?.length) return [];
        if (!searchTerm?.trim()) return mediaItems;
        const lower = searchTerm.toLowerCase();
        return mediaItems.filter(
            item =>
                item?.originalName?.toLowerCase().includes(lower) ||
                item?.fileName?.toLowerCase().includes(lower) ||
                item?.publicId?.toLowerCase().includes(lower)
        );
    }, [mediaItems, searchTerm]);

    /* ─── Selection ─────────────────────────────────────────────────── */
    const handleItemSelection = (selected: MediaItem) => {
        if (!selected) return;
        if (selector) {
            if (!multiple) {
                setbulkSelectedItems([selected]);
                return;
            }
            const current = bulkSelectedItems ?? currentSelection ?? [];
            const isAlready = current.some(i => i.id === selected.id || i.url === selected.url);
            if (isAlready) {
                setbulkSelectedItems(prev => prev.filter(i => i.id !== selected.id && i.url !== selected.url));
            } else {
                if (current.length >= (maxFiles ?? Infinity)) {
                    toast.warning(`Maximum ${maxFiles} images allowed`);
                    return;
                }
                setbulkSelectedItems(prev => [...prev, selected]);
            }
        } else {
            setbulkSelectedItems(prev => {
                const isAlready = prev.some(i => i.id === selected.id);
                return isAlready ? prev.filter(i => i.id !== selected.id) : [...prev, selected];
            });
        }
    };

    const handleItemClick = (item: MediaItem) => {
        if (selectMode) {
            handleItemSelection(item);
        } else if (!selector) {
            setSelectedItem(item);
        }
    };

    /* ─── Delete - optimistic update + server confirm ───────────────── */
    const handleDeleteItem = (id: string) => {
        setIsShowConfirm(true);
        setItemToDelete(id);
    };

    const handleBulkDelete = () => {
        if (bulkSelectedItems.length === 0) return;
        setIsShowConfirm(true);
        setItemToDelete('bulk');
    };

    const handleDeleteConfirm = async () => {
        if (!itemToDelete) return;
        const currentId = itemToDelete;
        setIsShowConfirm(false);

        if (currentId === 'bulk') {
            const ids = bulkSelectedItems.map(i => i.id);
            // Optimistic: remove from cache immediately
            queryClient.setQueryData<MediaItem[]>(
                mediaKeys.list('limit=100&page=1'),
                old => old?.filter(item => !ids.includes(item.id)) ?? []
            );
            setbulkSelectedItems([]);
            bulkDeleteMutation.mutate(ids, {
                onError: () => {
                    // Rollback: invalidate so fresh data loads
                    queryClient.invalidateQueries({ queryKey: mediaKeys.all });
                },
            });
        } else {
            // Optimistic: remove from cache immediately
            queryClient.setQueryData<MediaItem[]>(
                mediaKeys.list('limit=100&page=1'),
                old => old?.filter(item => item.id !== currentId) ?? []
            );
            setItemToDelete(null);
            deleteMutation.mutate(currentId, {
                onError: () => {
                    queryClient.invalidateQueries({ queryKey: mediaKeys.all });
                },
            });
        }
    };

    const handleCopyUrl = async (item: MediaItem) => {
        try {
            await navigator.clipboard.writeText(item.url);
            toast.success('Copied');
        } catch {}
    };

    /* ─── Loading ───────────────────────────────────────────────────── */
    if (loading) {
        return (
            <div className='border rounded-lg shadow'>
                <div className='min-h-[60vh] mx-auto flex justify-center items-center p-6'>
                    <MasonrySkeletonWithStyles />
                </div>
            </div>
        );
    }

    if (selectedItem) {
        return <MediaViewer item={selectedItem} onClose={() => setSelectedItem(null)} />;
    }

    return (
        <>
            {/* Bulk-select action bar */}
            {!selector && selectMode && (
                <div className='flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-lg mb-4'>
                    <div className='flex items-center space-x-4'>
                        <h4 className='text-sm font-medium text-foreground'>
                            {bulkSelectedItems.length} item{bulkSelectedItems.length !== 1 ? 's' : ''} selected
                        </h4>
                        {bulkSelectedItems.length > 0 && (
                            <Button
                                variant='outline'
                                size='sm'
                                onClick={() => setbulkSelectedItems([])}
                                disabled={isDeleting}
                                className='text-primary border-border hover:bg-accent'>
                                Clear Selection
                            </Button>
                        )}
                    </div>
                    {bulkSelectedItems.length > 0 && (
                        <Button
                            variant='destructive'
                            size='sm'
                            onClick={handleBulkDelete}
                            disabled={isDeleting}
                            className='flex items-center'>
                            {isDeleting ? (
                                <>
                                    <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                                    <span>Deleting...</span>
                                </>
                            ) : (
                                <>
                                    <HugeiconsIcon icon={Delete02Icon} size={16} className='mr-2' />
                                    Delete Selected ({bulkSelectedItems.length})
                                </>
                            )}
                        </Button>
                    )}
                </div>
            )}

            <div className='border border-border rounded-lg shadow-sm relative'>
                <div className={`min-h-[60vh] ${bulkSelectedItems.length > 0 ? 'max-h-[70vh]' : 'max-h-[75vh]'} overflow-y-auto mx-auto p-6`}>
                    {itemToDelete === 'bulk' && isDeleting ? (
                        <BulkActionSpinner
                            bulkSelectedItems={bulkSelectedItems.length}
                            title='Deleting Media Files'
                            state='Deleting'
                        />
                    ) : (!filteredItems?.length) && !uploadingFiles.length ? (
                        <NoMediaUi
                            searchTerm={searchTerm}
                            setIsFormOpen={setIsFormOpen}
                            isDeleting={isDeleting}
                        />
                    ) : viewMode === 'list' ? (
                        <MediaListUi
                            filteredItems={filteredItems}
                            bulkSelectedItems={bulkSelectedItems}
                            isDeleting={isDeleting}
                            itemToDelete={itemToDelete}
                            handleItemSelection={handleItemSelection}
                            handleEditItem={item => setSelectedItem(item)}
                            handleItemClick={handleItemClick}
                            handleDeleteItem={handleDeleteItem}
                            selectMode={selectMode}
                            handleCopyUrl={handleCopyUrl}
                        />
                    ) : (
                        <MediaGridUi
                            filteredItems={filteredItems}
                            bulkSelectedItems={bulkSelectedItems}
                            isDeleting={isDeleting}
                            itemToDelete={itemToDelete}
                            handleItemSelection={handleItemSelection}
                            handleEditItem={item => setSelectedItem(item)}
                            handleItemClick={handleItemClick}
                            handleDeleteItem={handleDeleteItem}
                            selectMode={selectMode}
                            handleCopyUrl={handleCopyUrl}
                            selector={selector}
                        />
                    )}
                </div>

                {/* Hidden uploader - triggered by Upload button in toolbar */}
                <MediaUploader
                    folder='users/media'
                    multiple
                    maxFiles={maxFiles || 50}
                    selector={selector}
                    setbulkSelectedItems={setbulkSelectedItems}
                    setIsFormOpen={setIsFormOpen}
                    isFormOpen={isFormOpen}
                    bulkSelectedItems={bulkSelectedItems}
                    onUploadSuccess={onUploadSuccess}
                />

                {/* Selector insert bar */}
                {selector && bulkSelectedItems.length > 0 && (
                    <div className='p-3'>
                        <hr className='outline-0 border-t border-primary/30' />
                        <div className='flex justify-end mt-2 items-center gap-4'>
                            <h5>Selected {bulkSelectedItems.length} items</h5>
                            <Button onClick={handleInserToForm} size='lg' className='rounded'>
                                Insert
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {isShowConfirm && (
                <DeleteConfirmationDialog
                    open={isShowConfirm}
                    setOpen={setIsShowConfirm}
                    handleDeleteCancel={() => setIsShowConfirm(false)}
                    handleDeleteConfirm={handleDeleteConfirm}
                    isDeleting={isDeleting}
                />
            )}
        </>
    );
}
