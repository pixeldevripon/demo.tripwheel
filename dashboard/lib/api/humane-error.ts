/**
 * The single place technical API failures become words a user can act on.
 *
 * Pure module (no fetch, no React, no client APIs) so both the browser client
 * (`lib/api/fetch.ts`) and server actions (`app/_actions/*`) share one
 * mapping. The contract: whatever this returns is safe to toast verbatim -
 * raw technical text ("Internal server error", ThrottlerException, unbounded
 * validation dumps) must never leave here.
 */

export const NETWORK_MESSAGE =
    "Can't reach the server. Check your internet connection and try again.";
export const SERVER_MESSAGE =
    'Something went wrong on our end. Try again in a moment - if it keeps happening, contact support.';
export const THROTTLE_MESSAGE =
    'Too many requests in a row - wait a moment and try again.';
export const SESSION_MESSAGE =
    'Your session has expired - sign in again to continue.';

// Validation errors (Nest ValidationPipe) arrive as one line per failed DTO
// rule. Three is enough to act on; a 20-line dump is not a toast.
const MAX_VALIDATION_LINES = 3;

/**
 * The error every failed API call throws. `message` is always human-readable
 * (toast it verbatim); `status` is the HTTP status (0 = never reached the
 * server); `body` is the raw backend error body when one was parseable.
 */
export class ApiError extends Error {
    readonly status: number;
    readonly body: unknown;

    constructor(message: string, status: number, body?: unknown) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.body = body;
    }
}

/**
 * Map a failed response to the message a user should read.
 *
 * 4xx business messages written by the backend pass through verbatim - that
 * copy is deliberate ("Operator still has 3 live tours...") and this layer
 * must not flatten it. Everything technical or absent gets rewritten.
 */
export function humaneMessage(status: number, body: unknown): string {
    const raw = (body as { message?: unknown } | null | undefined)?.message;
    const text = typeof raw === 'string' ? raw.trim() : '';

    // Never surface server internals. But a 5xx is not automatically
    // meaningless: the backend deliberately answers 502/503 with real copy
    // ("The AI provider rejected the API key..."), and that must reach the
    // user. Only the bare framework fallback gets rewritten.
    if (status >= 500) {
        return text && !/^internal server error$/i.test(text)
            ? text
            : SERVER_MESSAGE;
    }

    if (status === 429 || /throttl|too many requests/i.test(text)) {
        return THROTTLE_MESSAGE;
    }

    if (Array.isArray(raw)) {
        const lines = raw.filter(
            (line): line is string =>
                typeof line === 'string' && line.trim() !== '',
        );
        if (lines.length > 0) {
            const shown = lines.slice(0, MAX_VALIDATION_LINES).join('; ');
            const extra = lines.length - MAX_VALIDATION_LINES;
            return extra > 0 ? `${shown} (+${extra} more)` : shown;
        }
    }

    // Bare framework defaults ("Unauthorized", "Forbidden") tell the user
    // nothing; a backend that wrote real copy for these statuses keeps it.
    if (status === 401) {
        return text && !/^unauthorized\b/i.test(text) ? text : SESSION_MESSAGE;
    }
    if (status === 403) {
        return text && !/^forbidden\b/i.test(text)
            ? text
            : "You don't have permission to do that.";
    }

    if (text) return text;

    if (status === 404) {
        return 'That record could not be found - it may have been deleted in the meantime.';
    }
    return `The request failed (HTTP ${status}). Try again.`;
}
