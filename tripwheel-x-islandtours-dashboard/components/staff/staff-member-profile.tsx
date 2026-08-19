'use client';

import {
    Alert02Icon,
    Cancel01Icon,
    Delete02Icon,
    MailSend02Icon,
    PencilEdit02Icon,
    Tick02Icon,
    ToggleOffIcon,
    ToggleOnIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Breadcrumb } from '@/components/breadcrumb';
import { ForceDeleteDialog } from '@/components/common/force-delete-dialog';
import { StatusBadge } from '@/components/common/status-badge';
import { STAFF_MEMBER_STATUS } from '@/components/common/status-maps';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useRole } from '@/contexts/role-context';
import {
    useRemoveStaff,
    useRenameStaffUser,
    useResendStaffInvite,
    useStaffMember,
    useUpdateStaffStatus,
} from '@/hooks/staff/use-staff';
import { useStaffScope } from '@/hooks/staff/use-staff-scope';
import { formatDate } from '@/lib/utils';
import type { StaffMember } from '@/types/staff';
import { SEAT_ROLE_LABEL } from '@/types/staff';
import { PermissionMatrix } from './permission-matrix';
import { StaffAccessFields } from './staff-access-fields';
import { StaffNoAccess } from './staff-no-access';
import { useAccessEditor } from './use-access-editor';

/** One label/value line in the "Account" card. */
function Fact({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className='flex flex-col gap-0.5'>
            <dt className='text-xs font-medium text-muted-foreground'>
                {label}
            </dt>
            <dd className='m-0 text-sm'>{value}</dd>
        </div>
    );
}

/** How this member's access is described in one phrase. */
function designationLabel(member: StaffMember) {
    if (member.isSystemAdmin) return 'System Administrator';
    if (member.seatRole === 'OWNER') return SEAT_ROLE_LABEL.OWNER;
    return member.designation?.name ?? 'Custom permissions';
}

/**
 * Read-oriented profile for one staff member / team seat, reached by clicking
 * a name on the Users list. Access is edited IN PAGE (the Permissions card
 * flips into the editor) rather than in a sheet - the sheet stays for the list
 * row, and both drive the same `useAccessEditor`.
 *
 * The system administrator and operator owners render without access actions:
 * they have no editable access here and every mutating staff endpoint rejects
 * them. Renaming is separate - it targets the auth account, so it is gated on
 * UPDATE_USER and stays available for those rows.
 */
