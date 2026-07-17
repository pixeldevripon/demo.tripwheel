'use client';

import { useRouter } from 'next/navigation';

import { HugeiconsIcon } from '@hugeicons/react';
import { Archive02Icon, Cancel01Icon, InformationCircleIcon, PlayIcon, RotateLeft01Icon, Tick02Icon, UndoIcon } from '@hugeicons/core-free-icons';

import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EntityTabs } from '@/components/common/entity-tabs';
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
import { CollectionToursManager } from './collection-tours-manager';
import { EnglishContentEditor } from '@/components/common/english-content-editor';
import { CollectionPageContentForm } from './collection-page-content-form';
import { FaqManager } from '@/components/common/faq-manager';
import { CollectionSeoTab } from '@/components/common/entity-seo-tab';

// Priority order: identity first, then the ranked membership that IS the product,
// then the localized content travelers see, supplementary content, and SEO polish.
const statusVariant: Record<CollectionStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  PUBLISHED: 'default',
  ARCHIVED: 'destructive',
};

function ReadinessItem({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {passed ? (
        <HugeiconsIcon icon={Tick02Icon} className="size-4 text-success-solid shrink-0" />
      ) : (
        <HugeiconsIcon icon={Cancel01Icon} className="size-4 text-destructive shrink-0" />
      )}
      <span className={passed ? 'text-muted-foreground' : 'text-destructive'}>{label}</span>
    </div>
  );
}

interface CollectionEditViewProps {
  id: string;
  initialTab?: string;
}

export function CollectionEditView({ id, initialTab }: CollectionEditViewProps) {
  const router = useRouter();
  const goToTab = (tab: string) =>
    router.replace(`/collections/${id}/edit?tab=${tab}`, { scroll: false });
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

 if (isLoading) {
 return (
 <CollectionDetailShell id={id} name={undefined} isLoading subtitle="Edit collection">
 <div className="space-y-4">
 {Array.from({ length: 4 }).map((_, i) => (
 <Skeleton key={i} className="h-12 w-full rounded-none" />
 ))}
 </div>
 </CollectionDetailShell>
 );
 }

 if (isError || !collection) {
 return (
 <CollectionDetailShell id={id} name={undefined} isLoading={false} subtitle="Edit collection">
 <p className="text-sm text-destructive">Failed to load collection.</p>
 </CollectionDetailShell>
 );
 }

 return (
 <CollectionDetailShell id={id} name={collection.name} isLoading={false} subtitle="Edit collection">
 <div className="space-y-6">
 {/* Status + lifecycle actions (always visible, above the tabs) */}
 <div className="flex flex-wrap items-center justify-between gap-3">
 <div className="flex items-center gap-3">
 <span className="text-xs font-semibold text-muted-foreground">
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
                  <HugeiconsIcon icon={PlayIcon} className="size-3.5" />
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
                    <HugeiconsIcon icon={UndoIcon} className="size-3.5" />
                    Move to Draft
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => changeStatus('ARCHIVED', 'Collection archived.')}
                    disabled={isUpdating}
                  >
                    <HugeiconsIcon icon={Archive02Icon} className="size-3.5" />
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
                  <HugeiconsIcon icon={RotateLeft01Icon} className="size-3.5" />
                  Restore to Draft
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Publish readiness (only relevant while not yet published) */}
        {collection.status !== 'PUBLISHED' && (
          <Card className={allPassed ? 'border-success-border' : 'border-warning-border'}>
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
                  <HugeiconsIcon icon={InformationCircleIcon} className="size-3.5 shrink-0 mt-0.5" />
                  <span>
                    Every member tour also needs an English rationale (≤20 words), set in the
                    Tours tab. This is enforced by the server on publish.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <EntityTabs
          basePath={`/collections/${id}/edit`}
          initialTab={initialTab}
          aliases={{ translations: 'page-content' }}
          tabs={[
            {
              value: 'details',
              label: 'Details',
              content: (
                <CollectionForm
                  collection={collection}
                  onManageTours={() => goToTab('tours')}
                />
              ),
            },
            {
              value: 'tours',
              label: 'Tours',
              content: (
                <Card>
                  <CardHeader className="border-b pb-4">
                    <CardTitle className="text-lg font-semibold">Tours</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <CollectionToursManager collectionId={id} />
                  </CardContent>
                </Card>
              ),
            },
            {
              value: 'page-content',
              label: 'Page Content',
              content: (
                <div className="space-y-6">
                  <EnglishContentEditor type="collection" id={id} />
                  <CollectionPageContentForm collectionId={id} />
                </div>
              ),
            },
            {
              value: 'faqs',
              label: 'FAQs',
              content: (
                <Card>
                  <CardHeader className="border-b pb-4">
                    <CardTitle className="text-lg font-semibold">FAQs</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <FaqManager basePath="/collections" entityId={id} />
                  </CardContent>
                </Card>
              ),
            },
            {
              value: 'seo',
              label: 'SEO',
              content: <CollectionSeoTab collection={collection} />,
            },
          ]}
        />
      </div>
    </CollectionDetailShell>
  );
}
