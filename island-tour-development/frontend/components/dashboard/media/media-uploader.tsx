'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { MediaItem } from './media-item';

export interface UploadingFile {
    file: File;
    id: string;
    progress: number;
    isValid: boolean;
    error: string | null;
}

interface MediaUploaderProps {
    value?: MediaItem | MediaItem[] | null;
    setMediaItems: React.Dispatch<React.SetStateAction<MediaItem[]>>;
    multiple?: boolean;
    maxFiles?: number;
    maxFileSize?: number;
    folder?: string;
    selector?: boolean;
    setbulkSelectedItems?: React.Dispatch<React.SetStateAction<MediaItem[]>>;
    setIsFormOpen: (open: boolean) => void;
    isFormOpen: boolean;
    bulkSelectedItems?: MediaItem[];
    uploadingFiles: UploadingFile[];
    setUploadingFiles: React.Dispatch<React.SetStateAction<UploadingFile[]>>;
    uploadProgress: Record<string, number>;
    setUploadProgress: React.Dispatch<
        React.SetStateAction<Record<string, number>>
    >;
    previewUrls: Record<string, string>;
    setPreviewUrls: React.Dispatch<
        React.SetStateAction<Record<string, string>>
    >;
}

export const MediaUploader = ({
    value,
    setMediaItems,
    multiple = true,
    maxFiles = 50,
    maxFileSize = 10 * 1024 * 1024, // 10 MB
    folder = 'users/media',
    selector = false,
    setbulkSelectedItems,
    setIsFormOpen,
    isFormOpen,
    bulkSelectedItems,
    uploadingFiles,
    setUploadingFiles,
    uploadProgress,
    setUploadProgress,
    previewUrls,
    setPreviewUrls,
}: MediaUploaderProps) => {
    const [dragActive, setDragActive] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);
    const [fileDialogOpened, setFileDialogOpened] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const isUploading = uploadingFiles.length > 0;

    useEffect(() => {
        if (isFormOpen && !fileDialogOpened) {
            setFileDialogOpened(true);
            inputRef.current?.click();
        }
    }, [isFormOpen, fileDialogOpened]);

    useEffect(() => {
        const handleWindowFocus = () => {
            if (fileDialogOpened && isFormOpen) {
                setTimeout(() => {
                    if (
                        fileDialogOpened &&
                        isFormOpen &&
                        uploadingFiles.length === 0
                    ) {
                        setIsFormOpen(false);
                        setFileDialogOpened(false);
                    }
                }, 500);
            }
        };
        window.addEventListener('focus', handleWindowFocus);
        return () => window.removeEventListener('focus', handleWindowFocus);
    }, [fileDialogOpened, isFormOpen, setIsFormOpen, uploadingFiles.length]);

    const createPreviewUrl = useCallback(
        (file: File, id: string) => {
            if (!previewUrls[id]) {
                const url = URL.createObjectURL(file);
                setPreviewUrls(prev => ({ ...prev, [id]: url }));
                return url;
            }
            return previewUrls[id];
        },
        [previewUrls]
    );

    const cleanupPreviewUrl = useCallback(
        (id: string) => {
            if (previewUrls[id]) {
                URL.revokeObjectURL(previewUrls[id]);
                setPreviewUrls(prev => {
                    const next = { ...prev };
                    delete next[id];
                    return next;
                });
            }
        },
        [previewUrls]
    );

    const formatFileSize = (bytes: number) => {
        if (!bytes) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const validateFiles = (files: FileList | File[]) => {
        const validFiles: File[] = [];
        const invalidFiles: { file: File; error: string }[] = [];

        Array.from(files).forEach(file => {
            if (file.size > maxFileSize) {
                invalidFiles.push({
                    file,
                    error: `File is too large. Max ${formatFileSize(maxFileSize)}.`,
                });
                return;
            }
            if (
                !file.type.startsWith('image/') &&
                !file.type.startsWith('video/')
            ) {
                invalidFiles.push({ file, error: `Unsupported format.` });
                return;
            }
            validFiles.push(file);
        });

        return { validFiles, invalidFiles };
    };

    const uploadFileWithProgress = (file: File, id: string): Promise<any> => {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('files', file);

            const xhr = new XMLHttpRequest();
            const backendUrl =
                process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';

            xhr.open('POST', `${backendUrl}/api/v1/media-gallery/upload`, true);
            xhr.withCredentials = true;

            // Use user-provided simulation logic for momentum
            let momentumProgress = 0;
            const momentumInterval = setInterval(() => {
                momentumProgress += Math.random() * 15;
                if (momentumProgress >= 95) {
                    momentumProgress = 95;
                    // Don't clear yet, as we might still be waiting for server
                }

                setUploadProgress(prev => {
                    const current = prev[id] || 0;
                    // Only update if momentum is ahead of real progress
                    return {
                        ...prev,
                        [id]: Math.max(current, Math.min(momentumProgress, 95)),
                    };
                });

                if (momentumProgress >= 95) clearInterval(momentumInterval);
            }, 200);

            xhr.upload.onprogress = event => {
                if (event.lengthComputable) {
                    const realProgress = (event.loaded / event.total) * 100;
                    // Cap real progress at 98% until server responds
                    const cappedReal = Math.min(98, realProgress);
                    setUploadProgress(prev => {
                        const current = prev[id] || 0;
                        return { ...prev, [id]: Math.max(current, cappedReal) };
                    });
                }
            };

            xhr.onload = () => {
                clearInterval(momentumInterval);
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } catch (e) {
                        resolve(xhr.responseText);
                    }
                } else {
                    try {
                        const errorData = JSON.parse(xhr.responseText);
                        reject(new Error(errorData.message || 'Upload failed'));
                    } catch (e) {
                        reject(new Error('Upload failed'));
                    }
                }
            };

            xhr.onerror = () => {
                clearInterval(momentumInterval);
                reject(new Error('Network error'));
            };

            xhr.send(formData);
        });
    };

    const removeUploadingFile = (fileId: string) => {
        cleanupPreviewUrl(fileId);
        setUploadingFiles(prev => prev.filter(({ id }) => id !== fileId));
        setUploadProgress(prev => {
            const next = { ...prev };
            delete next[fileId];
            return next;
        });
    };

    const handleFiles = async (files: FileList | File[]) => {
        const currentImages = Array.isArray(value)
            ? value
            : value
              ? [value]
              : [];
        const { validFiles, invalidFiles } = validateFiles(files);

        const allFileObjects: UploadingFile[] = [
            ...validFiles.map(file => ({
                file,
                id: `upload-${file.name}-${Date.now()}-${Math.random()}`,
                progress: 0,
                isValid: true,
                error: null,
            })),
            ...invalidFiles.map(({ file, error }) => ({
                file,
                id: `invalid-${file.name}-${Date.now()}-${Math.random()}`,
                progress: 0,
                isValid: false,
                error,
            })),
        ];

        allFileObjects.forEach(({ file, id }) => {
            if (file.type.startsWith('image/')) createPreviewUrl(file, id);
        });

        setUploadingFiles(prev => [...prev, ...allFileObjects]);

        if (validFiles.length === 0) return;

        const filesToProcess = validFiles.slice(
            0,
            maxFiles - currentImages.length
        );
        if (filesToProcess.length === 0) {
            toast.warning(`Maximum ${maxFiles} images allowed`);
            return;
        }

        setErrors([]);

        const validFileObjects = allFileObjects.filter(
            obj => obj.isValid && filesToProcess.includes(obj.file)
        );

        try {
            // Upload files in parallel (individually to track real progress per file)
            const uploadPromises = validFileObjects.map(obj =>
                uploadFileWithProgress(obj.file, obj.id)
            );

            const results = await Promise.allSettled(uploadPromises);

            const succeededMedia: MediaItem[] = [];
            const failedNames: string[] = [];

            results.forEach((res, index) => {
                if (res.status === 'fulfilled') {
                    // Backend returns MediaGallery[] (usually of size 1 if we send 1 file)
                    const data = Array.isArray(res.value) ? res.value : [];
                    succeededMedia.push(...data);
                    // Jump to 100 only after server confirms success
                    setUploadProgress(prev => ({
                        ...prev,
                        [validFileObjects[index].id]: 100,
                    }));
                } else {
                    failedNames.push(validFileObjects[index].file.name);
                }
            });

            // Small delay to let user see "100%" then swap
            setTimeout(() => {
                const finishedIds = validFileObjects.map(obj => obj.id);

                // 1. Cleanup preview URLs
                finishedIds.forEach(id => cleanupPreviewUrl(id));

                // 2. Batch remove from uploading state
                setUploadingFiles(prev =>
                    prev.filter(f => !finishedIds.includes(f.id))
                );
                setUploadProgress(prev => {
                    const next = { ...prev };
                    finishedIds.forEach(id => delete next[id]);
                    return next;
                });

                // 3. Add real items to the list
                setMediaItems(prev => [...succeededMedia, ...prev]);

                if (selector && setbulkSelectedItems) {
                    if (multiple) {
                        setbulkSelectedItems(prev => [
                            ...(prev || []),
                            ...succeededMedia,
                        ]);
                    } else if (succeededMedia.length > 0) {
                        setbulkSelectedItems([succeededMedia[0]]);
                    }
                }

                if (succeededMedia.length > 0) {
                    toast.success(
                        `Successfully uploaded ${succeededMedia.length} file(s)`
                    );
                }
                if (failedNames.length > 0) {
                    toast.error(`Failed to upload: ${failedNames.join(', ')}`);
                }
            }, 500);

            setTimeout(() => setIsFormOpen(false), 1500);
        } catch (err: any) {
            setErrors(prev => [...prev, err.message]);
            toast.error(err.message || 'Upload failed');
            validFileObjects.forEach(({ id }) => cleanupPreviewUrl(id));
        }
    };

    return (
        <div className='hidden'>
            <input
                type='file'
                accept='image/*,video/mp4,video/quicktime'
                multiple={multiple}
                ref={inputRef}
                onChange={e => {
                    if (e.target.files?.length) handleFiles(e.target.files);
                    e.target.value = '';
                }}
                className='hidden'
            />
        </div>
    );
};

export default MediaUploader;

