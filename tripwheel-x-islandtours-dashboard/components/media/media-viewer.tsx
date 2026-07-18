'use client';

import { Button } from '@/components/ui/button';
import { formatFileSize } from '@/lib/utils';
import { ArrowLeft01Icon, File02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'sonner';
import type { MediaItem } from '@/types/media';

interface MediaViewerProps {
    item: MediaItem;
    onClose: () => void;
}

/** One label/value row in the details sidebar; hidden when the value is empty. */
function DetailRow({
    label,
    value,
}: {
    label: string;
    value?: string | null;
}) {
    if (!value) return null;
    return (
        <div className='flex flex-col gap-0.5'>
            <dt className='text-2xs font-medium uppercase tracking-wide text-muted-foreground'>
                {label}
            </dt>
            <dd className='m-0 text-xs text-foreground break-words'>{value}</dd>
        </div>
    );
}

/**
 * Full-screen view-only preview: header (name + actions), then a split body -
 * the image contained in the left pane, a details sidebar (alt text, caption,
 * file specs) on the right. Stacks vertically on small screens.
 */
export default function MediaViewer({ item, onClose }: MediaViewerProps) {
    const isImage = item.resourceType === 'image';
    const displayName = item.originalName || item.fileName || item.publicId;

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

    const dimensions =
        item.width && item.height ? `${item.width} × ${item.height}px` : null;
    const uploadedAt = item.uploadedAt
        ? new Date(item.uploadedAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
          })
        : null;

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

                    <p className='min-w-0 flex-1 text-xs md:text-sm font-medium text-foreground truncate'>
                        {displayName}
                    </p>
                </div>

                <div className='flex items-center gap-2 shrink-0 ml-2'>
                    <Button
                        variant='outline'
                        size='sm'
                        onClick={handleCopyUrl}
                        className='h-7 md:h-8 px-2 md:px-3 text-2xs md:text-xs'>
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
                        className='inline-flex items-center h-7 md:h-8 px-2 md:px-3 text-2xs md:text-xs font-medium border border-border rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-colors'>
                        Download
                    </Link>

                    <Button
                        variant='ghost'
                        size='sm'
                        onClick={onClose}
                        className='h-7 md:h-8 px-2 md:px-3 text-2xs md:text-xs font-semibold'>
                        CLOSE
                    </Button>
                </div>
            </div>

            {/* Body - image pane + details sidebar */}
            <div className='flex-1 min-h-0 flex flex-col md:flex-row'>
                {/* Image pane */}
                <div className='relative flex-1 min-h-0 bg-muted/40 flex items-center justify-center p-4 md:p-8'>
                    {isImage ? (
                        <div className='relative w-full h-full'>
                            <Image
                                fill
                                src={item.url}
                                alt={item.altText || displayName}
                                className='object-contain'
                                priority
                                sizes='(min-width: 768px) 75vw, 100vw'
                            />
                        </div>
                    ) : (
                        <div className='flex flex-col items-center justify-center text-center p-8 md:p-12 bg-card rounded-xl shadow border border-border max-w-sm w-full'>
                            <HugeiconsIcon
                                icon={File02Icon}
                                size={64}
                                className='text-muted-foreground mb-4'
                            />
                            <h3 className='text-sm md:text-base font-semibold text-foreground mb-1'>
                                {displayName}
                            </h3>
                            <p className='text-xs text-muted-foreground mb-4'>
                                Preview not available for this file type
                            </p>
                            <Link
                                href={item.url}
                                target='_blank'
                                className='inline-flex items-center h-8 md:h-9 px-3 md:px-4 text-xs md:text-sm font-medium border border-border rounded-md hover:bg-accent text-foreground transition-colors'>
                                Open file
                            </Link>
                        </div>
                    )}
                </div>

                {/* Details sidebar */}
                <aside className='w-full md:w-80 shrink-0 border-t md:border-t-0 md:border-l border-border bg-card overflow-y-auto'>
                    <div className='p-4 md:p-6 space-y-6'>
                        <div>
                            <h3 className='m-0 text-sm font-semibold text-foreground'>
                                {displayName}
                            </h3>
                            {item.caption && (
                                <p className='mt-1.5 mb-0 text-xs leading-relaxed text-muted-foreground'>
                                    {item.caption}
                                </p>
                            )}
                        </div>

                        <dl className='m-0 space-y-4'>
                            <DetailRow label='Alt text' value={item.altText} />
                            <DetailRow
                                label='Type'
                                value={
                                    item.format
                                        ? `${item.resourceType} · ${item.format.toUpperCase()}`
                                        : item.resourceType
                                }
                            />
                            <DetailRow label='Dimensions' value={dimensions} />
                            <DetailRow
                                label='File size'
                                value={
                                    item.size ? formatFileSize(item.size) : null
                                }
                            />
                            <DetailRow label='Uploaded' value={uploadedAt} />
                            <DetailRow label='Public ID' value={item.publicId} />
                        </dl>
                    </div>
                </aside>
            </div>
        </div>
    );
}