export function StaffMemberProfile({ id }: { id: string }) {
    const scope = useStaffScope();
    const { can } = useRole();

    // Hooks must run unconditionally. `scope ?? 'platform'` is never actually
    // fetched: the member query is disabled without a scope, and the no-access
    // branch returns before anything renders.
    const resolvedScope = scope ?? 'platform';
    const {
        data: member,
        isLoading,
        isError,
        refetch,
    } = useStaffMember(resolvedScope, scope ? id : '');

    const editor = useAccessEditor(resolvedScope, member ?? null);
    const { mutate: updateStatus, isPending: statusPending } =
        useUpdateStaffStatus(resolvedScope);
    const { mutate: resendInvite, isPending: resendPending } =
        useResendStaffInvite(resolvedScope);
    const { mutate: rename, isPending: renamePending } =
        useRenameStaffUser(resolvedScope);
    const { mutate: removeMember, isPending: removePending } =
        useRemoveStaff(resolvedScope);

    const router = useRouter();
    const [editingAccess, setEditingAccess] = useState(false);
    const [nameDraft, setNameDraft] = useState<string | null>(null);
    const [removeOpen, setRemoveOpen] = useState(false);

    if (!scope) return <StaffNoAccess />;

    const crumbs = (
        <Breadcrumb
            items={[
                { label: 'Dashboard', href: '/' },
                { label: 'Users', href: '/users' },
                {
                    label: isLoading ? (
                        <Skeleton className='inline-block h-3 w-24' />
                    ) : (
                        (member?.user.name ?? 'Member')
                    ),
                },
            ]}
        />
    );

    if (isError) {
        return (
            <div>
                {crumbs}
                <div className='flex h-64 flex-col items-center justify-center gap-2 text-center'>
                    <HugeiconsIcon
                        icon={Alert02Icon}
                        className='size-8 text-muted-foreground'
                    />
                    <p className='font-medium'>
                        Couldn&apos;t load this member.
                    </p>
                    <p className='text-sm text-muted-foreground'>
                        They may have been removed, or the server did not
                        respond.
                    </p>
                    <div className='mt-2 flex gap-2'>
                        <Button size='sm' onClick={() => refetch()}>
                            Retry
                        </Button>
                        <Button size='sm' variant='outline' asChild>
                            <Link href='/users'>Back to Users</Link>
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (isLoading || !member) {
        return (
            <div>
                {crumbs}
                <div className='flex items-center gap-4'>
                    <Skeleton className='size-16 rounded-full' />
                    <div className='space-y-2'>
                        <Skeleton className='h-6 w-48' />
                        <Skeleton className='h-4 w-64' />
                    </div>
                </div>
                <Skeleton className='mt-6 h-64 w-full max-w-6xl' />
            </div>
        );
    }

    // The system admin and owner seats are read-only for ACCESS (the backend
    // rejects every staff mutation on them), so those actions disappear rather
    // than offering calls they know will 403.
    const accessReadOnly = member.isSystemAdmin || member.seatRole === 'OWNER';
    const canRename = can('UPDATE_USER');
    const suspended = member.status === 'SUSPENDED';
    const statusMeta = STAFF_MEMBER_STATUS[member.status];
    const renaming = nameDraft !== null;
    const trimmedName = nameDraft?.trim() ?? '';

    function saveName() {
        if (!member || !trimmedName || trimmedName === member.user.name) {
            setNameDraft(null);
            return;
        }
        rename(
            { userId: member.user.id, name: trimmedName },
            { onSuccess: () => setNameDraft(null) }
        );
    }

    return (
        <div className='w-full max-w-6xl'>
            {crumbs}

            {/* Identity + actions */}
            <div className='mb-6 flex flex-wrap items-start justify-between gap-4'>
                <div className='flex min-w-0 items-center gap-4'>
                    <span className='flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xl font-medium uppercase'>
                        {member.user.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={member.user.image}
                                alt={member.user.name}
                                className='h-full w-full object-cover'
                            />
                        ) : (
                            member.user.name.charAt(0)
                        )}
                    </span>
                    <div className='min-w-0'>
                        {renaming ? (
                            <div className='flex items-center gap-2'>
                                <Input
                                    value={nameDraft}
                                    autoFocus
                                    disabled={renamePending}
                                    aria-label='Member name'
                                    className='h-9 w-64 text-lg font-medium'
                                    onChange={e => setNameDraft(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') saveName();
                                        if (e.key === 'Escape')
                                            setNameDraft(null);
                                    }}
                                />
                                <Button
                                    size='icon'
                                    className='size-9'
                                    aria-label='Save name'
                                    disabled={renamePending || !trimmedName}
                                    onClick={saveName}>
                                    <HugeiconsIcon icon={Tick02Icon} />
                                </Button>
                                <Button
                                    size='icon'
                                    variant='outline'
                                    className='size-9'
                                    aria-label='Cancel rename'
                                    disabled={renamePending}
                                    onClick={() => setNameDraft(null)}>
                                    <HugeiconsIcon icon={Cancel01Icon} />
                                </Button>
                            </div>
                        ) : (
                            <div className='flex flex-wrap items-center gap-2'>
                                <h1 className='truncate text-2xl font-medium'>
                                    {member.user.name}
                                </h1>
                                <StatusBadge
                                    variant={statusMeta.variant}
                                    hint={statusMeta.hint}>
                                    {statusMeta.label}
                                </StatusBadge>
                                {canRename && (
                                    <Button
                                        size='icon'
                                        variant='ghost'
                                        className='size-7'
                                        aria-label='Rename member'
                                        onClick={() =>
                                            setNameDraft(member.user.name)
                                        }>
                                        <HugeiconsIcon
                                            icon={PencilEdit02Icon}
                                            className='size-4'
                                        />
                                    </Button>
                                )}
                            </div>
                        )}
                        <p className='mt-1 truncate text-sm text-muted-foreground'>
                            {member.user.email} · {designationLabel(member)}
                        </p>
                    </div>
                </div>

                {!accessReadOnly && (
                    <div className='flex flex-wrap items-center gap-2'>
                        {!editingAccess && (
                            <Button
                                size='sm'
                                onClick={() => {
                                    editor.reset();
                                    setEditingAccess(true);
                                }}>
                                <HugeiconsIcon icon={PencilEdit02Icon} />
                                Edit access
                            </Button>
                        )}
                        {member.status === 'INVITED' && (
                            <Button
                                size='sm'
                                variant='outline'
                                disabled={resendPending}
                                onClick={() => resendInvite({ id: member.id })}>
                                <HugeiconsIcon icon={MailSend02Icon} />
                                Resend invite
                            </Button>
                        )}
                        <Button
                            size='sm'
                            variant='outline'
                            disabled={statusPending}
                            onClick={() =>
                                updateStatus({
                                    id: member.id,
                                    payload: {
                                        status: suspended
                                            ? 'ACTIVE'
                                            : 'SUSPENDED',
                                    },
                                })
                            }>
                            <HugeiconsIcon
                                icon={suspended ? ToggleOnIcon : ToggleOffIcon}
                            />
                            {suspended ? 'Reactivate' : 'Suspend'}
                        </Button>
                    </div>
                )}
            </div>

            <div className='space-y-6'>
                <Card>
                    <CardHeader>
                        <CardTitle>Account</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <dl className='m-0 grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @4xl/main:grid-cols-3'>
                            <Fact label='Email' value={member.user.email} />
                            <Fact
                                label='Designation'
                                value={designationLabel(member)}
                            />
                            {scope === 'team' && (
                                <Fact
                                    label='Seat'
                                    value={SEAT_ROLE_LABEL[member.seatRole]}
                                />
                            )}
                            <Fact
                                label='Last login'
                                value={
                                    member.lastLoginAt
                                        ? formatDate(member.lastLoginAt, 'long')
                                        : 'Never'
                                }
                            />
                            <Fact
                                label='Invited by'
                                value={
                                    member.invitedBy?.name ?? (
                                        <span className='text-muted-foreground'>
                                            —
                                        </span>
                                    )
                                }
                            />
                            <Fact
                                label={
                                    member.activatedAt
                                        ? 'Active since'
                                        : 'Invited'
                                }
                                value={formatDate(
                                    member.activatedAt ?? member.invitedAt
                                )}
                            />
                        </dl>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>
                            Permissions
                            <span className='ml-2 text-xs font-light text-muted-foreground'>
                                {accessReadOnly
                                    ? 'Full access'
                                    : `${member.effectivePermissions.length} granted`}
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {editingAccess ? (
                            <>
                                <StaffAccessFields
                                    scope={scope}
                                    editor={editor}
                                />
                                <div className='mt-6 flex justify-end gap-2 border-t pt-4'>
                                    <Button
                                        variant='outline'
                                        disabled={editor.isPending}
                                        onClick={() => {
                                            editor.reset();
                                            setEditingAccess(false);
                                        }}>
                                        Cancel
                                    </Button>
                                    <Button
                                        disabled={editor.isPending}
                                        onClick={() =>
                                            editor.save(() =>
                                                setEditingAccess(false)
                                            )
                                        }>
                                        {editor.isPending
                                            ? 'Saving...'
                                            : 'Save access'}
                                    </Button>
                                </div>
                            </>
                        ) : editor.catalog ? (
                            // Read-only picture of what the backend guards
                            // actually enforce.
                            <PermissionMatrix
                                groups={editor.catalog.groups}
                                value={member.effectivePermissions}
                                onChange={() => {}}
                                disabled
                            />
                        ) : (
                            <Skeleton className='h-48 w-full' />
                        )}
                    </CardContent>
                </Card>

                {/* Same gate as the access actions: the system admin and owner
                    seats cannot be removed through the staff API at all. */}
                {!accessReadOnly && (
                    <Card className='border-destructive/30 ring-destructive/10'>
                        <CardHeader className='border-b pb-8'>
                            <CardTitle className='text-destructive'>
                                Danger Zone
                            </CardTitle>
                        </CardHeader>
                        <CardContent className='pt-8'>
                            <div className='flex items-start justify-between gap-4'>
                                <div>
                                    <p className='text-sm font-medium'>
                                        Remove this member
                                    </p>
                                    <p className='mt-1 text-sm text-muted-foreground'>
                                        Permanently removes their seat and login
                                        account, and signs out every active
                                        session immediately. To revoke access
                                        temporarily, suspend them instead.
                                    </p>
                                </div>
                                <div className='shrink-0'>
                                    <Button
                                        variant='destructive'
                                        size='sm'
                                        type='button'
                                        onClick={() => setRemoveOpen(true)}>
                                        <HugeiconsIcon icon={Delete02Icon} />
                                        Remove
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            <ForceDeleteDialog
                open={removeOpen}
                onOpenChange={setRemoveOpen}
                title='Remove member'
                entityName={member.user.name}
                consequenceNote='Their login account is deleted and every active session is signed out immediately.'
                confirmLabel='Remove Member'
                isPending={removePending}
                onConfirm={() =>
                    removeMember(
                        { id: member.id },
                        {
                            onSuccess: () => {
                                setRemoveOpen(false);
                                router.push('/users');
                            },
                        }
                    )
                }
            />
        </div>
    );
}

