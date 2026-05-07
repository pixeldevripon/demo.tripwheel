'use client';

import { useUploadStore } from '@/lib/stores/use-upload-store';
import { CloudUploadIcon, Tick02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import MediaItemCard, { type MediaItem } from './media-item';

interface MediaGridUiProps {
    filteredItems: MediaItem[];
    bulkSelectedItems?: MediaItem[];
    isDeleting?: boolean;
    itemToDelete?: string | null;
    handleItemSelection: (item: MediaItem) => void;
    handleEditItem: (item: MediaItem) => void;
    handleItemClick: (item: MediaItem) => void;
    handleDeleteItem: (id: string) => void;
    selectMode?: boolean;
    getImageHeight?: (item: MediaItem) => number;
    handleCopyUrl: (item: MediaItem) => void;
    selector?: boolean;
}

const MediaGridUi = ({
    filteredItems,
    bulkSelectedItems = [],
    isDeleting,
    itemToDelete,
    handleItemSelection,
    handleItemClick,
    handleDeleteItem,
    selectMode,
    handleCopyUrl,
    selector,
}: MediaGridUiProps) => {
    // Read upload state directly from Zustand — no prop drilling needed
    const uploadingFiles = useUploadStore(s => s.uploadingFiles);
    const uploadProgress = useUploadStore(s => s.uploadProgress);
    const previewUrls = useUploadStore(s => s.previewUrls);

    function handleMediaClick(item: MediaItem) {
        if (selectMode) {
            handleItemSelection(item);
        } else if (selector) {
            handleItemSelection(item);
            handleItemClick(item);
        } else {
            handleItemClick(item);
        }
    }

    return (
        <div className='w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4'>
            <AnimatePresence mode='popLayout'>
                {uploadingFiles.map(fileObj => (
                    <motion.div
                        key={fileObj.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className='aspect-square w-full relative border border-border/50 rounded-lg overflow-hidden bg-muted/30 group'>
                        {fileObj.file.type.startsWith('image/') && previewUrls[fileObj.id] && (
                            <Image
                                src={previewUrls[fileObj.id]}
                                alt='preview'
                                fill
                                className='object-cover opacity-40 grayscale blur-[1px]'
                            />
                        )}
                        <div className='absolute inset-0 z-20 flex flex-col items-center justify-center p-3 bg-black/60 backdrop-blur-[2px]'>
                            <div className='grow flex flex-col items-center justify-center'>
                                <motion.div
                                    animate={{ y: [0, -8, 0], opacity: [0.7, 1, 0.7] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                    className='mb-2 text-primary'>
                                    <HugeiconsIcon icon={CloudUploadIcon} size={20} />
                                </motion.div>
                                <span className='text-2xl font-bold text-white tabular-nums drop-shadow-lg transition-all duration-300'>
                                    {Math.round(uploadProgress[fileObj.id] || 0)}%
                                </span>
                            </div>
                            <div className='w-full space-y-1.5'>
                                <p className='text-[10px] font-medium text-white/90 truncate w-full text-center'>
                                    {fileObj.file.name}
                                </p>
                                <div className='h-1 w-full bg-white/10 rounded-full overflow-hidden'>
                                    <motion.div
                                        className='h-full bg-primary'
                                        initial={{ width: 0 }}
                                        animate={{ width: `${uploadProgress[fileObj.id] || 0}%` }}
                                        transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
                                    />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}

                {filteredItems.map(item => {
                    const isSelected = bulkSelectedItems.some(s => s.id === item.id || s.url === item.url);
                    const isBeingDeleted =
                        (itemToDelete === 'bulk' && isDeleting && isSelected) ||
                        (itemToDelete === item.id && isDeleting);
                    const showSelectionUI = selectMode || selector;

                    return (
                        <motion.div
                            key={item.id}
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.2 }}
                            className={`aspect-square w-full relative ${isBeingDeleted ? 'opacity-50' : isSelected && showSelectionUI ? 'ring-2 ring-primary/40 rounded-lg' : ''} ${isDeleting ? 'pointer-events-none' : ''}`}>
                            {isBeingDeleted && (
                                <div className='absolute inset-0 bg-destructive/10 z-20 rounded-lg flex items-center justify-center backdrop-blur-sm'>
                                    <div className='text-destructive font-medium text-sm flex flex-col items-center'>
                                        <Loader2 className='h-6 w-6 mb-2 animate-spin' />
                                        <span>Deleting...</span>
                                    </div>
                                </div>
                            )}

                            {showSelectionUI && (
                                <div className='absolute top-2 left-2 z-30'>
                                    <div
                                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all duration-200 shadow-md ${isSelected ? 'bg-primary border-primary text-primary-foreground' : 'bg-background border-border hover:border-primary hover:bg-accent/20'}`}
                                        onClick={e => {
                                            e.stopPropagation();
                                            if (!isDeleting) handleItemSelection(item);
                                        }}>
                                        {isSelected && <HugeiconsIcon icon={Tick02Icon} size={14} />}
                                    </div>
                                </div>
                            )}

                            <MediaItemCard
                                item={item}
                                onClick={!isDeleting ? () => handleMediaClick(item) : () => {}}
                                onDelete={!isDeleting ? handleDeleteItem : () => {}}
                                onCopyUrl={!isDeleting ? handleCopyUrl : () => {}}
                                viewMode='grid'
                                selectMode={selectMode}
                                className={`h-full w-full rounded-lg overflow-hidden transition-all duration-300 ${!isDeleting ? 'hover:shadow-md hover:scale-[1.02]' : ''} ${isSelected && showSelectionUI ? 'border-2 border-primary shadow-md' : ''}`}
                                selector={selector}
                            />
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
};

export default MediaGridUi;
