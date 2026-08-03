'use client';

import { useState } from 'react';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    useMintPartnerKey,
    useRevokePartnerKey,
} from '@/hooks/partners/use-partners';
import {
    PARTNER_SCOPE_LABELS,
    type MintedPartnerApiKey,
    type MintPartnerApiKeyPayload,
    type PartnerAccount,
    type PartnerApiKey,
} from '@/types/partner';
import { MintKeyDialog } from './mint-key-dialog';
import { PartnerKeyRevealDialog } from './partner-key-reveal-dialog';

/** Why a key is not usable, or null when it is. */
function deadReason(key: PartnerApiKey): string | null {
    if (key.revokedAt) return 'Revoked';
    if (key.expiresAt && new Date(key.expiresAt).getTime() <= Date.now()) {
        return 'Expired';
    }
    return null;
}

const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
        dateStyle: 'medium',
    });

/**
 * The keys under one partner account.
 *
 * Multiple live keys is a NORMAL state here, not a warning: rotation is mint-the-new-one,
 * let the partner deploy, then revoke the old one. Anything in this UI that implied "one
 * key per partner" would push someone toward an instant swap and break a live integration.
 *
 * Revoked keys stay visible rather than disappearing. The row is kept server-side so the
 * hash can never be re-minted for someone else, and during an incident "when was this
 * revoked, and was it used after that" is the question being asked.
 */
export function PartnerKeysPanel({ partner }: { partner: PartnerAccount }) {
    const mint = useMintPartnerKey();
    const revoke = useRevokePartnerKey();

    const [minting, setMinting] = useState(false);
    const [minted, setMinted] = useState<MintedPartnerApiKey | null>(null);
    const [revoking, setRevoking] = useState<PartnerApiKey | null>(null);

    const onMint = (payload: MintPartnerApiKeyPayload) => {
        mint.mutate(
            { partnerId: partner.id, payload },
            {
                onSuccess: key => {
                    setMinting(false);
                    // Straight into component state and nowhere else. It is gone the
                    // moment the reveal dialog unmounts, which is the entire contract.
                    setMinted(key);
                },
            },
        );
    };

    const liveCount = partner.apiKeys.filter(k => k.isLive).length;

    return (
        <div className='space-y-3'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
                <div>
                    <h4 className='text-sm font-medium'>API keys</h4>
                    <p className='text-xs text-muted-foreground'>
                        {liveCount === 0
                            ? 'No live keys - this partner cannot call the API.'
                            : `${liveCount} live ${liveCount === 1 ? 'key' : 'keys'}.`}
                    </p>
                </div>
                <Button
                    size='sm'
                    onClick={() => setMinting(true)}
                    disabled={!partner.isActive}
                    title={
                        partner.isActive
                            ? undefined
                            : 'Reactivate the partner first'
                    }>
                    Mint key
                </Button>
            </div>

            {partner.apiKeys.length === 0 ? (
                <p className='rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground'>
                    No keys yet. Mint a test key to let them start integrating.
                </p>
            ) : (
                <ul className='divide-y rounded-md border'>
                    {partner.apiKeys.map(key => {
                        const dead = deadReason(key);
                        return (
                            <li
                                key={key.id}
                                className='flex flex-wrap items-center gap-3 p-3'>
                                <code className='font-mono text-xs text-muted-foreground'>
                                    {key.keyPrefix}
                                    <span aria-hidden>····</span>
                                </code>

                                <Badge
                                    variant={
                                        key.environment === 'LIVE'
                                            ? 'default'
                                            : 'secondary'
                                    }>
                                    {key.environment === 'LIVE'
                                        ? 'Live'
                                        : 'Test'}
                                </Badge>

                                {dead ? (
                                    <Badge variant='outline'>{dead}</Badge>
                                ) : null}

                                {key.label && (
                                    <span className='text-xs text-muted-foreground'>
                                        {key.label}
                                    </span>
                                )}

                                <span className='text-xs text-muted-foreground'>
                                    {key.scopes.length === 0
                                        ? 'No permissions'
                                        : key.scopes
                                              .map(s => PARTNER_SCOPE_LABELS[s])
                                              .join(' · ')}
                                </span>

                                {key.ipAllowlist.length > 0 && (
                                    <span className='text-xs text-muted-foreground'>
                                        IP locked
                                    </span>
                                )}

                                {/* The question before revoking an old key during a
                                    rotation is always "has anything used it lately". */}
                                <span className='ml-auto text-xs text-muted-foreground'>
                                    {key.lastUsedAt
                                        ? `Last used ${formatDate(key.lastUsedAt)}`
                                        : 'Never used'}
                                </span>

                                {!dead && (
                                    <Button
                                        variant='ghost'
                                        size='sm'
                                        onClick={() => setRevoking(key)}>
                                        Revoke
                                    </Button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            <MintKeyDialog
                open={minting}
                onOpenChange={setMinting}
                partnerName={partner.name}
                pending={mint.isPending}
                onMint={onMint}
            />

            <PartnerKeyRevealDialog
                minted={minted}
                partnerName={partner.name}
                onClose={() => setMinted(null)}
            />

            <ConfirmDialog
                open={revoking !== null}
                onOpenChange={open => !open && setRevoking(null)}
                destructive
                loading={revoke.isPending}
                title='Revoke this key?'
                description={
                    <>
                        It stops working on the very next request.{' '}
                        {revoking?.environment === 'LIVE'
                            ? 'This is a LIVE key - if the partner is still using it, their integration breaks immediately.'
                            : 'This is a test key, so no live integration is affected.'}{' '}
                        It cannot be un-revoked; mint a new key instead.
                    </>
                }
                confirmLabel='Revoke key'
                onConfirm={() => {
                    if (!revoking) return;
                    revoke.mutate(
                        { partnerId: partner.id, keyId: revoking.id },
                        { onSettled: () => setRevoking(null) },
                    );
                }}
            />
        </div>
    );
}
