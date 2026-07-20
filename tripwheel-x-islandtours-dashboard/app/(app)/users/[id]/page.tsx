import { StaffMemberProfile } from '@/components/staff/staff-member-profile';

export const metadata = { title: 'Member' };

/**
 * One staff member / team seat, reached by clicking a name on the Users list.
 * The id is a `staff_members` id - except for the system administrator, where
 * it is the user id (that account has no staff row; the backend synthesizes it).
 */
export default async function UserProfilePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return <StaffMemberProfile id={id} />;
}
