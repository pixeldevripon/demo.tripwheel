'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

  return (
    <Tabs defaultValue="company" className="w-full">
      <TabsList className="flex-wrap">
        <TabsTrigger value="company">Company</TabsTrigger>
        <TabsTrigger value="payments">Payments</TabsTrigger>
      </TabsList>

      <TabsContent value="company" className="mt-6">
        <OperatorCompanyForm operatorId={operatorId} />
      </TabsContent>
      <TabsContent value="payments" className="mt-6">
        <OperatorPaymentsForm operatorId={operatorId} />
      </TabsContent>
    </Tabs>
  );
}
