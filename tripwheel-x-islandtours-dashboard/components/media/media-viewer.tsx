'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useUpdateMedia } from '@/hooks/media/use-media';
import { getMediaKind } from '@/lib/media/media-kind';
import { formatFileSize } from '@/lib/utils';
import type { MediaItem, UpdateMediaInput } from '@/types/media';
import {
    File02Icon,
    InformationCircleIcon,
    MusicNote01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * Drops a trailing file extension ("hero-shot.jpg" -> "hero-shot") so the
 * filename fallbacks read as names. Only strips a short alphanumeric tail, so
 * a dotted name like "v1.2 hero" survives intact.
 */
const stripExtension = (name: string) => name.replace(/\.[a-z0-9]{1,5}$/i, '');

interface MediaViewerProps {
    item: MediaItem;
    onClose: () => void;
    /** Navigate to the previous gallery item; undefined at the start. */
    onPrev?: () => void;
    /** Navigate to the next gallery item; undefined at the end. */
    onNext?: () => void;
    /** Delete this item (parent closes the viewer and runs its confirm flow). */
    onDelete?: () => void;
}

/**
 * Full-screen view-only preview: header (name + actions), then a split body -
 * the image contained in the left pane, a details sidebar (alt text, caption,
 * file specs) on the right. Stacks vertically on small screens.
 */
export default function MediaViewer({
    item,
    onClose,
    onPrev,
    onNext,
    onDelete,
}: MediaViewerProps) {
    const kind = getMediaKind(item);
    const displayName =
        item.title || item.fileName || item.originalName || item.publicId;
    // Top-bar heading - a human-readable name only: the title as typed, or a
    // filename with its extension stripped, falling back to "Untitled". The raw
    // Cloudinary publicId is an internal storage key and never surfaces here;
    // `displayName` keeps it only as the alt-text / download-filename fallback,
    // where the extension is wanted.
    const sidebarName =
        item.title ||
        stripExtension(item.fileName || item.originalName || '') ||
        'Untitled';
    const updateMutation = useUpdateMedia();

    // Editable form state - seeded from the item, reseeded on prev/next
    const seedForm = (it: MediaItem) => ({
        title: it.title ?? '',
        description: it.description ?? '',
        altText: it.altText ?? '',
        fileName: it.fileName ?? it.originalName ?? '',
        excludeFromIndexing: it.excludeFromIndexing ?? false,
    });
    const [form, setForm] = useState(() => seedForm(item));
    useEffect(() => {
        setForm(seedForm(item));
    }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // No auto-save: while the form differs from the stored item the Download
    // button becomes Save; after a successful save the cache-refreshed item
    // matches the form again and the button reverts to Download.
    const saved = seedForm(item);
    const isDirty =
        form.title.trim() !== saved.title.trim() ||
        form.description.trim() !== saved.description.trim() ||
        form.altText.trim() !== saved.altText.trim() ||
        form.fileName.trim() !== saved.fileName.trim() ||
        form.excludeFromIndexing !== saved.excludeFromIndexing;

    function handleSave() {
        const dto: UpdateMediaInput = {
            title: form.title.trim(),
            description: form.description.trim(),
            altText: form.altText.trim(),
            fileName: form.fileName.trim(),
            excludeFromIndexing: form.excludeFromIndexing,
        };
        // Keep local state trimmed so it matches the server-normalized item
        setForm(f => ({
            ...f,
            title: dto.title!,
            description: dto.description!,
            altText: dto.altText!,
            fileName: dto.fileName!,
        }));
        updateMutation.mutate({ id: item.id, dto });
    }

    // Keyboard navigation: arrows step through the gallery, Escape closes
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') onPrev?.();
            if (e.key === 'ArrowRight') onNext?.();
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onPrev, onNext, onClose]);

    const dimensions =
        item.width && item.height ? `${item.width} × ${item.height}px` : null;
    const uploadedAt = item.uploadedAt
        ? new Date(item.uploadedAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
          })
        : null;

    // Rendered IN FLOW by the gallery in place of the grid (no portal, no
    // fixed) so the top bar and left sidebar stay visible. The negative
    // margins cancel the shell's content paddings (`p-4` wrapper, `lg:p-8`
    // page enter layer) so the viewer runs edge to edge in the pane, and the
    // height pins it to the viewport: 100dvh minus the site header (and the
    // pane's m-2 gutter on md+), so the details sidebar scrolls internally on
    // any screen height instead of pushing the page.
    return (
        <div className='relative -m-4 lg:-m-12 flex h-[calc(100dvh-var(--header-height))] md:h-[calc(100dvh-var(--header-height)-16px)] flex-col bg-background overflow-hidden animate-in fade-in duration-200'>
            {/* Header - media name on the left, prev/next/close pinned to the
                far right edge of the screen */}
            <div className='flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-border bg-card shrink-0 z-50'>
                {/* Always occupies the left half (even when unnamed) so the actions
                    stay pinned right instead of sliding over */}
                <h2 className='m-0 min-w-0 flex-1 truncate text-sm font-medium text-foreground'>
                    {sidebarName}
                </h2>

                <div className='flex items-center gap-1.5 md:gap-2 shrink-0 ml-2'>
                    <Button
                        variant='outline'
                        size='sm'
                        onClick={onPrev}
                        disabled={!onPrev}
                        className='h-8 md:h-9 px-3 md:px-4 text-xs md:text-sm'>
                        Previous
                    </Button>

                    <Button
                        variant='outline'
                        size='sm'
                        onClick={onNext}
                        disabled={!onNext}
                        className='h-8 md:h-9 px-3 md:px-4 text-xs md:text-sm'>
                        Next
                    </Button>

                    <div aria-hidden className='mx-1 h-5 w-px bg-border' />

                    <Button
                        variant='ghost'
                        size='sm'
                        onClick={onClose}
                        className='h-8 md:h-9 px-3 md:px-4 text-xs md:text-sm text-muted-foreground hover:text-foreground'>
                        Close
                    </Button>
                </div>
            </div>

            {/* Body - image pane + details sidebar. Mobile: one scrolling
                column with a fixed-height preview (the long form was squeezing
                the image to a thumbnail). Desktop: side-by-side, sidebar
                scrolls internally. */}
            <div className='flex-1 min-h-0 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden'>
                {/* Image pane */}
                <div className='relative shrink-0 h-[45dvh] md:h-auto md:shrink md:flex-1 md:min-h-0 bg-muted/40 flex items-center justify-center p-4 md:p-8'>
                    {kind === 'image' ? (
                        /* Intrinsic sizing: the image keeps its natural aspect ratio,
               scales DOWN to fit the pane, and never upscales past its
               natural pixel size (w-auto/h-auto + max caps). */
                        <Image
                            src={item.url}
                            width={item.width || 1600}
                            height={item.height || 1200}
                            alt={item.altText || displayName}
                            className='h-auto w-auto max-h-full max-w-full rounded-md object-contain'
                            priority
                            sizes='(min-width: 768px) 75vw, 100vw'
                        />
                    ) : kind === 'svg' ? (
                        /* Vectors have no meaningful natural size - cap the preview so a
               small logo is not blown up to fill the pane. */
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                            src={item.url}
                            alt={item.altText || displayName}
                            className='max-h-60 max-w-60 object-contain md:max-h-100 md:max-w-100'
                        />
                    ) : kind === 'video' ? (
                        <video
                            src={item.url}
                            controls
                            playsInline
                            preload='metadata'
                            aria-label={displayName}
                            className='max-w-full max-h-full rounded-lg shadow'
                        />
                    ) : kind === 'audio' ? (
                        <div className='flex flex-col items-center justify-center gap-6 p-8 md:p-12 bg-card rounded-xl shadow border border-border max-w-md w-full'>
                            <HugeiconsIcon
                                icon={MusicNote01Icon}
                                size={64}
                                className='text-primary'
                            />
                            <h3 className='m-0 text-sm md:text-base font-medium text-foreground text-center break-all'>
                                {displayName}
                            </h3>
                            <audio
                                src={item.url}
                                controls
                                preload='metadata'
                                aria-label={displayName}
                                className='w-full'
                            />
                        </div>
                    ) : (
                        <div className='flex flex-col items-center justify-center text-center p-8 md:p-12 bg-card rounded-xl shadow border border-border max-w-sm w-full'>
                            <HugeiconsIcon
                                icon={File02Icon}
                                size={64}
                                className='text-muted-foreground mb-4'
                            />
                            <h3 className='text-sm md:text-base font-medium text-foreground mb-1'>
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

                {/* Details sidebar - scrolls with the page on mobile,
                    internally on desktop */}
                <aside className='w-full md:w-80 shrink-0 border-t md:border-t-0 md:border-l border-border bg-card md:overflow-y-auto'>
                    <div className='p-4 space-y-4'>
                        {/* Optional caption only - the name already sits in the top bar,
                            so repeating it here is dead weight */}
                        {item.caption && (
                            <p className='m-0 text-xs leading-relaxed text-muted-foreground'>
                                {item.caption}
                            </p>
                        )}

                        {/* Uploaded line with the (i) hover holding the full file facts
                            (type, size, dimensions) - kept out of the always-on
                            sidebar so it reads as a name, not a storage record */}
                        <div className='space-y-2'>
                            {uploadedAt && (
                                <div className='flex items-center gap-1.5'>
                                    <p className='m-0 text-xs font-medium text-foreground'>
                                        Uploaded on {uploadedAt}
                                    </p>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className='inline-flex text-muted-foreground cursor-help'>
                                                <HugeiconsIcon
                                                    icon={InformationCircleIcon}
                                                    size={14}
                                                />
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent
                                            side='left'
                                            className='max-w-60'>
                                            <div className='space-y-0.5 text-xs'>
                                                <p className='m-0'>
                                                    Uploaded by you
                                                </p>
                                                {(item.originalName ||
                                                    item.fileName) && (
                                                    <p className='m-0'>
                                                        Filename:{' '}
                                                        {item.originalName ||
                                                            item.fileName}
                                                    </p>
                                                )}
                                                {(item.format ||
                                                    item.mimeType) && (
                                                    <p className='m-0'>
                                                        File type:{' '}
                                                        {item.format ||
                                                            item.mimeType}
                                                    </p>
                                                )}
                                                {(item.size ?? item.bytes) !=
                                                    null && (
                                                    <p className='m-0'>
                                                        File size:{' '}
                                                        {formatFileSize(
                                                            (item.size ??
                                                                item.bytes)!
                                                        )}
                                                    </p>
                                                )}
                                                {dimensions && (
                                                    <p className='m-0'>
                                                        Dimensions: {dimensions}
                                                    </p>
                                                )}
                                            </div>
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                            )}
                        </div>

                        {/* Editable attachment details */}
                        <div className='space-y-3 border-t border-border pt-4'>
                            <h4 className='m-0 text-sm font-medium text-foreground'>
                                Attachment details
                            </h4>
                            <Field>
                                <Label htmlFor='media-title'>Title</Label>
                                <Input
                                    id='media-title'
                                    value={form.title}
                                    onChange={e =>
                                        setForm(f => ({
                                            ...f,
                                            title: e.target.value,
                                        }))
                                    }
                                    className='h-9'
                                />
                            </Field>
                            <Field>
                                <Label htmlFor='media-description'>
                                    Description
                                </Label>
                                <Textarea
                                    id='media-description'
                                    value={form.description}
                                    onChange={e =>
                                        setForm(f => ({
                                            ...f,
                                            description: e.target.value,
                                        }))
                                    }
                                    rows={2}
                                />
                            </Field>
                            <Field>
                                <Label htmlFor='media-alt'>Alt Text</Label>
                                <Input
                                    id='media-alt'
                                    value={form.altText}
                                    onChange={e =>
                                        setForm(f => ({
                                            ...f,
                                            altText: e.target.value,
                                        }))
                                    }
                                    className='h-9'
                                />
                            </Field>
                            <Field>
                                <div className='flex items-center gap-1.5'>
                                    <Label htmlFor='media-filename'>
                                        Filename
                                    </Label>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className='inline-flex text-muted-foreground cursor-help'>
                                                <HugeiconsIcon
                                                    icon={InformationCircleIcon}
                                                    size={12}
                                                />
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent
                                            side='left'
                                            className='max-w-56'>
                                            Display name used in the library and
                                            as the download filename. The
                                            original upload name is kept
                                            separately.
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                                <Input
                                    id='media-filename'
                                    value={form.fileName}
                                    onChange={e =>
                                        setForm(f => ({
                                            ...f,
                                            fileName: e.target.value,
                                        }))
                                    }
                                    className='h-9'
                                />
                            </Field>

                            <label className='flex items-center gap-2 cursor-pointer'>
                                <Checkbox
                                    checked={form.excludeFromIndexing}
                                    onCheckedChange={checked =>
                                        setForm(f => ({
                                            ...f,
                                            excludeFromIndexing:
                                                checked === true,
                                        }))
                                    }
                                />
                                <span className='text-sm text-foreground'>
                                    Exclude this attachment from indexing
                                </span>
                            </label>

                            {/* Unsaved changes turn Download into Save; a
                                successful save reverts it to Download. */}
                            <div className='flex items-center gap-2 border-t border-border pt-6'>
                                {isDirty ? (
                                    <Button
                                        size='sm'
                                        onClick={handleSave}
                                        disabled={updateMutation.isPending}
                                        className='h-8 flex-1 px-3 text-xs'>
                                        {updateMutation.isPending
                                            ? 'Saving...'
                                            : 'Save'}
                                    </Button>
                                ) : (
                                    <Link
                                        href={item.url.replace(
                                            '/upload/',
                                            `/upload/fl_attachment:${encodeURIComponent(
                                                (form.fileName || displayName)
                                                    .split('.')
                                                    .slice(0, 1)
                                                    .join('') || 'download'
                                            )}/`
                                        )}
                                        download={form.fileName || displayName}
                                        className='inline-flex flex-1 items-center justify-center h-8 px-3 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-colors'>
                                        Download
                                    </Link>
                                )}
                                {onDelete && (
                                    <Button
                                        variant='outline'
                                        size='sm'
                                        onClick={onDelete}
                                        className='h-8 flex-1 px-3 text-xs text-destructive hover:text-destructive'>
                                        Delete
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}

