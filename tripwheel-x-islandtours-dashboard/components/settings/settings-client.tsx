'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useRole } from '@/contexts/role-context';
import { AdminSettings } from './admin-settings';
import { OperatorSettings } from './operator-settings';

/**
 * Role-branching settings entry. Admins manage platform-wide system settings;
 * tour operators manage their own iCal sync and (when it ships) payment
 * configuration. Profile-managed data (personal info, social links) is
 * intentionally excluded.
 *
 * These two branches are EXCLUSIVE - an admin never sees `OperatorSettings` -
 * so anything an admin should also reach has to exist on both sides. Calendar
 * sync does (as a tab in `AdminSettings`); that is not duplication to
 * de-duplicate, it is the cost of the branch.
 */
export function SettingsClient() {
    const { can } = useRole();

    // Admin: full system settings (VIEW/MANAGE_SETTINGS).
    if (can('VIEW_SETTINGS')) return <AdminSettings />;

    // Operator: iCal sync, plus company/payment settings as they return.
    // MANAGE_AVAILABILITY is listed because a non-owner team seat can hold it
    // without EDIT_OPERATOR_PROFILE, and the sidebar now routes such a seat here.
    if (
        can('MANAGE_AVAILABILITY') ||
        can('EDIT_OPERATOR_PROFILE') ||
        can('MANAGE_OPERATOR_PAYMENTS')
    ) {
        return <OperatorSettings />;
    }

    return (
        <Card>
            <CardContent className='py-12 text-center text-sm text-muted-foreground'>
                You do not have access to any settings.
            </CardContent>
        </Card>
    );
}

