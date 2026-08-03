'use client';

import { Copy01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import type { MintedPartnerApiKey } from '@/types/partner';

/**
 * The one and only time a partner API key is ever visible.
 *
 * The key is stored as a SHA-256 hash, so nobody - not the partner, not us, not support -
 * can retrieve it after this dialog closes. That is a deliberate property, not a gap: a
 * credential nobody can look up is a credential that cannot be leaked from our side.
 *
 * Three consequences the UI has to respect:
 *
 * 1. The value lives in the parent's component state and nowhere else. It is never written
 *    to a query cache, localStorage or the URL.
 * 2. Closing is a confirmed action, not an accident. Losing the key means revoking and
 *    re-minting, which for a live integration means coordinating with the channel's ops
 *    team, so a stray click on the overlay must not be able to cause that.
 * 3. The copy says plainly that it will not be shown again, BEFORE the person closes it.
 */
export function PartnerKeyRevealDialog({
    minted,
    partnerName,
    onClose,
}: {
    minted: MintedPartnerApiKey | null;
    partnerName: string;
    onClose: () => void;
}) {
    const [copied, setCopied] = useState(false);
    const [confirmingClose, setConfirmingClose] = useState(false);

    const copy = async () => {
        if (!minted) return;
        try {
            await navigator.clipboard.writeText(minted.plaintext);
        } catch {
            // Clipboard access is refused outside a secure context. The key IS on screen
            // here (unlike the calendar feed URL, which renders masked), so the person can
            // still select it by hand - just tell them rather than failing silently.
            toast.error('Could not copy - select the key and copy it manually');
            return;
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const requestClose = () => {
        // Copying is not proof they stored it, but not copying is near-proof they did not.
        if (!copied) {
            setConfirmingClose(true);
            return;
        }
        onClose();
    };

    return (
        <Dialog
            open={minted !== null}
            // No dismiss on overlay click or Escape: this is the only moment the key
            // exists, and a misclick costs a rotation.
            onOpenChange={open => {
                if (!open) requestClose();
            }}>
            <DialogContent
                showCloseButton={false}
                onInteractOutside={e => e.preventDefault()}
                onEscapeKeyDown={e => e.preventDefault()}
                className='sm:max-w-xl'>
                <DialogHeader>
                    <DialogTitle>Copy this key now</DialogTitle>
                    <DialogDescription>
                        This is the only time it will be shown. We store a hash,
                        so it cannot be recovered later - if {partnerName} loses
                        it, you revoke this key and mint a new one.
                    </DialogDescription>
                </DialogHeader>

                <div className='space-y-3'>
                    <code className='block w-full rounded-md border bg-muted/50 p-3 font-mono text-xs break-all select-all'>
                        {minted?.plaintext}
                    </code>

                    <div className='flex items-center gap-2'>
                        <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            className='w-28'
                            onClick={() => void copy()}>
                            <HugeiconsIcon
                                icon={copied ? Tick02Icon : Copy01Icon}
                                className='size-3.5'
                            />
                            {copied ? 'Copied' : 'Copy key'}
                        </Button>
                        <span className='text-xs text-muted-foreground'>
                            {minted?.environment === 'TEST'
                                ? 'Test key - cannot touch live inventory or money.'
                                : 'Live key - can read real inventory.'}
                        </span>
                    </div>

                    {/* Practical handover advice. Partners routinely ask for keys over
                        email, which is the one channel that guarantees a copy survives in
                        two mailboxes and a backup forever. */}
                    <p className='text-xs text-muted-foreground'>
                        Send it through the partner&apos;s own portal or a
                        secrets tool. Not email, not chat.
                    </p>

                    {confirmingClose && (
                        <div className='rounded-md border border-destructive/40 bg-destructive/5 p-3'>
                            <p className='text-sm font-medium'>
                                Close without copying?
                            </p>
                            <p className='mt-1 text-xs text-muted-foreground'>
                                You will not be able to see this key again. The
                                key stays valid, so you would have to revoke it
                                and mint another.
                            </p>
                            <div className='mt-3 flex gap-2'>
                                <Button
                                    size='sm'
                                    variant='outline'
                                    onClick={() => setConfirmingClose(false)}>
                                    Go back
                                </Button>
                                <Button
                                    size='sm'
                                    variant='destructive'
                                    onClick={onClose}>
                                    Close anyway
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button onClick={requestClose}>
                        {copied ? 'Done' : 'Close'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
