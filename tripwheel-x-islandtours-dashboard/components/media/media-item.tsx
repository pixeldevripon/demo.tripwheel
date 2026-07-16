'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    Copy01Icon,
    Delete02Icon,
    File02Icon,
    Image02Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Image from 'next/image';
import { useState } from 'react';
import type { MediaItem } from '@/types/media';

interface MediaItemProps {
    item: MediaItem;
    className?: string;
    style?: React.CSSProperties;
    onClick: (item: MediaItem) => void;
    onDelete: (id: string) => void;
    onCopyUrl: (item: MediaItem) => void;
    viewMode?: 'grid' | 'list';
    selectMode?: boolean;
    selector?: boolean;
}

export default function MediaItemCard({
    item,
    className = '',
    style,
    onClick,
    onDelete,
    onCopyUrl,
    viewMode = 'grid',
    selectMode,
    selector,
}: MediaItemProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);

    const handleClick = () => onClick(item);
    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(item.id);
    };

    return (
        <Card
            className={`relative p-0 group cursor-pointer overflow-hidden bg-card border-border hover:border-primary transition-all duration-300 hover:shadow-lg ${className}`}
            style={style}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={handleClick}>
            <div className='relative h-full'>
                {item.resourceType === 'image' ? (
                    <div className='relative w-full h-full dark:bg-gray-200 aspect-square overflow-hidden rounded-md'>
                        <Image
                            width={item?.width || 300}
                            height={item?.height || 300}
                            src={item?.url}
                            alt={item?.altText || item?.fileName || item?.originalName || 'media'}
                            className={`w-full h-full object-contain transition-all duration-500 relative z-10 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                            onLoad={() => setImageLoaded(true)}
                            sizes={
                                viewMode === 'grid'
                                    ? '(max-width: 768px) 100vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw'
                                    : '64px'
                            }
                        />
                        {!imageLoaded && (
                            <div className='absolute inset-0 bg-muted animate-pulse flex items-center justify-center z-20'>
                                <HugeiconsIcon icon={Image02Icon} size={32} className='text-primary' />
                            </div>
                        )}
                    </div>
                ) : (
                    <div className='w-full h-full bg-muted flex items-center justify-center min-h-[200px]'>
                        <HugeiconsIcon icon={File02Icon} size={48} className='text-primary' />
                    </div>
                )}

                {/* Hover Overlay */}
                <div
                    className={`absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent transition-opacity duration-300 z-20 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                    {/* Action Buttons */}
                    {!selectMode && !selector && (
                        <div
                            className={`absolute top-3 right-3 z-[99] flex gap-2 transition-all duration-300 transform ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
                            <Button
                                variant='default'
                                size='sm'
                                onClick={e => {
                                    e.stopPropagation();
                                    onCopyUrl(item);
                                }}
                                className='bg-accent flex items-center text-foreground'>
                                <HugeiconsIcon icon={Copy01Icon} size={16} />
                            </Button>
                            <Button
                                variant='default'
                                size='sm'
                                onClick={handleDelete}
                                className='bg-accent flex items-center text-destructive hover:bg-destructive/10'>
                                <HugeiconsIcon icon={Delete02Icon} size={16} />
                            </Button>
                        </div>
                    )}
                </div>

                {/* SEO Indicator */}
                {(item?.altText || item?.caption) && (
                    <div className='absolute top-3 left-3'>
                        <div className='bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-sm'>
                            SEO Optimized
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
}
