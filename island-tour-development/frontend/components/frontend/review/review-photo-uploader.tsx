'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { MotionButton } from '../motion-primitives';
import { springPop } from '@/lib/motion';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { enrichReview, uploadReviewPhotos } from '@/lib/api/review-submit';

type Dict = Dictionary['reviewSubmit'];

/** Mirrors MAX_REVIEW_PHOTOS on the backend, which is the real enforcement. */
export const MAX_PHOTOS = 8;

/** Mirrors the multipart interceptor's per-file ceiling. */
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * A tile still on its way up.
 *
 * `preview` is a local object URL, so the guest sees THEIR photo the instant they
 * pick it rather than a grey box for however long the upload takes. That is the
 * whole point of the pending state: on a hotel wifi a 6 MB phone photo is a long
 * wait, and a spinner with no picture behind it reads as "did that work?".
 */
type Pending = { id: string; name: string; preview: string };

let pendingSeq = 0;

/**
 * Step 3 - photo upload.
 *
 * ## Optimistic tiles, authoritative result
 * Pending tiles are rendered from local files, but the moment the request
 * returns, state is replaced wholesale by the server's `photos` array - never
 * merged. What is drawn is then what is actually stored, so a partially failed
 * batch cannot leave a thumbnail on screen for a photo that does not exist.
 *
 * ## Rejected before the network, not by it
 * Type and size are checked here as well as on the server. The server check is
 * the one that counts, but letting a 20 MB video reach it means a long upload
 * that ends in a 400 - the guest gets the same "no" several minutes later.
 */
export function ReviewPhotoUploader({
    token,
    photos,
    onChange,
    dict,
}: {
    token: string;
    photos: string[];
    onChange: (photos: string[]) => void;
    dict: Dict;
}) {
    const [pending, setPending] = useState<Pending[]>([]);
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [removing, setRemoving] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Object URLs are a leak if they outlive their tile - the browser holds the
    // whole file in memory until each one is revoked.
    useEffect(() => {
        return () => {
            for (const p of pending) URL.revokeObjectURL(p.preview);
        };
    }, [pending]);

    const room = MAX_PHOTOS - photos.length - pending.length;
    const full = room <= 0;

    async function accept(list: FileList | File[] | null) {
        if (!list) return;
        setError(null);

        const files: File[] = [];
        for (const file of Array.from(list)) {
            if (!file.type.startsWith('image/')) {
                setError(dict.photoNotImage);
                continue;
            }
            if (file.size > MAX_BYTES) {
                setError(dict.photoTooLarge);
                continue;
            }
            files.push(file);
        }
        if (files.length === 0) return;

        // Silently dropping the overflow would look like a failed upload, so say so.
        const taken = files.slice(0, Math.max(room, 0));
        if (taken.length < files.length) setError(dict.photoLimit);
        if (taken.length === 0) return;

        const batch: Pending[] = taken.map(file => ({
            id: `p${++pendingSeq}`,
            name: file.name,
            preview: URL.createObjectURL(file),
        }));
        setPending(prev => [...prev, ...batch]);

        try {
            const res = await uploadReviewPhotos(token, taken);
            onChange(res.photos);
        } catch (err) {
            setError(err instanceof Error ? err.message : dict.error);
        } finally {
            const ids = new Set(batch.map(b => b.id));
            for (const b of batch) URL.revokeObjectURL(b.preview);
            setPending(prev => prev.filter(p => !ids.has(p.id)));
        }
    }

    /**
     * Remove one photo.
     *
     * A wrong photo attached by accident is the same problem as a mistapped
     * star: the flow commits eagerly, so it has to be undoable. Sends the
     * REMAINING list, which the backend accepts only as a subset of what is
     * already attached - so this can never be used to attach something else.
     */
    async function remove(src: string) {
        if (removing) return;
        setRemoving(src);
        setError(null);
        const next = photos.filter(p => p !== src);
        try {
            await enrichReview(token, { photos: next });
            onChange(next);
        } catch (err) {
            setError(err instanceof Error ? err.message : dict.error);
        } finally {
            setRemoving(null);
        }
    }

    return (
        <div className='flex flex-col gap-2'>
            <div className='flex flex-wrap items-start gap-3'>
                {photos.map(src => (
                    <div
                        key={src}
                        className='group relative size-20 overflow-hidden rounded-[10px] bg-it-border'>
                        <Image
                            src={src}
                            alt=''
                            fill
                            sizes='80px'
                            className={`object-cover transition-opacity ${
                                removing === src ? 'opacity-40' : 'opacity-100'
                            }`}
                        />
                        <MotionButton
                            type='button'
                            onClick={() => void remove(src)}
                            disabled={removing !== null}
                            aria-label={dict.photoRemove}
                            whileTap={{ scale: 0.9 }}
                            transition={springPop}
                            className='absolute right-1 top-1 flex size-6 items-center justify-center rounded-it-full bg-it-heading/70 text-[15px] leading-none text-it-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100'>
                            &times;
                        </MotionButton>
                    </div>
                ))}

                {/* Pending: the guest's own photo behind a pulsing veil, so the
                    wait is legible as "this one, uploading" not "something". */}
                {pending.map(p => (
                    <div
                        key={p.id}
                        title={p.name}
                        className='relative size-20 overflow-hidden rounded-[10px] bg-it-border'>
                        {/* Local blob URL - next/image would try to optimise it. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={p.preview}
                            alt=''
                            className='size-full object-cover opacity-40'
                        />
                        <div className='absolute inset-0 animate-pulse bg-it-white/30' />
                        <div className='absolute inset-0 flex items-center justify-center'>
                            <span className='size-5 animate-spin rounded-it-full border-2 border-it-white/70 border-t-transparent' />
                        </div>
                    </div>
                ))}

                {!full && (
                    <label
                        onDragOver={e => {
                            e.preventDefault();
                            setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={e => {
                            e.preventDefault();
                            setDragging(false);
                            void accept(e.dataTransfer.files);
                        }}
                        className={`flex size-20 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed text-center text-[11px] leading-[1.25] tracking-[-0.012em] transition-colors ${
                            dragging
                                ? 'border-it-primary bg-it-primary/5 text-it-primary'
                                : 'border-it-border text-it-text-muted hover:border-it-primary hover:text-it-primary'
                        }`}>
                        <input
                            ref={inputRef}
                            type='file'
                            accept='image/*'
                            multiple
                            onChange={e => {
                                void accept(e.target.files);
                                // Reset, or re-picking the same file is a no-op.
                                e.target.value = '';
                            }}
                            className='sr-only'
                        />
                        <span aria-hidden className='text-[18px] leading-none'>
                            +
                        </span>
                        {dict.photoAdd}
                    </label>
                )}
            </div>

            <p
                className='m-0 text-[13px] leading-[1.4] tracking-[-0.012em] text-it-text-muted'
                aria-live='polite'>
                {error ??
                    dict.photoCounter
                        .replace('{n}', String(photos.length))
                        .replace('{max}', String(MAX_PHOTOS))}
            </p>
        </div>
    );
}
