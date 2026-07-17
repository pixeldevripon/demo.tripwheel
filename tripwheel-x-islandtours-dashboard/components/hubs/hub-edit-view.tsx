'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Archive02Icon, Cancel01Icon, PlayIcon, RotateLeft01Icon, Tick02Icon, UndoIcon } from '@hugeicons/core-free-icons';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EntityTabs } from '@/components/common/entity-tabs';
import { useRole } from '@/contexts/role-context';
import {
  useHub,
  useHubContentSections,
  useHubTranslationByLocale,
  useUpdateHub,
} from '@/hooks/hubs/use-hubs';
import type { HubStatus } from '@/types/hub';
import { HUB_STATUS_LABELS } from '@/types/enums';
import { toast } from 'sonner';
import { FaqManager } from '@/components/common/faq-manager';
import { HubDetailShell } from './hub-detail-shell';
import { HubForm } from './hub-form';
import { EnglishContentEditor } from '@/components/common/english-content-editor';
import { HubSeoTab } from '@/components/common/entity-seo-tab';
import { HubContentSectionsManager } from './hub-content-sections-manager';
import { HubOurPicksManager } from './hub-our-picks-manager';
import { HubComparisonManager } from './hub-comparison-manager';
import { HubAllowedCategoriesManager } from './hub-allowed-categories-manager';

interface HubEditViewProps {
  id: string;
  initialTab?: string;
}

const statusVariant: Record<HubStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
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

export function HubEditView({ id, initialTab }: HubEditViewProps) {
  const { data: hub, isLoading } = useHub(id, 'en');
  const { data: enTranslation } = useHubTranslationByLocale(id, 'en');
  const { data: contentSections } = useHubContentSections(id);
  const { can } = useRole();

  const { mutate: updateHub, isPending: isUpdating } = useUpdateHub();

  function changeStatus(status: HubStatus, successMessage: string) {
    updateHub(
      { id, payload: { status } },
      {
        onSuccess: () => toast.success(successMessage),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to update hub status.'),
      }
    );
  }

  // Publish guard (G6) - mirrors the backend's required-fields check so the admin
  // sees what is missing before attempting to publish.
  const enDiscoverCount =
    contentSections?.filter((s) => s.locale === 'en' && s.sectionType === 'DISCOVER').length ?? 0;
  const enLocalTipCount =
    contentSections?.filter((s) => s.locale === 'en' && s.sectionType === 'LOCAL_TIP').length ?? 0;

  const readinessChecks = [
    { label: 'Hero image set', passed: !!hub?.heroImage },
    { label: 'Hub type set', passed: !!hub?.hubType },
    { label: 'English H1 override filled', passed: !!enTranslation?.h1Override?.trim() },
    { label: 'English overview filled', passed: !!enTranslation?.overview?.trim() },
    { label: 'At least 1 English Discover section', passed: enDiscoverCount >= 1 },
    { label: 'At least 1 English Local Tip section', passed: enLocalTipCount >= 1 },
 ];
 const allPassed = readinessChecks.every((c) => c.passed);

 if (isLoading) {
 return (
 <HubDetailShell id={id} name={undefined} isLoading subtitle="Edit hub">
 <div className="space-y-4">
 {Array.from({ length: 4 }).map((_, i) => (
 <Skeleton key={i} className="h-12 w-full rounded-none" />
 ))}
 </div>
 </HubDetailShell>
 );
 }

 if (!hub) {
 return (
 <HubDetailShell id={id} name={undefined} isLoading={false} subtitle="Edit hub">
 <p className="text-sm text-muted-foreground">Hub not found.</p>
 </HubDetailShell>
 );
 }

 return (
 <HubDetailShell id={id} name={hub.name} isLoading={false} subtitle="Edit hub">
 <div className="space-y-6">
 {/* Status + lifecycle actions */}
 <div className="flex flex-wrap items-center justify-between gap-3">
 <div className="flex items-center gap-3">
 <span className="text-xs font-semibold text-muted-foreground">
 Status
 </span>
 <Badge variant={statusVariant[hub.status]}>{HUB_STATUS_LABELS[hub.status]}</Badge>
 </div>

 {can('MANAGE_HUBS') && (
            <div className="flex flex-wrap gap-2">
              {hub.status === 'DRAFT' && (
                <Button size="sm" onClick={() => changeStatus('PUBLISHED', 'Hub published.')} disabled={isUpdating}>
                  <HugeiconsIcon icon={PlayIcon} className="size-3.5" />
                  Publish
                </Button>
              )}
              {hub.status === 'PUBLISHED' && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => changeStatus('DRAFT', 'Hub moved to draft.')}
                    disabled={isUpdating}
                  >
                    <HugeiconsIcon icon={UndoIcon} className="size-3.5" />
                    Move to Draft
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => changeStatus('ARCHIVED', 'Hub archived.')}
                    disabled={isUpdating}
                  >
                    <HugeiconsIcon icon={Archive02Icon} className="size-3.5" />
                    Archive
                  </Button>
                </>
              )}
              {hub.status === 'ARCHIVED' && (
                <Button
                  size="sm"
                  onClick={() => changeStatus('DRAFT', 'Hub restored to draft.')}
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
        {hub.status !== 'PUBLISHED' && (
          <Card className={allPassed ? 'border-success-border' : 'border-warning-border'}>
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-sm">Publish Readiness</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {readinessChecks.map((check) => (
                  <ReadinessItem key={check.label} label={check.label} passed={check.passed} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <EntityTabs
          basePath={`/hubs/${id}/edit`}
          initialTab={initialTab}
          aliases={{
            translations: 'page-content',
            'allowed-categories': 'curation',
            'our-picks': 'curation',
            comparison: 'curation',
          }}
          tabs={[
            {
              value: 'details',
              label: 'Details',
              content: <HubForm hub={hub} />,
            },
            {
              value: 'curation',
              label: 'Curation',
              /* 04 §4.1: the hub's three editorial extras become ONE tab
                 with stacked sections - 8 tabs → 5, and an admin who learns
                 destinations has learned hubs. Each manager keeps its own
                 card, hooks and saves untouched. */
              content: (
                <div className="space-y-6">
                  <HubAllowedCategoriesManager hubId={id} />
                  <HubOurPicksManager hubId={id} />
                  <HubComparisonManager hubId={id} />
                </div>
              ),
            },
            {
              value: 'page-content',
              label: 'Page Content',
              content: (
                <div className="space-y-6">
                  <EnglishContentEditor type="hub" id={id} />
                  <HubContentSectionsManager hubId={id} />
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
                    <FaqManager basePath="/hubs" entityId={id} />
                  </CardContent>
                </Card>
              ),
            },
            {
              value: 'seo',
              label: 'SEO',
              content: <HubSeoTab hub={hub} />,
            },
          ]}
        />
      </div>
    </HubDetailShell>
  );
}
