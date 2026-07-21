'use client';

import { Card } from '@/components/ui/card';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    Delete02Icon,
    File02Icon,
    Image02Icon,
    MusicNote01Icon,
    PlayIcon,
    SeoIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Image from 'next/image';
import { useState } from 'react';
import type { MediaItem } from '@/types/media';
import { getMediaBadge, getMediaKind } from './media-kind';

interface MediaItemProps {
    item: MediaItem;
    className?: string;
    onClick: (item: MediaItem) => void;
    onDelete: (id: string) => void;
    /** Kept for API compatibility - the tile no longer renders a copy button. */
    onCopyUrl?: (item: MediaItem) => void;
    viewMode?: 'grid' | 'list';
    selectMode?: boolean;
    selector?: boolean;
    /** Above-the-fold hint - forwarded to next/image (LCP). */
    priority?: boolean;
}

export default function MediaItemCard({
    item,
    className = '',
    onClick,
    onDelete,
    viewMode = 'grid',
    selectMode,
    selector,
    priority,
}: MediaItemProps) {
    const [imageLoaded, setImageLoaded] = useState(false);

    const kind = getMediaKind(item);
    const badge = getMediaBadge(item);

    const handleClick = () => onClick(item);
    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(item.id);
    };

    return (
        <Card
            className={`relative p-0 group cursor-pointer overflow-hidden bg-card border-border hover:border-primary transition-colors duration-fast ${className}`}
            onClick={handleClick}>
            <div className='relative h-full'>
                {kind === 'image' ? (
                    <div className='relative w-full h-full bg-surface-inset aspect-square overflow-hidden rounded-md'>
                        <Image
                            width={item?.width || 300}
                            height={item?.height || 300}
                            src={item?.url}
                            alt={item?.altText || item?.fileName || item?.originalName || 'media'}
                            className={`w-full h-full object-contain transition-all duration-500 relative z-10 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                            onLoad={() => setImageLoaded(true)}
                            priority={priority}
                            loading={priority ? 'eager' : undefined}
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
                ) : kind === 'svg' ? (
                    <div className='relative w-full h-full bg-surface-inset aspect-square overflow-hidden rounded-md flex items-center justify-center p-4'>
                        {/* Plain img: the next/image optimizer refuses SVG without
                            dangerouslyAllowSVG, and vectors need no optimizing */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={item.url}
                            alt={item?.altText || item?.fileName || item?.originalName || 'svg'}
                            className='max-w-full max-h-full object-contain'
                        />
                    </div>
                ) : kind === 'video' ? (
                    <div className='relative w-full h-full bg-surface-inset aspect-square overflow-hidden rounded-md'>
                        <video
                            src={item.url}
                            muted
                            playsInline
                            preload='metadata'
                            aria-label={item.originalName || item.fileName || 'video'}
                            className='w-full h-full object-cover'
                        />
                        <div className='absolute inset-0 z-10 flex items-center justify-center'>
                            <div className='size-10 rounded-full bg-black/50 flex items-center justify-center'>
                                <HugeiconsIcon icon={PlayIcon} size={20} className='text-white translate-x-px' />
                            </div>
                        </div>
                    </div>
                ) : kind === 'audio' ? (
                    <div className='w-full h-full bg-muted aspect-square rounded-md flex flex-col items-center justify-center gap-2 p-3'>
                        <HugeiconsIcon icon={MusicNote01Icon} size={40} className='text-primary' />
                        <p className='text-2xs text-muted-foreground truncate max-w-full'>
                            {item.originalName || item.fileName || item.publicId}
                        </p>
                    </div>
                ) : (
                    <div className='w-full h-full bg-muted flex items-center justify-center min-h-[200px]'>
                        <HugeiconsIcon icon={File02Icon} size={48} className='text-primary' />
                    </div>
                )}

                {/* Media-type badge (video / audio / svg) */}
                {badge && (
                    <div className='absolute bottom-2 right-2 z-30'>
                        <span className='bg-black/60 text-white text-2xs px-1.5 py-0.5 rounded font-medium tracking-wide'>
                            {badge}
                        </span>
                    </div>
                )}

                {/* Hover scrim. Pure CSS off the card's `group` - this used to
                    be React state, which re-rendered a full image tile on every
                    pointer enter/leave across a grid of 50+. Opacity only, at
                    --duration-fast (03 §7: hover is a color/opacity transition,
                    no lifts or scale-ups). focus-within keeps it keyboard-visible. */}
                <div
                    aria-hidden
                    className='pointer-events-none absolute inset-0 z-20 bg-gradient-to-t from-black/55 via-black/10 to-transparent opacity-0 transition-opacity duration-fast group-hover:opacity-100 group-focus-within:opacity-100'
                />

                {/* Delete - revealed on card hover (and keyboard focus) */}
                {!selectMode && !selector && (
                    <button
                        type='button'
                        aria-label='Delete media'
                        onClick={handleDelete}
                        className='absolute top-2 right-2 z-30 size-7 rounded-md bg-white/95 shadow-sm border border-border flex items-center justify-center text-destructive cursor-pointer opacity-0 transition-opacity duration-fast group-hover:opacity-100 focus-visible:opacity-100'>
                        <HugeiconsIcon icon={Delete02Icon} size={14} />
                    </button>
                )}

                {/* SEO indicator: this item has alt text and/or a caption.
                    Icon-only, because the old "SEO Optimized" pill was wider
                    than a third of the tile and truncated against the neighbour.

                    z-30 is load-bearing: the image sits at z-10, so the old
                    unlayered wrapper rendered BEHIND the photo and only showed
                    on tiles the image did not fill (the "badge slides behind
                    the image" bug).

                    Bottom-left, not top-left: bulk-select mode puts its
                    checkbox at top-2/left-2 (media-grid-ui) and delete owns
                    top-right, so the top row is spoken for. The type badge
                    (MP4/SVG) holds bottom-right. */}
                {(item?.altText || item?.caption) && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className='absolute bottom-2 left-2 z-30 flex size-6 items-center justify-center rounded-full bg-success-solid text-success-foreground shadow-sm ring-1 ring-black/10'>
                                <HugeiconsIcon icon={SeoIcon} size={14} />
                                <span className='sr-only'>SEO optimized</span>
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>
                            SEO optimized - alt text or caption set
                        </TooltipContent>
                    </Tooltip>
                )}
            </div>
        </Card>
    );
}
