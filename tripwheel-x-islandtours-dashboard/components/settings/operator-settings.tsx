'use client';

import { Card, CardContent } from '@/components/ui/card';
import { EntityTabs } from '@/components/common/entity-tabs';
import { useProfileQuery } from '@/hooks/profile/use-profile';
import { OperatorCompanyForm } from './operator-company-form';
import { OperatorPaymentsForm } from './operator-payments-form';
import { SettingsCardSkeleton } from './settings-fields';

export function OperatorSettings() {
  const { data: user, isLoading } = useProfileQuery();
  const operatorId = user?.operator?.id;

  if (isLoading) return <SettingsCardSkeleton />;

  if (!operatorId) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No operator account is linked to your profile. Please contact an administrator.
        </CardContent>
      </Card>
    );
  }

  // "Your Business" (Phase 20 rename) - this is the operator's own company,
  // distinct from the platform's Legal Entity section in admin settings.
  return (
    <EntityTabs
      basePath="/settings"
      aliases={{ company: 'business' }}
      tabs={[
        {
          value: 'business',
          label: 'Your Business',
          content: <OperatorCompanyForm operatorId={operatorId} />,
        },
        {
          value: 'payments',
          label: 'Payments',
          content: <OperatorPaymentsForm operatorId={operatorId} />,
        },
      ]}
    />
  );
}
