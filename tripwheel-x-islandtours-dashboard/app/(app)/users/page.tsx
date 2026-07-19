import { TeamView } from '@/components/staff/team-view';

export const metadata = { title: 'Users' };

/**
 * Staff & Teams management, presented as "Users" for now (owner decision):
 * admins manage platform staff + designations, operator owners their team
 * seats. Replaces the old placeholder stub on this route.
 */
export default function UsersPage() {
    return <TeamView />;
}
