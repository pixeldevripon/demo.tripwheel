'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRole } from '@/contexts/role-context';
import type { StaffScope } from '@/types/staff';
import { DesignationsTab } from './designations-tab';
import { StaffMembersTab } from './staff-members-tab';

/**
 * One route, two audiences (mirrors the backend's two route families):
 * - ADMIN -> platform scope: Island Tours' own staff + platform designations.
 * - Operator OWNER -> team scope: their team seats + team designations.
 * Non-owner seats hold neither permission, so the nav item never shows; this
 * guard is only the belt for a hand-typed URL.
 */
export function TeamView() {
    const { role, can } = useRole();

    const isPlatform = role === 'ADMIN' && can('MANAGE_STAFF');
    const isTeam = !isPlatform && can('MANAGE_TEAM');

    if (!isPlatform && !isTeam) {
        return (
            <div className='flex h-64 flex-col items-center justify-center gap-1 text-center'>
                <p className='font-medium'>Team management is owner-only.</p>
                <p className='text-sm text-muted-foreground'>
                    Ask the account owner if you need access changed.
                </p>
            </div>
        );
    }

    const scope: StaffScope = isPlatform ? 'platform' : 'team';

    return (
        <div>
            <div className='mb-6'>
                <h1 className='text-2xl font-semibold'>Team</h1>
                <p className='mt-1 text-sm text-muted-foreground'>
                    {scope === 'platform'
                        ? 'Invite staff, group them under designations, and control exactly what each person can do.'
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
