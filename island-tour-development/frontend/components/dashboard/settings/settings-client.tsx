'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useRole } from '@/contexts/role-context';
import { AdminSettings } from './admin-settings';
import { OperatorSettings } from './operator-settings';

/**
 * Role-branching settings entry. Admins manage platform-wide system settings;
 * tour operators manage their own company info and payment configuration.
 * Profile-managed data (personal info, social links) is intentionally excluded.
 */
export function SettingsClient() {
  const { can } = useRole();

  // Admin: full system settings (VIEW/MANAGE_SETTINGS).
  if (can('VIEW_SETTINGS')) return <AdminSettings />;

  // Operator: own company + payment settings.
  if (can('EDIT_OPERATOR_PROFILE') || can('MANAGE_OPERATOR_PAYMENTS')) {
    return <OperatorSettings />;
  }

  return (
    <Card>
      <CardContent className="py-12 text-center text-sm text-muted-foreground">
        You do not have access to any settings.
      </CardContent>
    </Card>
  );
}
