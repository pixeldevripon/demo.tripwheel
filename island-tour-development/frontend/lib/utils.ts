import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Normalize a string to an English slug - kept in sync with the backend
 * `generateSlug` util and the dashboard form `toSlug` (NFD strip, lowercase,
 * hyphenate, collapse, trim). Used to build flat tour URLs from mock titles
 * until the public tour list API returns real slugs.
 */
export function toSlug(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function formatFileSize(bytes: number | null | undefined): string {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDate(
    dateString: string | Date | null | undefined,
    style: 'short' | 'medium' | 'long' = 'medium'
): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';

    const options: Intl.DateTimeFormatOptions =
        style === 'short'
            ? { month: 'short', day: 'numeric' }
            : style === 'long'
              ? { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }
              : { year: 'numeric', month: 'short', day: 'numeric' };

    return new Intl.DateTimeFormat('en-US', options).format(date);
}

