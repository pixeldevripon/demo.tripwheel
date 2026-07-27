/**
 * The loading state for an entity edit page, shaped like `EntityDetailShell` +
 * `EntityTabs` + a form card - breadcrumb, title block, tab bar, fields.
 *
 * Rendered from TWO places, which is the point of extracting it:
 *   1. each `[id]/edit/loading.tsx` - covers the navigation, before any client
 *      component has mounted.
 *   2. each edit view's own `isLoading` branch - covers the entity fetch after
 *      it mounts.
 *
 * Entering an edit page used to cross three different shapes: the generic
 * `(app)/loading.tsx` (title + one big block), then the view's own four grey
 * bars, then the real form. Same markup in both places collapses that into one
 * steady skeleton that only ever fills in.
 *
 * A Server Component - no hooks, no state - so `loading.tsx` streams it at once.
 */

import { Skeleton } from '@/components/ui/skeleton';

/** Card header + `fields` label/input rows. Shared by both skeletons below. */
function FormCard({ fields }: { fields: number }) {
  return (
    <div className="rounded-lg border border-line">
      <div className="border-b p-6">
        <Skeleton className="h-5 w-44" />
      </div>
      <div className="space-y-6 p-6">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EntityEditSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className="w-full max-w-6xl">
      {/* Breadcrumb */}
      <Skeleton className="mb-4 h-3 w-80" />

      {/* Title block */}
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>

      <div>
        {/* Tab bar - one pill row, same height as the real TabsList */}
        <div className="mb-6 pb-2">
          <Skeleton className="h-9 w-full max-w-md rounded-md" />
        </div>

        <FormCard fields={fields} />
      </div>
    </div>
  );
}

/**
 * The create/edit form variant: same page anatomy MINUS the tab bar, since a
 * `new` page has no tabs. Reserving a tab row there would make the real form
 * jump upward on commit, which is the exact thing these skeletons exist to
 * prevent.
 */
export function EntityFormSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className="w-full max-w-6xl">
      <Skeleton className="mb-4 h-3 w-80" />

      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>

      <div>
        <FormCard fields={fields} />
      </div>
    </div>
  );
}
