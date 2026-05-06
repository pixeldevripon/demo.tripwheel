'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Cancel01Icon, CloudUploadIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { toast } from 'sonner';
import MediaSelector from '../media/media-selector';

interface ImageUploadSelectorProps {
    fieldName: string;
    onChange: (value: string | string[] | null) => void;
    removeAll?: boolean;
    multiple?: boolean;
    maxFiles?: number;
    previewSize?: string;
    label?: string;
}

export function ImageUploadSelector({
    fieldName,
    onChange,
    value,
    removeAll = false,
    multiple = false,
    maxFiles = 50,
    previewSize,
    label,
}: ImageUploadSelectorProps & { value?: string | string[] }) {
    const [showMediaSelector, setShowMediaSelector] = useState(false);
    const formContext = useFormContext();
    
    // Use value from prop or watch form state
    const externalValue = value !== undefined ? value : (formContext ? formContext.watch(fieldName) : undefined);
    
    // Internal state for immediate UI feedback
    const [internalValue, setInternalValue] = useState<string | string[] | undefined>(externalValue);

    // Sync internal state with external changes
    useEffect(() => {
        setInternalValue(externalValue);
    }, [externalValue]);

    const formImages = internalValue;

    // Normalize form images to always be an array of strings for easier handling in preview
    const normalizedFormImages: string[] = useMemo(() => {
        const rawValues = Array.isArray(formImages) ? formImages : (formImages ? [formImages] : []);
        
        return rawValues
            .map(item => {
                if (typeof item === 'string') return item;
                if (item && typeof item === 'object' && 'url' in item) return (item as any).url;
                return null;
            })
            .filter((url): url is string => !!url);
    }, [formImages]);

    // Handle media selection from gallery
    const handleMediaSelection = useCallback(
        (selectedMedia: any[]) => {
            if (!selectedMedia || selectedMedia.length === 0) {
                setShowMediaSelector(false);
                return;
            }

            if (!multiple) {
                // Single selection mode
                const selectedItem = selectedMedia[0];
                setInternalValue(selectedItem.url);
                onChange(selectedItem.url);
                toast.success('Image selected successfully');
                setShowMediaSelector(false);
                return;
            }

            // Multiple selection mode
            const urls = selectedMedia.map(item => item.url);
            
            if (urls.length > maxFiles) {
                const trimmedUrls = urls.slice(0, maxFiles);
                setInternalValue(trimmedUrls);
                onChange(trimmedUrls);
                toast.warning(
                    `Selected ${urls.length} images, but only ${maxFiles} are allowed. Showing first ${maxFiles} images.`
                );
            } else {
                setInternalValue(urls);
                onChange(urls);
                toast.success(`Selected ${urls.length} image(s) from gallery`);
            }

            setShowMediaSelector(false);
        },
        [multiple, maxFiles, onChange]
    );

    // Remove image
    const removeImage = (index: number) => {
        if (multiple && Array.isArray(formImages)) {
            const newImages = [...formImages];
            newImages.splice(index, 1);
            setInternalValue(newImages);
            onChange(newImages);
        } else {
            setInternalValue(undefined);
            onChange(null);
        }
    };

    const openMediaSelector = () => {
        setShowMediaSelector(true);
    };

    // Calculate remaining slots
    const remainingSlots = multiple
        ? Math.max(0, maxFiles - normalizedFormImages.length)
        : formImages
          ? 0
          : 1;
    const canAddMore = remainingSlots > 0;

    return (
        <div className='space-y-4'>
            {label && (
                <label className='text-xs font-semibold tracking-widest uppercase text-muted-foreground'>
                    {label}
                </label>
            )}
            
            {/* Upload Area */}
            <div
                onClick={canAddMore ? openMediaSelector : undefined}
                className={cn(
                    'group relative flex flex-col items-center justify-center space-y-4 rounded-none border border-dashed border-border p-8 transition-all duration-300',
                    canAddMore
                        ? 'cursor-pointer hover:border-primary/50 hover:bg-primary/2'
                        : 'cursor-not-allowed opacity-50'
                )}>
                <div className='flex h-12 w-12 items-center justify-center rounded-full bg-primary/5 transition-transform duration-300 group-hover:scale-110'>
                    <HugeiconsIcon
                        icon={CloudUploadIcon}
                        size={24}
                        className='text-primary'
                    />
                </div>
                <div className='text-center'>
                    <h3 className='text-xs font-bold tracking-widest uppercase'>
                        {canAddMore
                            ? `Select ${multiple ? 'images' : 'an image'}`
                            : 'Maximum images selected'}
                    </h3>
                    <p className='mt-1 text-[10px] tracking-wider uppercase text-muted-foreground'>
                        {multiple
                            ? `Up to ${maxFiles} files allowed ${
                                  remainingSlots > 0
                                      ? `(${remainingSlots} remaining)`
                                      : ''
                              }`
                            : 'Select a single image from media gallery'}
                    </p>
                </div>
            </div>

            {/* Selected Images Preview */}
            {normalizedFormImages.length > 0 && (
                <div className='space-y-3'>
                    <div className='flex items-center justify-between'>
                        <p className='text-[10px] font-bold tracking-widest uppercase text-muted-foreground'>
                            Selected ({normalizedFormImages.length}
                            {multiple ? `/${maxFiles}` : ''})
                        </p>
                        {removeAll && multiple && (
                            <Button
                                variant='link'
                                size='xs'
                                className='h-auto p-0 text-[10px] font-bold tracking-widest uppercase text-destructive hover:text-destructive/80 no-underline'
                                onClick={() => {
                                    setInternalValue([]);
                                    onChange([]);
                                }}>
                                Remove All
                            </Button>
                        )}
                    </div>
                    <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4'>
                        {normalizedFormImages.map((url, i) => (
                            <div key={i} className='group relative aspect-square overflow-hidden border border-border bg-muted'>
                                <Image
                                    src={url || '/placeholder.svg'}
                                    fill
                                    alt={`Selected ${i + 1}`}
                                    className='object-cover transition-transform duration-500 group-hover:scale-110'
                                />
                                <div className='absolute inset-0 bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100' />
                                <button
                                    type='button'
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeImage(i);
                                    }}
                                    className='absolute top-2 right-2 flex h-6 w-6 items-center justify-center bg-destructive text-white opacity-0 transition-all duration-300 hover:bg-destructive/90 group-hover:opacity-100'
                                    title='Remove image'>
                                    <HugeiconsIcon
                                        icon={Cancel01Icon}
                                        size={14}
                                    />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Media Selector Dialog */}
            {showMediaSelector && (
                <MediaSelector
                    open={showMediaSelector}
                    onOpenChange={setShowMediaSelector}
                    onMediaSelect={handleMediaSelection}
                    multiple={multiple}
                    maxFiles={maxFiles}
                    currentSelection={
                        multiple
                            ? (Array.isArray(formImages) ? formImages.map(url => ({ url } as any)) : [])
                            : formImages ? [{ url: formImages } as any] : []
                    }
                />
            )}
        </div>
    );
}
