import type { MediaItem } from '@/types/media';

/**
 * Audio containers - Cloudinary stores audio under resourceType 'video',
 * so format/mimeType are the only reliable signals. Mirrors the backend
 * AUDIO_FORMATS set in cloudinary.service.ts.
 */
const AUDIO_FORMATS = new Set([
    'mp3',
    'wav',
    'ogg',
    'aac',
    'm4a',
    'flac',
    'opus',
    'weba',
    'aiff',
    'amr',
]);

export type MediaKind = 'image' | 'svg' | 'video' | 'audio' | 'file';

/** Classify a media item for rendering (thumbnail + preview components). */
export function getMediaKind(item: MediaItem): MediaKind {
    const mime = item.mimeType ?? '';
    const fmt = (item.format ?? '').toLowerCase();
    if (mime === 'image/svg+xml' || fmt === 'svg') return 'svg';
    if (mime.startsWith('audio/') || AUDIO_FORMATS.has(fmt)) return 'audio';
    if (mime.startsWith('video/') || item.resourceType === 'video')
        return 'video';
    if (mime.startsWith('image/') || item.resourceType === 'image')
        return 'image';
    return 'file';
}

/** Short uppercase label shown on non-image tiles (e.g. MP4, MP3, SVG). */
export function getMediaBadge(item: MediaItem): string | null {
    const kind = getMediaKind(item);
    if (kind === 'image' || kind === 'file') return null;
    return (item.format ?? kind).toUpperCase();
}
