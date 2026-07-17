'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CloudUploadFreeIcons, GridIcon, Menu05Icon, Search01Icon, SquareIcon, TickDouble01Icon, UndoIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import type { MediaItem } from '@/types/media';

interface MediaSearchControlsProps {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    viewMode: 'grid' | 'list';
    setViewMode: (mode: 'grid' | 'list') => void;
    setIsFormOpen: (open: boolean) => void;
    setSelectMode: (mode: boolean) => void;
    selectMode: boolean;
    handleBulkSelection: (action: 'all' | 'clear') => void;
    handleCancelSelection: () => void;
    mediaItems: MediaItem[];
    bulkSelectedItems?: MediaItem[];
    selector?: boolean;
    loading?: boolean;
}

const MediaSearchControls = ({
    searchTerm,
    setSearchTerm,
    viewMode,
    setViewMode,
    setIsFormOpen,
    setSelectMode,
    selectMode,
    handleBulkSelection,
    handleCancelSelection,
    mediaItems,
    bulkSelectedItems = [],
    selector,
    loading,
}: MediaSearchControlsProps) => {
    return (
        <div className='flex justify-between items-start'>
            <div className='flex flex-1 items-center gap-4 mb-4'>
                {/* Search */}
                <div className='relative flex-1 max-w-md'>
                    <HugeiconsIcon
                        icon={Search01Icon}
                        size={16}
                        className='absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground'
                    />
                    <Input
                        placeholder='Search media...'
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className='w-full h-9 rounded-md border border-input !bg-background pl-9 pr-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'
                    />
                </div>

                {/* View & Selection controls - hidden in selector mode */}
                {!selector && (
                    <div className='flex items-center gap-2'>
                        <Button
                            variant={viewMode === 'grid' ? 'default' : 'outline'}
                            size='icon'
                            onClick={() => setViewMode('grid')}
                            title='Grid View'>
                            <HugeiconsIcon icon={GridIcon} size={16} />
                        </Button>
                        <Button
                            variant={viewMode === 'list' ? 'default' : 'outline'}
                            size='icon'
                            onClick={() => setViewMode('list')}
                            title='List View'>
                            <HugeiconsIcon icon={Menu05Icon} size={16} />
                        </Button>

                        {!selectMode && (
                            <Button
                                variant='outline'
                                onClick={() => setSelectMode(true)}
                                className='flex py-4 px-12 items-center'>
                                <HugeiconsIcon icon={TickDouble01Icon} size={16} />
                                Bulk Select
                            </Button>
                        )}

                        {selectMode && bulkSelectedItems.length < mediaItems.length && (
                            <Button
                                variant='outline'
                                onClick={() => handleBulkSelection('all')}
                                className='flex py-4 px-12 items-center'>
                                <HugeiconsIcon icon={TickDouble01Icon} size={16} />
                                Select All
                            </Button>
                        )}

                        {!loading && selectMode && mediaItems.length === bulkSelectedItems.length && (
                            <Button
                                variant='outline'
                                onClick={() => handleBulkSelection('clear')}
                                className='flex py-4 px-12 items-center'>
                                <HugeiconsIcon icon={SquareIcon} size={16} className='mr-1' />
                                Unselect All
                            </Button>
                        )}

                        {selectMode && (
                            <Button
                                onClick={() => {
                                    setSelectMode(false);
                                    handleCancelSelection();
                                }}
                                className='flex py-4 px-12 items-center'>
                                <HugeiconsIcon icon={UndoIcon} size={16} />
                                Cancel
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Upload button */}
            <Button onClick={() => setIsFormOpen(true)}>
                <HugeiconsIcon icon={CloudUploadFreeIcons} size={16} />
                Upload Media
            </Button>
        </div>
    );
};

export default MediaSearchControls;
