import type { Instrumentation } from 'next';

import { recordServerError } from '@/lib/debug/server-error-log';

/**
 * Server-side error capture for the public site.
 *
 * `onRequestError` is the ONE place a Server Component failure is still intact:
 * Next hands us the real error here, before React replaces the message with the
 * generic "omitted in production builds" string that `error.tsx` receives. Every
 * throw during a render, a route handler, a Server Action or the proxy passes
 * through this hook - including the ones an error boundary swallows, which are
 * exactly the ones that were previously invisible.
 *
 * It runs in both the Node and Edge runtimes and must stay cheap and total: this
 * is on the failure path of a request that has already gone wrong, so it logs
 * synchronously and never awaits a network call.
 *
 * See `lib/debug/server-error-log.ts` for what is kept and why.
 */
export const onRequestError: Instrumentation.onRequestError = (
    err,
    request,
    context,
) => {
    recordServerError(err, request, context);
};
