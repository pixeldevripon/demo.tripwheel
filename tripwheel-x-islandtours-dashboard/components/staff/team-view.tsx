'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStaffScope } from '@/hooks/staff/use-staff-scope';
import { DesignationsTab } from './designations-tab';
import { StaffMembersTab } from './staff-members-tab';
import { StaffNoAccess } from './staff-no-access';

/**
 * One route, two audiences (mirrors the backend's two route families):
 * - ADMIN -> platform scope: Island Tours' own staff + platform designations.
 * - Operator OWNER -> team scope: their team seats + team designations.
 * Non-owner seats hold neither permission, so the nav item never shows; this
 * guard is only the belt for a hand-typed URL.
 */
export function TeamView() {
    const scope = useStaffScope();

    if (!scope) return <StaffNoAccess />;

    return (
        <div>
            <div className='mb-6'>
                <h1 className='text-2xl font-medium'>Users</h1>
                <p className='mt-1 text-sm text-muted-foreground'>
                    {scope === 'platform'
                        ? 'Invite users, group them under designations, and control exactly what each person can do.'
                        : 'Invite your team, assign designations, and control exactly what each seat can do. Payouts and team management stay with the owner.'}
                </p>
            </div>

            <Tabs defaultValue='members'>
                <TabsList className='mb-4'>
                    <TabsTrigger value='members'>Members</TabsTrigger>
                    <TabsTrigger value='designations'>Designations</TabsTrigger>
                </TabsList>
                <TabsContent value='members'>
                    <StaffMembersTab scope={scope} />
                </TabsContent>
                <TabsContent value='designations'>
                    <DesignationsTab scope={scope} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

