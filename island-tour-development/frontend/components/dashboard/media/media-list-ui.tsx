'use client';

import { useUploadStore } from '@/lib/stores/use-upload-store';
import { Button } from '@/components/ui/button';
import { formateDate, formatFileSize } from '@/lib/utils';
import { Copy01Icon, Delete01Icon, CloudUploadIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Check, ExternalLink, Loader2 } from 'lucide-react';
import Image from 'next/image';
import type { MediaItem } from './media-item';
import { motion, AnimatePresence } from 'framer-motion';

interface MediaListUiProps {
    filteredItems: MediaItem[];
    bulkSelectedItems: MediaItem[];
    isDeleting?: boolean;
    itemToDelete?: string | null;
    handleItemSelection: (item: MediaItem) => void;
    handleEditItem: (item: MediaItem) => void;
    handleItemClick: (item: MediaItem) => void;
    handleDeleteItem: (id: string) => void;
    handleCopyUrl: (item: MediaItem) => void;
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
    handleCopyUrl,
    selectMode,
}: MediaListUiProps) => {
    // Read upload state directly from Zustand — no prop drilling needed
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
                            className='absolute bottom-0 left-0 h-1 bg-primary transition-all duration-300'
                            style={{ width: `${uploadProgress[fileObj.id] || 0}%` }}
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
                                        <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                                        Deleting...
                                    </div>
                                </div>
                            )}

                            {selectMode && (
                                <div className='shrink-0 mr-4'>
                                    <div
                                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all duration-200 ${isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-border hover:border-primary hover:bg-accent/20'}`}
                                        onClick={e => { e.stopPropagation(); !isDeleting && handleItemSelection(item); }}>
                                        {isSelected && <Check className='h-4 w-4' />}
                                    </div>
                                </div>
                            )}

                            <div
                                className='shrink-0 w-16 h-16 mr-4 cursor-pointer'
                                onClick={e => { e.stopPropagation(); !isDeleting && handleItemClick(item); }}>
                                <Image
                                    height={200}
                                    width={200}
                                    src={item.thumbnail || item.url}
                                    alt={item.fileName || item.originalName || 'media'}
                                    className='w-full h-full object-cover rounded-md'
                                />
                            </div>

                            <div className='flex-grow min-w-0'>
                                <h4 className='font-medium max-w-[500px] text-foreground truncate text-sm'>
                                    {item.fileName || item.originalName || item.publicId}
                                </h4>
                                <p className='text-xs text-muted-foreground'>
                                    {item.size ? formatFileSize(item.size) + ' • ' : ''}
                                    {formateDate(item.uploadedAt, 'medium')}
                                </p>
                            </div>

                            {!selectMode && !isDeleting && (
                                <div className='flex items-center gap-2 ml-4 shrink-0'>
                                    <Button
                                        variant='outline'
                                        size='sm'
                                        onClick={e => { e.stopPropagation(); handleCopyUrl(item); }}
                                        className='h-8 px-2.5 text-xs'>
                                        <HugeiconsIcon icon={Copy01Icon} />
                                        Copy URL
                                    </Button>
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
                                        <ExternalLink className='h-3.5 w-3.5' />
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
