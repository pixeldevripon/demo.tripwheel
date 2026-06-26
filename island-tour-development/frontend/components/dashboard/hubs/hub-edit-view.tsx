'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
import { HubDetailShell } from './hub-detail-shell';
import { HubForm } from './hub-form';

interface HubEditViewProps {
  id: string;
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

export function HubEditView({ id }: HubEditViewProps) {
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

  return (
    <HubDetailShell id={id} name={hub?.name} isLoading={isLoading} subtitle="Edit hub details">
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-none" />
          <Skeleton className="h-10 w-full rounded-none" />
          <Skeleton className="h-32 w-full rounded-none" />
        </div>
      ) : hub ? (
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

          <HubForm hub={hub} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Hub not found.</p>
      )}
    </HubDetailShell>
  );
}
