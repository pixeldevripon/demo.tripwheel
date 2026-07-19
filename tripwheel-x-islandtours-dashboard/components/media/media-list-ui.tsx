'use client';

import { useUploadStore } from '@/lib/stores/use-upload-store';
import { Button } from '@/components/ui/button';
import { formatDate, formatFileSize } from '@/lib/utils';
import { CloudUploadIcon, Delete01Icon, File02Icon, LinkSquare01Icon, Loading03Icon, MusicNote01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Image from 'next/image';
import type { MediaItem } from '@/types/media';
import { motion, AnimatePresence } from 'framer-motion';
import { getMediaKind } from './media-kind';

/** 64px thumbnail that adapts to the media kind. */
function ListThumb({ item }: { item: MediaItem }) {
    const kind = getMediaKind(item);
    if (kind === 'video') {
        return (
            <video
                src={item.url}
                muted
                playsInline
                preload='metadata'
                aria-label={item.originalName || item.fileName || 'video'}
                className='w-full h-full object-cover rounded-md'
            />
        );
    }
    if (kind === 'audio') {
        return (
            <div className='w-full h-full bg-muted rounded-md flex items-center justify-center'>
                <HugeiconsIcon icon={MusicNote01Icon} size={24} className='text-primary' />
            </div>
        );
    }
    if (kind === 'svg') {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={item.url}
                alt={item.fileName || item.originalName || 'svg'}
                className='w-full h-full object-contain rounded-md bg-muted p-1'
            />
        );
    }
    if (kind === 'file') {
        return (
            <div className='w-full h-full bg-muted rounded-md flex items-center justify-center'>
                <HugeiconsIcon icon={File02Icon} size={24} className='text-primary' />
            </div>
        );
    }
    return (
        <Image
            height={200}
            width={200}
            src={item.thumbnail || item.url}
            alt={item.fileName || item.originalName || 'media'}
            className='w-full h-full object-cover rounded-md'
        />
    );
}

interface MediaListUiProps {
    filteredItems: MediaItem[];
    bulkSelectedItems: MediaItem[];
    isDeleting?: boolean;
    itemToDelete?: string | null;
    handleItemSelection: (item: MediaItem) => void;
    handleEditItem: (item: MediaItem) => void;
    handleItemClick: (item: MediaItem) => void;
    handleDeleteItem: (id: string) => void;
    selectMode?: boolean;
}

