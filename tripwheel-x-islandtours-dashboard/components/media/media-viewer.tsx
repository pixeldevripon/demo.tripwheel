'use client';

import { Button } from '@/components/ui/button';
import { formatFileSize } from '@/lib/utils';
import {
    ArrowLeft01Icon,
    Copy01Icon,
    Download02Icon,
    File02Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'sonner';
import type { MediaItem } from '@/types/media';

interface MediaViewerProps {
    item: MediaItem;
    onClose: () => void;
}

/**
 * Full-screen view-only preview.
 * Clean, responsive, and uses the full viewport without exceeding it.
 */
export default function MediaViewer({ item, onClose }: MediaViewerProps) {
    const isImage = item.resourceType === 'image';

    const filenameForDownload = (
        item.originalName ||
        item.fileName ||
        'download'
    )
        .split('.')
        .slice(0, -1)
        .join('.');

    const handleCopyUrl = async () => {
        try {
            await navigator.clipboard.writeText(item.url);
            toast.success('URL copied to clipboard');
        } catch {
            toast.error('Failed to copy URL');
        }
    };

    return (
        <div className='fixed inset-0 z-99999 h-screen flex flex-col bg-background overflow-hidden animate-in fade-in duration-200'>
            {/* Header - Fixed height */}
            <div className='flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-border bg-card shrink-0 z-50'>
                <div className='flex items-center gap-3 md:gap-4 min-w-0 flex-1'>
                    <Button
                        variant='ghost'
                        size='icon'
                        onClick={onClose}
                        className='text-muted-foreground hover:text-foreground shrink-0 h-8 w-8 md:h-9 md:w-9'>
                        <HugeiconsIcon icon={ArrowLeft01Icon} size={20} />
                    </Button>

                    <div className='min-w-0 flex-1'>
                        <p className='text-xs md:text-sm font-medium text-foreground truncate'>
                            {item.originalName ||
                                item.fileName ||
                                item.publicId}
                        </p>
                        <p
                            className='hidden sm:block text-[10px] md:text-[11px] text-muted-foreground truncate max-w-lg mt-0.5'
                            title={item.url}>
                            {item.url}
                        </p>
                    </div>
                </div>

                <div className='flex items-center gap-2 shrink-0 ml-2'>
                    <Button
                        variant='outline'
                        size='sm'
                        onClick={handleCopyUrl}
                        className='h-7 md:h-8 px-2 md:px-3 text-[10px] md:text-xs flex items-center gap-1.5 md:gap-2'>
                        <HugeiconsIcon icon={Copy01Icon} size={14} />
                        <span className='hidden sm:inline'>COPY URL</span>
                        <span className='sm:hidden'>URL</span>
                    </Button>

                    <Link
                        href={item.url.replace(
                            '/upload/',
                            `/upload/fl_attachment:${filenameForDownload}/`
                        )}
                        download={
                            item.originalName || item.fileName || 'media-file'
                        }
                        className='inline-flex items-center h-7 md:h-8 px-2 md:px-3 text-[10px] md:text-xs font-medium border border-border rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-colors'>
                        <HugeiconsIcon
                            icon={Download02Icon}
                            size={14}
                            className='md:mr-1.5'
                        />
                        <span className='hidden sm:inline'>Download</span>
                    </Link>

                    <Button
                        variant='ghost'
                        size='sm'
                        onClick={onClose}
                        className='h-7 md:h-8 px-2 md:px-3 text-[10px] md:text-xs font-semibold'>
                        CLOSE
                    </Button>
                </div>
            </div>

            {/* Preview area - strictly occupies all remaining space */}
            <div className='flex-1 relative w-full bg-black/10 flex items-center justify-center'>
                {isImage ? (
                    <div className='absolute inset-0 md:inset-2'>
                        <Image
                            fill
                            src={item.url}
                            alt={
                                item.altText ||
                                item.fileName ||
                                item.originalName ||
                                'media preview'
                            }
                            className='object-contain'
                            priority
                            sizes='100vw'
                        />
                    </div>
                ) : (
                    <div className='relative z-10 p-6'>
                        <div className='flex flex-col items-center justify-center text-center p-8 md:p-12 bg-card rounded-xl shadow border border-border max-w-sm w-full'>
                            <HugeiconsIcon
                                icon={File02Icon}
                                size={64}
                                md-size={80}
                                className='text-muted-foreground mb-4'
                            />
                            <h3 className='text-sm md:text-base font-semibold text-foreground mb-1'>
                                {item.originalName ||
                                    item.fileName ||
                                    'Document'}
                            </h3>
                            <p className='text-xs text-muted-foreground mb-4'>
                                Preview not available for this file type
                            </p>
                            {item.size && (
                                <p className='text-[10px] text-muted-foreground uppercase tracking-widest mb-4'>
                                    {formatFileSize(item.size)}
                                </p>
                            )}
                            <Link
                                href={item.url}
                                target='_blank'
                                className='inline-flex items-center h-8 md:h-9 px-3 md:px-4 text-xs md:text-sm font-medium border border-border rounded-md hover:bg-accent text-foreground transition-colors'>
                                <HugeiconsIcon
                                    icon={Download02Icon}
                                    size={14}
                                    className='mr-1.5'
                                />
                                Open file
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

