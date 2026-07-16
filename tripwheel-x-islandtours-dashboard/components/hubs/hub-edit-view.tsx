'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRole } from '@/contexts/role-context';
import {
  useHub,
  useHubContentSections,
  useHubTranslationByLocale,
  useUpdateHub,
} from '@/hooks/hubs/use-hubs';
import type { HubStatus } from '@/types/hub';
import { HUB_STATUS_LABELS } from '@/types/enums';
import { ArchiveIcon, CheckIcon, PlayIcon, RotateCcwIcon, UndoIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { FaqManager } from '@/components/faq/faq-manager';
import { HubDetailShell } from './hub-detail-shell';
import { HubForm } from './hub-form';
import { HubTranslationForm } from './hub-translation-form';
import { HubSeoTab } from './hub-seo-tab';
import { HubContentSectionsManager } from './hub-content-sections-manager';
import { HubOurPicksManager } from './hub-our-picks-manager';
import { HubComparisonManager } from './hub-comparison-manager';
import { HubAllowedCategoriesManager } from './hub-allowed-categories-manager';

// Priority order: setup that unlocks the rest first (identity + the category
// gate tours attach through), then the publish-required localized content
// (translations), then editorial curation (picks/comparison), then the page
// content sections (Discover / Local Tips), FAQs and SEO polish last.
const VALID_TABS = [
  'details',
  'allowed-categories',
  'translations',
  'our-picks',
  'comparison',
  'page-content',
  'faqs',
  'seo',
] as const;

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
        <CheckIcon className="size-4 text-emerald-500 shrink-0" />
      ) : (
        <XIcon className="size-4 text-destructive shrink-0" />
      )}
      <span className={passed ? 'text-muted-foreground' : 'text-destructive'}>{label}</span>
    </div>
  );
}

export function HubEditView({ id, initialTab }: HubEditViewProps) {
  const activeTab =
    initialTab && (VALID_TABS as readonly string[]).includes(initialTab) ? initialTab : 'details';
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
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Status
            </span>
            <Badge variant={statusVariant[hub.status]}>{HUB_STATUS_LABELS[hub.status]}</Badge>
          </div>

          {can('MANAGE_HUBS') && (
            <div className="flex flex-wrap gap-2">
              {hub.status === 'DRAFT' && (
                <Button size="sm" onClick={() => changeStatus('PUBLISHED', 'Hub published.')} disabled={isUpdating}>
                  <PlayIcon className="size-3.5" />
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
                    <UndoIcon className="size-3.5" />
                    Move to Draft
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => changeStatus('ARCHIVED', 'Hub archived.')}
                    disabled={isUpdating}
                  >
                    <ArchiveIcon className="size-3.5" />
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
                  <RotateCcwIcon className="size-3.5" />
                  Restore to Draft
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Publish readiness (only relevant while not yet published) */}
        {hub.status !== 'PUBLISHED' && (
          <Card className={allPassed ? 'border-emerald-200' : 'border-amber-200'}>
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

        <Tabs defaultValue={activeTab}>
          <div className="pb-2 mb-6">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="allowed-categories">Allowed Categories</TabsTrigger>
              <TabsTrigger value="translations">Translations</TabsTrigger>
              <TabsTrigger value="our-picks">Our Picks</TabsTrigger>
              <TabsTrigger value="comparison">Comparison</TabsTrigger>
              <TabsTrigger value="page-content">Page Content</TabsTrigger>
              <TabsTrigger value="faqs">FAQs</TabsTrigger>
              <TabsTrigger value="seo">SEO</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="details">
            <HubForm hub={hub} />
          </TabsContent>

          <TabsContent value="allowed-categories">
            <HubAllowedCategoriesManager hubId={id} />
          </TabsContent>

          <TabsContent value="translations">
            <HubTranslationForm hubId={id} hubName={hub.name} />
          </TabsContent>

          <TabsContent value="our-picks">
            <HubOurPicksManager hubId={id} />
          </TabsContent>

          <TabsContent value="comparison">
            <HubComparisonManager hubId={id} />
          </TabsContent>

          <TabsContent value="page-content">
            <HubContentSectionsManager hubId={id} />
          </TabsContent>

          <TabsContent value="faqs">
            <Card>
              <CardHeader className="border-b pb-4">
                <CardTitle className="font-heading text-lg font-semibold uppercase tracking-wider">
                  FAQs
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <FaqManager basePath="/hubs" entityId={id} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="seo">
            <HubSeoTab hub={hub} />
          </TabsContent>
        </Tabs>
      </div>
    </HubDetailShell>
  );
}
