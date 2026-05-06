'use client';

import { bulkDeleteMedia, deleteMedia } from '@/app/_actions/mediaActions';
import { Button } from '@/components/ui/button';
import { Delete02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import BulkActionSpinner from './bulk-action-spinner';
import DeleteConfirmationDialog from './delete-confirmation-dialog';
import MasonrySkeletonWithStyles from './loading-skeleton';
import MediaGridUi from './media-grid-ui';
import type { MediaItem } from './media-item';
import MediaListUi from './media-list-ui';
import { MediaUploader, type UploadingFile } from './media-uploader';
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
    setMediaItems: React.Dispatch<React.SetStateAction<MediaItem[]>>;
    loading?: boolean;
    selector?: boolean;
    handleInserToForm?: () => void;
    currentSelection?: MediaItem[];
    multiple?: boolean;
    maxFiles?: number;
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
    setMediaItems,
    loading,
    selector,
    handleInserToForm,
    currentSelection,
    multiple,
    maxFiles,
}: MediaGalleryProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [isShowConfirm, setIsShowConfirm] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
    const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

    const filteredItems = useMemo(() => {
        console.log('MediaGallery received items:', mediaItems?.length);
        if (!mediaItems || mediaItems.length === 0) return [];
        if (!searchTerm || searchTerm.trim() === '') return mediaItems;
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
            const current = bulkSelectedItems || currentSelection || [];
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
                return isAlready
                    ? prev.filter(i => i.id !== selected.id)
                    : [...prev, selected];
            });
        }
    };

    const handleItemClick = (item: MediaItem) => {
        if (selectMode) {
            handleItemSelection(item);
        } else if (!selector) {
            // open full-screen view-only preview
            setSelectedItem(item);
        }
    };

    /* ─── Delete ────────────────────────────────────────────────────── */
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
        setIsDeleting(true);
        
        try {
            if (currentId === 'bulk') {
                const mediaIds = bulkSelectedItems.map(item => item.id);
                const res = await bulkDeleteMedia(mediaIds);
                
                if (res?.success) {
                    // Update state only after success
                    setMediaItems(prev =>
                        prev.filter(item => !mediaIds.includes(item.id))
                    );
                    setbulkSelectedItems([]);
                    toast.success(`${res.result?.count ?? mediaIds.length} media file(s) deleted`);
                } else {
                    toast.error(res.error || 'Bulk delete failed');
                }
            } else {
                const result = await deleteMedia(currentId);
                
                if (result?.success) {
                    // Update state only after success
                    setMediaItems(prev => prev.filter(item => item.id !== currentId));
                    toast.success('Media deleted successfully');
                } else {
                    toast.error(result.error || 'Delete failed');
                }
            }
        } catch {
            toast.error('An unexpected error occurred');
        } finally {
            setIsDeleting(false);
            setItemToDelete(null);
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

    /* ─── Full-screen viewer ────────────────────────────────────────── */
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

            {/* Gallery panel */}
            <div className='border border-border rounded-lg shadow-sm relative'>
                <div
                    className={`min-h-[60vh] ${bulkSelectedItems.length > 0 ? 'max-h-[70vh]' : 'max-h-[75vh]'} overflow-y-auto mx-auto p-6`}>
                    {itemToDelete === 'bulk' && isDeleting ? (
                        <BulkActionSpinner
                            bulkSelectedItems={bulkSelectedItems.length}
                            title='Deleting Media Files'
                            state='Deleting'
                        />
                    ) : (!filteredItems || filteredItems.length === 0) && uploadingFiles.length === 0 ? (
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
                            uploadingFiles={uploadingFiles}
                            uploadProgress={uploadProgress}
                            previewUrls={previewUrls}
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
                            uploadingFiles={uploadingFiles}
                            uploadProgress={uploadProgress}
                            previewUrls={previewUrls}
                        />
                    )}
                </div>

                {/* Hidden uploader — triggered by the Upload button in the toolbar */}
                <MediaUploader
                    folder='users/media'
                    multiple
                    maxFiles={maxFiles || 50}
                    setMediaItems={setMediaItems}
                    selector={selector}
                    setbulkSelectedItems={setbulkSelectedItems}
                    setIsFormOpen={setIsFormOpen}
                    isFormOpen={isFormOpen}
                    bulkSelectedItems={bulkSelectedItems}
                    uploadingFiles={uploadingFiles}
                    setUploadingFiles={setUploadingFiles}
                    uploadProgress={uploadProgress}
                    setUploadProgress={setUploadProgress}
                    previewUrls={previewUrls}
                    setPreviewUrls={setPreviewUrls}
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
