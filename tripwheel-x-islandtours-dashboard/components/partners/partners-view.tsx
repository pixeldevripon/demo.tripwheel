'use client';

import { useState } from 'react';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useRole } from '@/contexts/role-context';
import { Permission } from '@/lib/config/rbac';
import { usePartners, useUpdatePartner } from '@/hooks/partners/use-partners';
import type { PartnerAccount } from '@/types/partner';
import { OperatorDistributionView } from './operator-distribution-view';
import { PartnerFormDialog } from './partner-form-dialog';
import { PartnerKeysPanel } from './partner-keys-panel';

/**
 * Distribution partners - the channels that consume our OCTO API.
 *
 * ## One route, two audiences
 * Admins (`MANAGE_PARTNERS`) get the channel accounts and their keys. Operators get their
 * own distribution switch and rate. Same route rather than two, matching the Users page:
 * operators cannot reach `/settings` at all (admin-only per the nav), so a distribution
 * screen buried there would be invisible to exactly the people whose consent it records.
 *
 * The asymmetry is deliberate. An operator always holds the veto and never the pen: they
 * can switch distribution off at any moment, and they can never mint a key or set a rate.
 *
 * One card per partner rather than a table: the interesting content is the KEY LIST, which
 * is variable-height, multi-line and the thing an admin actually came here to act on. A
 * table row would push it behind an expander for no gain.
 */
export function PartnersView() {
    const { can } = useRole();
    const canManage = can(Permission.MANAGE_PARTNERS);

    const [search, setSearch] = useState('');
    const { data, isLoading } = usePartners({
        limit: 50,
        ...(search.trim() ? { search: search.trim() } : {}),
    });
    const update = useUpdatePartner();

    const [creating, setCreating] = useState(false);
    const [editing, setEditing] = useState<PartnerAccount | undefined>();
    const [deactivating, setDeactivating] = useState<PartnerAccount | null>(
        null,
    );

    // Operators land on their own distribution panel, not an empty admin list.
    if (!canManage) return <OperatorDistributionView />;

    const partners = data?.data ?? [];

    return (
        <>
            <div className='mb-4 flex flex-wrap items-center gap-2'>
                <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder='Search partners'
                    className='max-w-xs'
                />
                <Button className='ml-auto' onClick={() => setCreating(true)}>
                    Add partner
                </Button>
            </div>

            {isLoading ? (
                <div className='space-y-4'>
                    {[0, 1].map(i => (
                        <Card key={i}>
                            <CardHeader>
                                <Skeleton className='h-5 w-48' />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className='h-20 w-full' />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : partners.length === 0 ? (
                <Card>
                    <CardContent className='py-12 text-center'>
                        <p className='text-sm font-medium'>
                            No distribution partners yet
                        </p>
                        <p className='mx-auto mt-1 max-w-md text-sm text-muted-foreground'>
                            A partner is a channel like GetYourGuide that sells
                            our tours through their own marketplace. Add one,
                            then mint them a test key.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className='space-y-4'>
                    {partners.map(partner => (
                        <Card key={partner.id}>
                            <CardHeader className='border-b'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <h3 className='text-base font-medium'>
                                        {partner.name}
                                    </h3>

                                    {!partner.isActive && (
                                        <Badge variant='outline'>
                                            Deactivated
                                        </Badge>
                                    )}

                                    <Badge variant='secondary'>
                                        {partner.operatorId
                                            ? (partner.operatorName ??
                                              'One operator')
                                            : 'Whole marketplace'}
                                    </Badge>

                                    <div className='ml-auto flex gap-1'>
                                        <Button
                                            variant='ghost'
                                            size='sm'
                                            onClick={() => setEditing(partner)}>
                                            Edit
                                        </Button>
                                        {partner.isActive ? (
                                            <Button
                                                variant='ghost'
                                                size='sm'
                                                onClick={() =>
                                                    setDeactivating(partner)
                                                }>
                                                Deactivate
                                            </Button>
                                        ) : (
                                            <Button
                                                variant='ghost'
                                                size='sm'
                                                onClick={() =>
                                                    update.mutate({
                                                        id: partner.id,
                                                        payload: {
                                                            isActive: true,
                                                        },
                                                    })
                                                }>
                                                Reactivate
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <p className='text-xs text-muted-foreground'>
                                    <code className='font-mono'>
                                        {partner.slug}
                                    </code>
                                    {partner.contactEmail
                                        ? ` · ${partner.contactEmail}`
                                        : ''}
                                </p>

                                {partner.notes && (
                                    <p className='text-xs text-muted-foreground'>
                                        {partner.notes}
                                    </p>
                                )}
                            </CardHeader>

                            <CardContent className='pt-4'>
                                <PartnerKeysPanel partner={partner} />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <PartnerFormDialog open={creating} onOpenChange={setCreating} />
            <PartnerFormDialog
                open={editing !== undefined}
                onOpenChange={open => !open && setEditing(undefined)}
                partner={editing}
            />

            <ConfirmDialog
                open={deactivating !== null}
                onOpenChange={open => !open && setDeactivating(null)}
                destructive
                loading={update.isPending}
                title='Deactivate this partner?'
                description={
                    <>
                        Every key under {deactivating?.name} stops working
                        immediately, without having to revoke them one by one.
                        Reactivating brings the same keys back, so use this
                        rather than revoking when a contract is paused rather
                        than ended.
                    </>
                }
                confirmLabel='Deactivate'
                onConfirm={() => {
                    if (!deactivating) return;
                    update.mutate(
                        {
                            id: deactivating.id,
                            payload: { isActive: false },
                        },
                        { onSettled: () => setDeactivating(null) },
                    );
                }}
            />
        </>
    );
}
