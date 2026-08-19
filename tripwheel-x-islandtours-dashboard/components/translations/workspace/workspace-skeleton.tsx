/**
 * The workspace's loading state, shaped like the real thing: breadcrumb, header
 * row, and the side-by-side field pairs.
 *
 * Rendered from TWO places on purpose, which is the whole point of extracting it:
 *   1. `loading.tsx` for the workspace route - covers the gap between clicking a
 *      matrix cell and the client bundle mounting, which used to be a blank page.
 *   2. `ContentWorkspace`'s own `isLoading` branch - covers the queries after it
 *      mounts.
 * Identical markup in both means the two phases run together as one skeleton
 * instead of flashing from one shape to another.
 *
 * A Server Component: no hooks, no state, so `loading.tsx` streams it immediately.
 */

import { Skeleton } from '@/components/ui/skeleton';

export function WorkspaceSkeleton() {
  return (
    <div className="pb-16">
      {/* Breadcrumb */}
      <Skeleton className="mb-4 h-4 w-72" />

      {/* Header: title + locale line on the left, counter + actions on the right */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-44" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      {/* Locale switcher */}
      <Skeleton className="mb-6 h-9 w-full max-w-md" />

      {/* Field pairs: source column + target column */}
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
