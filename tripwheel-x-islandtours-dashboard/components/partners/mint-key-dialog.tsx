'use client';

import { Loading03Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    PARTNER_SCOPE_LABELS,
    PartnerEnv,
    PartnerScope,
    type MintPartnerApiKeyPayload,
} from '@/types/partner';

const SCOPE_ORDER: PartnerScope[] = [
    PartnerScope.CATALOG_READ,
    PartnerScope.AVAILABILITY_READ,
    PartnerScope.BOOKINGS_WRITE,
];

/**
 * Mint a partner API key.
 *
 * Two defaults are deliberate rather than arbitrary:
 *
 * - **Environment defaults to TEST.** Every integration starts in test, and a live key
 *   minted by reflex is a live key nobody meant to issue. Choosing LIVE should be a
 *   decision someone made, not the path of least resistance.
 * - **Scopes start at catalog-read only.** A key that can create bookings is a key that can
 *   consume real capacity; it should be granted when the integration reaches that stage,
 *   not preemptively.
 *
 * There is no "rotate" anywhere in this UI, on purpose. Rotation is mint-then-revoke with
 * an overlap window, because you cannot coordinate an instant cutover with a channel's ops
 * team. An atomic swap button would look convenient and break integrations.
 */
export function MintKeyDialog({
    open,
    onOpenChange,
    partnerName,
    pending,
    onMint,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    partnerName: string;
    pending: boolean;
    onMint: (payload: MintPartnerApiKeyPayload) => void;
}) {
    const [environment, setEnvironment] = useState<PartnerEnv>(PartnerEnv.TEST);
    const [scopes, setScopes] = useState<PartnerScope[]>([
        PartnerScope.CATALOG_READ,
    ]);
    const [label, setLabel] = useState('');
    const [ipAllowlist, setIpAllowlist] = useState('');

    const toggleScope = (scope: PartnerScope) =>
        setScopes(prev =>
            prev.includes(scope)
                ? prev.filter(s => s !== scope)
                : [...prev, scope],
        );

    const submit = () => {
        const ips = ipAllowlist
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);

        onMint({
            environment,
            scopes,
            ...(label.trim() ? { label: label.trim() } : {}),
            ...(ips.length ? { ipAllowlist: ips } : {}),
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-lg'>
                <DialogHeader>
                    <DialogTitle>Mint an API key</DialogTitle>
                    <DialogDescription>
                        For {partnerName}. The key is shown once and cannot be
                        recovered afterwards.
                    </DialogDescription>
                </DialogHeader>

                <div className='space-y-4'>
                    <div className='space-y-2'>
                        <Label>Environment</Label>
                        <Select
                            value={environment}
                            onValueChange={v =>
                                setEnvironment(v as PartnerEnv)
                            }>
                            <SelectTrigger className='w-full'>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={PartnerEnv.TEST}>
                                    Test - no live inventory, no money
                                </SelectItem>
                                <SelectItem value={PartnerEnv.LIVE}>
                                    Live - real inventory
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className='space-y-2'>
                        <Label>What this key can do</Label>
                        <div className='space-y-2 rounded-md border p-3'>
                            {SCOPE_ORDER.map(scope => (
                                <label
                                    key={scope}
                                    className='flex items-center gap-2 text-sm'>
                                    <Checkbox
                                        checked={scopes.includes(scope)}
                                        onCheckedChange={() =>
                                            toggleScope(scope)
                                        }
                                    />
                                    {PARTNER_SCOPE_LABELS[scope]}
                                </label>
                            ))}
                        </div>
                        {scopes.length === 0 && (
                            <p className='text-xs text-destructive'>
                                A key with no permissions cannot do anything.
                                Pick at least one.
                            </p>
                        )}
                    </div>

                    <div className='space-y-2'>
                        <Label htmlFor='key-label'>Label</Label>
                        <Input
                            id='key-label'
                            value={label}
                            onChange={e => setLabel(e.target.value)}
                            placeholder='production'
                        />
                        {/* Two live keys during a rotation look identical without this. */}
                        <p className='text-xs text-muted-foreground'>
                            Optional. Helps tell two keys apart while rotating.
                        </p>
                    </div>

                    <div className='space-y-2'>
                        <Label htmlFor='key-ips'>Allowed IP addresses</Label>
                        <Input
                            id='key-ips'
                            value={ipAllowlist}
                            onChange={e => setIpAllowlist(e.target.value)}
                            placeholder='203.0.113.10, 203.0.113.11'
                        />
                        <p className='text-xs text-muted-foreground'>
                            Optional, comma separated. Leave empty to allow any
                            address - most channels cannot promise fixed IPs.
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant='outline'
                        onClick={() => onOpenChange(false)}
                        disabled={pending}>
                        Cancel
                    </Button>
                    <Button
                        onClick={submit}
                        disabled={pending || scopes.length === 0}>
                        {pending && (
                            <HugeiconsIcon
                                icon={Loading03Icon}
                                className='size-4 animate-spin'
                            />
                        )}
                        {pending ? 'Minting' : 'Mint key'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
