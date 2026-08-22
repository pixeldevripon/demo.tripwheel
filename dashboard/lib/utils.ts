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

/**
 * Turn a stored enum token into something a human can read:
 * `PARTIALLY_REFUNDED` -> `Partially refunded`, `ultra_luxury` -> `Ultra luxury`.
 *
 * For DISPLAY only - the underlying value is always stored and submitted raw.
 * Anywhere a token reaches the screen unconverted it reads as leaked internals
 * (test report 2026-08-01 filed the tour attribute selects as exactly that).
 * Deliberately not per-token copy: attribute values are admin-defined at
 * runtime, so there is no dictionary to look them up in - only a consistent
 * mechanical transform.
 */
export function humanizeEnumValue(value: string): string {
    const s = value.replace(/_/g, ' ').toLowerCase().trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
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

