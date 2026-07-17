'use client';

import { useUploadStore, xhrMap, type UploadingFile } from '@/lib/stores/use-upload-store';
import { useCallback, useEffect, useRef } from 'react';
import type { MediaItem } from '@/types/media';

// Re-export so existing imports from this file still compile
export type { UploadingFile };

interface MediaUploaderProps {
    multiple?: boolean;
    maxFiles?: number;
    maxFileSize?: number;
    folder?: string;
    selector?: boolean;
    setbulkSelectedItems?: React.Dispatch<React.SetStateAction<MediaItem[]>>;
    setIsFormOpen: (open: boolean) => void;
    isFormOpen: boolean;
    bulkSelectedItems?: MediaItem[];
    /** Called with successfully uploaded items so parent can update the cache */
    onUploadSuccess: (items: MediaItem[]) => void;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';

export const MediaUploader = ({
    multiple = true,
    maxFiles = 50,
    maxFileSize = 10 * 1024 * 1024,
    selector = false,
    setbulkSelectedItems,
    setIsFormOpen,
    isFormOpen,
    bulkSelectedItems,
    onUploadSuccess,
}: MediaUploaderProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    // Use a ref (not state) so we don't cause extra renders and the value
    // is always current inside event listeners.
    const dialogOpenRef = useRef(false);

    const { addFiles, setPreviewUrl, setProgress, removeFiles } = useUploadStore();

    /* ── Open the native file picker when isFormOpen flips to true ── */
    useEffect(() => {
        if (isFormOpen && !dialogOpenRef.current) {
            dialogOpenRef.current = true;
            // Small delay so the browser finishes the state-update paint cycle
            const t = setTimeout(() => inputRef.current?.click(), 50);
            return () => clearTimeout(t);
        }
        if (!isFormOpen) {
            dialogOpenRef.current = false;
        }
    }, [isFormOpen]);

    /* ── Detect "user cancelled file dialog" via window focus ── */
    useEffect(() => {
        const onFocus = () => {
            if (!dialogOpenRef.current) return;
            // Give onChange 400 ms to fire first (fires if files were selected)
            const t = setTimeout(() => {
                if (dialogOpenRef.current) {
                    dialogOpenRef.current = false;
                    setIsFormOpen(false);
                }
            }, 400);
            return () => clearTimeout(t);
        };
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [setIsFormOpen]);

    /* ── Helpers ── */
    const formatSize = (bytes: number) => {
        const k = 1024;
        const s = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${s[i]}`;
    };

    const validateFiles = (files: FileList | File[]) => {
        const valid: File[] = [];
        const invalid: { file: File; error: string }[] = [];
        Array.from(files).forEach(f => {
            if (f.size > maxFileSize) {
                invalid.push({ file: f, error: `Too large (max ${formatSize(maxFileSize)})` });
            } else if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) {
                invalid.push({ file: f, error: 'Unsupported format' });
            } else {
                valid.push(f);
            }
        });
        return { valid, invalid };
    };

    /* ── XHR upload for a single file - progress tracked in Zustand ── */
    const uploadOne = useCallback(
        (file: File, id: string): Promise<any> =>
            new Promise((resolve, reject) => {
                const fd = new FormData();
                fd.append('files', file);

                const xhr = new XMLHttpRequest();
                xhrMap.set(id, xhr); // stored in module-level Map for abort support

                xhr.open('POST', `${BACKEND_URL}/api/v1/media-gallery/upload`, true);
                xhr.withCredentials = true;

                // Momentum progress simulation
                let momentum = 0;
                const timer = setInterval(() => {
                    momentum = Math.min(95, momentum + Math.random() * 15);
                    setProgress(id, Math.min(momentum, 95));
                    if (momentum >= 95) clearInterval(timer);
                }, 200);

                xhr.upload.onprogress = e => {
                    if (e.lengthComputable) {
                        clearInterval(timer);
                        const real = Math.min(98, (e.loaded / e.total) * 100);
                        setProgress(id, real);
                    }
                };

                xhr.onload = () => {
                    clearInterval(timer);
                    xhrMap.delete(id);
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try { resolve(JSON.parse(xhr.responseText)); }
                        catch { resolve(xhr.responseText); }
                    } else {
                        try { reject(new Error(JSON.parse(xhr.responseText).message || 'Upload failed')); }
                        catch { reject(new Error(`Upload failed (${xhr.status})`)); }
                    }
                };

                xhr.onerror = () => { clearInterval(timer); xhrMap.delete(id); reject(new Error('Network error')); };
                xhr.onabort = () => { clearInterval(timer); xhrMap.delete(id); reject(new Error('Cancelled')); };

                xhr.send(fd);
            }),
        [setProgress]
    );

    /* ── Main handler ── */
    const handleFiles = useCallback(
        async (files: FileList | File[]) => {
            const { valid, invalid } = validateFiles(files);
            const currentCount = (bulkSelectedItems ?? []).length;
            const toProcess = valid.slice(0, Math.max(0, maxFiles - currentCount));

            // Register all entries immediately so progress cards appear at once
            const entries: UploadingFile[] = [
                ...toProcess.map(f => ({
                    file: f,
                    id: `upload-${f.name}-${Date.now()}-${Math.random()}`,
                    progress: 0,
                    isValid: true,
                    error: null,
                })),
                ...invalid.map(({ file, error }) => ({
                    file,
                    id: `invalid-${file.name}-${Date.now()}`,
                    progress: 0,
                    isValid: false,
                    error,
                })),
            ];

            // Create blob preview URLs immediately
            entries.forEach(({ file, id, isValid }) => {
                if (isValid && file.type.startsWith('image/')) {
                    setPreviewUrl(id, URL.createObjectURL(file));
                }
            });

            addFiles(entries);

            const validEntries = entries.filter(e => e.isValid);
            if (validEntries.length === 0) return;

            // Upload all valid files in parallel
            const results = await Promise.allSettled(
                validEntries.map(e => uploadOne(e.file, e.id))
            );

            const succeeded: MediaItem[] = [];
            const failedNames: string[] = [];

            results.forEach((res, i) => {
                if (res.status === 'fulfilled') {
                    const data = Array.isArray(res.value) ? res.value : [];
                    succeeded.push(...data);
                    setProgress(validEntries[i].id, 100);
                } else {
                    failedNames.push(validEntries[i].file.name);
                }
            });

            // Brief pause to show 100%, then clean up progress cards
            setTimeout(() => {
                removeFiles(validEntries.map(e => e.id));

                if (succeeded.length > 0) {
                    onUploadSuccess(succeeded);

                    if (selector && setbulkSelectedItems) {
                        if (multiple) {
                            setbulkSelectedItems(prev => [...(prev ?? []), ...succeeded]);
                        } else {
                            setbulkSelectedItems([succeeded[0]]);
                        }
                    }
                }
            }, 600);

            setTimeout(() => setIsFormOpen(false), 1200);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [maxFiles, multiple, selector, bulkSelectedItems, onUploadSuccess, setbulkSelectedItems, setIsFormOpen, uploadOne, addFiles, setPreviewUrl, removeFiles]
    );

    return (
        <div className='hidden'>
            <input
                type='file'
                aria-label='Upload media files'
                accept='image/*,video/mp4,video/quicktime'
                multiple={multiple}
                ref={inputRef}
                onChange={e => {
                    // Cancel the focus-based dialog-close since onChange fired
                    dialogOpenRef.current = false;
                    if (e.target.files?.length) handleFiles(e.target.files);
                    e.target.value = '';
                }}
                className='hidden'
            />
        </div>
    );
};

export default MediaUploader;
