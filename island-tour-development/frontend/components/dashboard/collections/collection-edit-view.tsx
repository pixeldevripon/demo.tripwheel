'use client';

import { ArchiveIcon, CheckIcon, InfoIcon, PlayIcon, RotateCcwIcon, UndoIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useRole } from '@/contexts/role-context';
import {
  useCollection,
  useCollectionTranslationByLocale,
  useUpdateCollectionStatus,
} from '@/hooks/collections/use-collections';
import type { CollectionStatus } from '@/types/enums';
import { COLLECTION_STATUS_LABELS } from '@/types/enums';
import { CollectionDetailShell } from './collection-detail-shell';
import { CollectionForm } from './collection-form';

const statusVariant: Record<CollectionStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  PUBLISHED: 'default',
  ARCHIVED: 'destructive',
};

function ReadinessItem({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {passed ? (
        <CheckIcon className="size-4 text-emerald-500 shrink-0" />
      ) : (
        <XIcon className="size-4 text-destructive shrink-0" />
      )}
      <span className={passed ? 'text-muted-foreground' : 'text-destructive'}>{label}</span>
    </div>
  );
}

export function CollectionEditView({ id }: { id: string }) {
  const { data: collection, isLoading, isError } = useCollection(id);
  const { data: enTranslation } = useCollectionTranslationByLocale(id, 'en');
  const { can } = useRole();
  const { mutate: updateStatus, isPending: isUpdating } = useUpdateCollectionStatus();

  function changeStatus(status: CollectionStatus, successMessage: string) {
    updateStatus(
      { id, status },
      {
        onSuccess: () => toast.success(successMessage),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to update collection status.'),
      }
    );
  }

  const isManual = collection?.collectionType === 'MANUAL';
  const memberCount = collection?.tourIds?.length ?? 0;

  // Publish guard (G5) - mirrors the backend's required-fields check. The per-tour
  // English rationale requirement (MANUAL only) cannot be verified client-side (no
  // read-back endpoint), so it is surfaced as a note; the server returns a 422 listing
  // any missing rationale on publish.
  const readinessChecks = [
    { label: 'Hero image set', passed: !!collection?.heroImage },
    { label: 'English H1 override filled', passed: !!enTranslation?.h1Override?.trim() },
    { label: 'English overview filled', passed: !!enTranslation?.overview?.trim() },
    ...(isManual ? [{ label: 'At least 1 member tour', passed: memberCount >= 1 }] : []),
  ];
  const allPassed = readinessChecks.every((c) => c.passed);

  return (
    <CollectionDetailShell
      id={id}
      name={collection?.name}
      isLoading={isLoading}
      subtitle="Edit collection details"
    >
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-none" />
          <Skeleton className="h-10 w-full rounded-none" />
          <Skeleton className="h-32 w-full rounded-none" />
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">Failed to load collection.</p>
      ) : collection ? (
        <div className="space-y-6">
          {/* Status + lifecycle actions */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Status
              </span>
              <Badge variant={statusVariant[collection.status]}>
                {COLLECTION_STATUS_LABELS[collection.status]}
              </Badge>
            </div>

            {can('EDIT_COLLECTION') && (
              <div className="flex flex-wrap gap-2">
                {collection.status === 'DRAFT' && (
                  <Button
                    size="sm"
                    onClick={() => changeStatus('PUBLISHED', 'Collection published.')}
                    disabled={isUpdating}
                  >
                    <PlayIcon className="size-3.5" />
                    Publish
                  </Button>
                )}
                {collection.status === 'PUBLISHED' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => changeStatus('DRAFT', 'Collection moved to draft.')}
                      disabled={isUpdating}
                    >
                      <UndoIcon className="size-3.5" />
                      Move to Draft
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => changeStatus('ARCHIVED', 'Collection archived.')}
                      disabled={isUpdating}
                    >
                      <ArchiveIcon className="size-3.5" />
                      Archive
                    </Button>
                  </>
                )}
                {collection.status === 'ARCHIVED' && (
                  <Button
                    size="sm"
                    onClick={() => changeStatus('DRAFT', 'Collection restored to draft.')}
                    disabled={isUpdating}
                  >
                    <RotateCcwIcon className="size-3.5" />
                    Restore to Draft
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Publish readiness (only relevant while not yet published) */}
          {collection.status !== 'PUBLISHED' && (
            <Card className={allPassed ? 'border-emerald-200' : 'border-amber-200'}>
              <CardHeader className="border-b pb-4">
                <CardTitle className="text-sm">Publish Readiness</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {readinessChecks.map((check) => (
                    <ReadinessItem key={check.label} label={check.label} passed={check.passed} />
                  ))}
                </div>
                {isManual && (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground border-t pt-3">
                    <InfoIcon className="size-3.5 shrink-0 mt-0.5" />
                    <span>
                      Every member tour also needs an English rationale (≤20 words), set in the
                      Tours tab. This is enforced by the server on publish.
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <CollectionForm collection={collection} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Collection not found.</p>
      )}
    </CollectionDetailShell>
  );
}
