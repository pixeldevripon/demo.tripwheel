'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { GridIcon, Menu05Icon, Search01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import type { MediaItem, MediaSort, MediaSortBy, MediaSortOrder, MediaTypeFilter } from '@/types/media';

const SORT_OPTIONS: { value: string; label: string }[] = [
    { value: 'uploadedAt-desc', label: 'Newest first' },
    { value: 'uploadedAt-asc', label: 'Oldest first' },
    { value: 'name-asc', label: 'Name A-Z' },
    { value: 'name-desc', label: 'Name Z-A' },
    { value: 'size-desc', label: 'Largest first' },
    { value: 'size-asc', label: 'Smallest first' },
    { value: 'type-asc', label: 'Type' },
];

const TYPE_OPTIONS: { value: MediaTypeFilter; label: string }[] = [
    { value: 'all', label: 'All types' },
    { value: 'image', label: 'Images' },
    { value: 'video', label: 'Videos' },
    { value: 'audio', label: 'Audio' },
    { value: 'svg', label: 'SVG' },
];

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
    sort?: MediaSort;
    setSort?: (sort: MediaSort) => void;
    typeFilter?: MediaTypeFilter;
    setTypeFilter?: (type: MediaTypeFilter) => void;
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
    sort,
    setSort,
    typeFilter = 'all',
    setTypeFilter,
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
                        className='w-full h-9 rounded-md border border-input !bg-background pl-8 pr-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'
                    />
                </div>

                {/* Type filter */}
                {setTypeFilter && (
                    <Select
                        value={typeFilter}
                        onValueChange={v => setTypeFilter(v as MediaTypeFilter)}>
                        <SelectTrigger className='w-32 h-9'>
                            <SelectValue placeholder='All types' />
                        </SelectTrigger>
                        <SelectContent>
                            {TYPE_OPTIONS.map(o => (
                                <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                {/* Sort */}
                {sort && setSort && (
                    <Select
                        value={`${sort.sortBy}-${sort.sortOrder}`}
                        onValueChange={v => {
                            const [sortBy, sortOrder] = v.split('-') as [MediaSortBy, MediaSortOrder];
                            setSort({ sortBy, sortOrder });
                        }}>
                        <SelectTrigger className='w-36 h-9'>
                            <SelectValue placeholder='Sort' />
                        </SelectTrigger>
                        <SelectContent>
                            {SORT_OPTIONS.map(o => (
                                <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

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
                                Bulk Select
                            </Button>
                        )}

                        {selectMode && bulkSelectedItems.length < mediaItems.length && (
                            <Button
                                variant='outline'
                                onClick={() => handleBulkSelection('all')}
                                className='flex py-4 px-12 items-center'>
                                Select All
                            </Button>
                        )}

                        {!loading && selectMode && mediaItems.length === bulkSelectedItems.length && (
                            <Button
                                variant='outline'
                                onClick={() => handleBulkSelection('clear')}
                                className='flex py-4 px-12 items-center'>
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
                                Cancel
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Upload button */}
            <Button onClick={() => setIsFormOpen(true)}>Upload Media</Button>
        </div>
    );
};

export default MediaSearchControls;