const MediaListUi = ({
    filteredItems,
    bulkSelectedItems,
    isDeleting,
    itemToDelete,
    handleItemSelection,
    handleEditItem,
    handleItemClick,
    handleDeleteItem,
    selectMode,
}: MediaListUiProps) => {
    // Read upload state directly from Zustand - no prop drilling needed
    const uploadingFiles = useUploadStore(s => s.uploadingFiles);
    const uploadProgress = useUploadStore(s => s.uploadProgress);
    const previewUrls = useUploadStore(s => s.previewUrls);

    return (
        <div className='space-y-3 rounded-lg border border-border bg-card shadow-sm'>
            <AnimatePresence mode='popLayout'>
                {uploadingFiles.map(fileObj => (
                    <motion.div
                        key={fileObj.id}
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className='flex items-center px-4 py-3 border-b border-border bg-muted/20 relative group overflow-hidden'>
                        <div
                            className='absolute bottom-0 left-0 h-1 bg-primary transition-all duration-300 w-(--upload-progress)'
                            // 03 §8.3: the runtime width travels through a CSS custom
                            // property; the spread keeps a literal `style` attribute
                            // out of the JSX.
                            {...{
                                style: {
                                    '--upload-progress': `${uploadProgress[fileObj.id] || 0}%`,
                                } as React.CSSProperties,
                            }}
                        />
                        <div className='shrink-0 w-12 h-12 mr-4 relative rounded-md overflow-hidden bg-muted/40 flex items-center justify-center border border-border/50'>
                            {fileObj.file.type.startsWith('image/') && previewUrls[fileObj.id] ? (
                                <Image
                                    src={previewUrls[fileObj.id]}
                                    alt='preview'
                                    fill
                                    className='object-cover opacity-60 grayscale blur-[0.5px]'
                                />
                            ) : (
                                <HugeiconsIcon icon={Delete01Icon} className='text-muted-foreground' />
                            )}
                            <motion.div
                                animate={{ y: [0, -3, 0], opacity: [0.6, 1, 0.6] }}
                                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                className='absolute z-10 text-primary'>
                                <HugeiconsIcon icon={CloudUploadIcon} size={24} />
                            </motion.div>
                        </div>

                        <div className='flex-grow min-w-0 pr-4'>
                            <div className='flex items-center justify-between mb-1.5'>
                                <h4 className='font-medium text-foreground truncate text-sm'>
                                    {fileObj.file.name}
                                </h4>
                                <span className='text-xs font-bold text-primary tabular-nums'>
                                    {Math.round(uploadProgress[fileObj.id] || 0)}%
                                </span>
                            </div>
                            <div className='h-1 w-full bg-muted rounded-full overflow-hidden'>
                                <motion.div
                                    className='h-full bg-primary'
                                    initial={{ width: 0 }}
                                    animate={{ width: `${uploadProgress[fileObj.id] || 0}%` }}
                                    transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                                />
                            </div>
                        </div>
                    </motion.div>
                ))}

                {filteredItems.map(item => {
                    const isSelected = bulkSelectedItems.some(s => s.id === item.id || s.url === item.url);
                    const isBeingDeleted =
                        (itemToDelete === 'bulk' && isDeleting && isSelected) ||
                        (itemToDelete === item.id && isDeleting);

                    return (
                        <motion.div
                            key={item.id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => {
                                if (selectMode && !isDeleting) handleItemSelection(item);
                                else if (!isDeleting) handleEditItem(item);
                            }}
                            className={`flex items-center px-4 py-3 border-b border-border transition-all duration-200 relative last:border-b-0 ${isBeingDeleted ? 'opacity-50 bg-destructive/5 cursor-not-allowed' : isSelected && selectMode ? 'bg-primary/5 ring-1 ring-primary/20 hover:bg-primary/8' : 'hover:bg-accent/30 cursor-pointer'} ${isDeleting ? 'pointer-events-none' : ''}`}>
                            {isBeingDeleted && (
                                <div className='absolute inset-0 flex items-center justify-center bg-destructive/10 rounded-lg backdrop-blur-sm'>
                                    <div className='text-destructive font-medium text-sm flex items-center'>
                                        <HugeiconsIcon icon={Loading03Icon} className='h-4 w-4 mr-2 animate-spin' />
                                        Deleting...
                                    </div>
                                </div>
                            )}

                            {selectMode && (
                                <div className='shrink-0 mr-4'>
                                    <div
                                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all duration-200 ${isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-border hover:border-primary hover:bg-accent/20'}`}
                                        onClick={e => { e.stopPropagation(); if (!isDeleting) handleItemSelection(item); }}>
                                        {isSelected && <HugeiconsIcon icon={Tick02Icon} className='h-4 w-4' />}
                                    </div>
                                </div>
                            )}

                            <div
                                className='shrink-0 w-16 h-16 mr-4 cursor-pointer'
                                onClick={e => { e.stopPropagation(); if (!isDeleting) handleItemClick(item); }}>
                                <ListThumb item={item} />
                            </div>

                            <div className='flex-grow min-w-0'>
                                <h4 className='font-medium max-w-[500px] text-foreground truncate text-sm'>
                                    {item.fileName || item.originalName || item.publicId}
                                </h4>
                                <p className='text-xs text-muted-foreground'>
                                    {(item.size ?? item.bytes) ? formatFileSize((item.size ?? item.bytes)!) + ' • ' : ''}
                                    {formatDate(item.uploadedAt, 'medium')}
                                </p>
                            </div>

                            {!selectMode && !isDeleting && (
                                <div className='flex items-center gap-2 ml-4 shrink-0'>
                                    <Button
                                        variant='outline'
                                        size='sm'
                                        onClick={e => { e.stopPropagation(); handleDeleteItem(item.id); }}
                                        className='h-8 px-2.5 text-xs text-destructive hover:text-destructive'>
                                        <HugeiconsIcon icon={Delete01Icon} />
                                    </Button>
                                    <Button
                                        variant='outline'
                                        size='sm'
                                        onClick={e => { e.stopPropagation(); window.open(item.url, '_blank'); }}
                                        className='h-8 px-2.5 text-xs'>
                                        <HugeiconsIcon icon={LinkSquare01Icon} className='h-3.5 w-3.5' />
                                    </Button>
                                </div>
                            )}
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
};

export default MediaListUi;
