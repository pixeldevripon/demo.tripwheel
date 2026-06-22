/**
 * useUploadStore (Zustand)
 *
 * Holds all in-progress upload state OUTSIDE React's component tree.
 * This means uploads survive:
 *  - Navigating away from the media tab and returning
 *  - Browser tab switching
 *  - Component unmount/remount cycles
 *
 * XHR refs are stored in a plain Map (not part of the Zustand state
 * slice so they don't cause re-renders) and are used for abort on cancel.
 */

import { create } from 'zustand';

/* ─── Types ──────────────────────────────────────────────────────────────── */

export interface UploadingFile {
    file: File;
    id: string;
    progress: number;
    isValid: boolean;
    error: string | null;
}

interface UploadState {
    uploadingFiles: UploadingFile[];
    uploadProgress: Record<string, number>;
    previewUrls: Record<string, string>;
}

interface UploadActions {
    /** Register a batch of files (valid + invalid) so progress cards appear instantly */
    addFiles: (files: UploadingFile[]) => void;
    /** Set a local blob preview URL for an uploading entry */
    setPreviewUrl: (id: string, url: string) => void;
    /** Update the numeric progress (0–100) for a single file */
    setProgress: (id: string, progress: number) => void;
    /** Remove an entry and revoke its preview blob URL */
    removeFile: (id: string) => void;
    /** Batch-remove finished entries after a success delay */
    removeFiles: (ids: string[]) => void;
    /** Abort an in-progress XHR and clean up its entry */
    cancelUpload: (id: string) => void;
    /** Clear everything (e.g. on logout) */
    reset: () => void;
}

export type UploadStore = UploadState & UploadActions;

/* ─── XHR ref map (lives outside Zustand - no re-render needed) ───────────── */

export const xhrMap = new Map<string, XMLHttpRequest>();

/* ─── Store ──────────────────────────────────────────────────────────────── */

const initialState: UploadState = {
    uploadingFiles: [],
    uploadProgress: {},
    previewUrls: {},
};

export const useUploadStore = create<UploadStore>()((set) => ({
    ...initialState,

    addFiles: (files) =>
        set((state) => ({
            uploadingFiles: [...state.uploadingFiles, ...files],
        })),

    setPreviewUrl: (id, url) =>
        set((state) => ({
            previewUrls: { ...state.previewUrls, [id]: url },
        })),

    setProgress: (id, progress) =>
        set((state) => ({
            uploadProgress: { ...state.uploadProgress, [id]: progress },
        })),

    removeFile: (id) =>
        set((state) => {
            // Revoke blob URL to avoid memory leaks
            if (state.previewUrls[id]) {
                URL.revokeObjectURL(state.previewUrls[id]);
            }
            const previewUrls = { ...state.previewUrls };
            delete previewUrls[id];

            const uploadProgress = { ...state.uploadProgress };
            delete uploadProgress[id];

            xhrMap.delete(id);

            return {
                uploadingFiles: state.uploadingFiles.filter((f) => f.id !== id),
                uploadProgress,
                previewUrls,
            };
        }),

    removeFiles: (ids) =>
        set((state) => {
            const idSet = new Set(ids);

            // Revoke all blob URLs
            ids.forEach((id) => {
                if (state.previewUrls[id]) {
                    URL.revokeObjectURL(state.previewUrls[id]);
                }
                xhrMap.delete(id);
            });

            const previewUrls = Object.fromEntries(
                Object.entries(state.previewUrls).filter(([k]) => !idSet.has(k))
            );
            const uploadProgress = Object.fromEntries(
                Object.entries(state.uploadProgress).filter(([k]) => !idSet.has(k))
            );

            return {
                uploadingFiles: state.uploadingFiles.filter((f) => !idSet.has(f.id)),
                uploadProgress,
                previewUrls,
            };
        }),

    cancelUpload: (id) => {
        // Abort the live XHR - this triggers xhr.onabort which does further cleanup
        const xhr = xhrMap.get(id);
        xhr?.abort();

        // Cleanup store state immediately (onabort may not fire synchronously)
        set((state) => {
            if (state.previewUrls[id]) URL.revokeObjectURL(state.previewUrls[id]);

            const previewUrls = { ...state.previewUrls };
            delete previewUrls[id];
            const uploadProgress = { ...state.uploadProgress };
            delete uploadProgress[id];
            xhrMap.delete(id);

            return {
                uploadingFiles: state.uploadingFiles.filter((f) => f.id !== id),
                uploadProgress,
                previewUrls,
            };
        });
    },

    reset: () => {
        // Abort all pending XHR requests
        xhrMap.forEach((xhr) => xhr.abort());
        xhrMap.clear();
        set(initialState);
    },
}));
