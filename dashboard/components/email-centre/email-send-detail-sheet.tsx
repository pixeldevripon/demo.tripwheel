'use client';

/**
 * Read-only quick view of one send-log row (H-12): every field the global
 * activity list knows, including the outcome trio (providerMessageId /
 * suppressedReason / error) that the table trims. Resend is offered for the
 * onboarding (OB) set only — for those rows the scopeId IS the operator id —
 * behind the same confirm dialog as the WP-E operator timeline.
 */

import { HugeiconsIcon } from '@hugeicons/react';
import { Copy01Icon } from '@hugeicons/core-free-icons';
import { useState } from 'react';
import { toast } from 'sonner';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetBody,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { StatusBadge } from '@/components/common/status-badge';
import {
    emailSendMeta,
    emailStreamMeta,
} from '@/components/common/status-maps';
import {
    Row,
    Section,
    SheetPager,
    type SheetPagerProps,
} from '@/components/common/detail-sheet';
import { useResendFromActivity } from '@/hooks/email-centre/use-email-centre';
import { emailTemplateLabel } from '@/lib/emails/template-labels';
import { formatDate } from '@/lib/utils';
import { isResendableTemplate, type EmailSendRow } from '@/types/email';
import {
    isTestSendRow,
    operatorIdFromScope,
    scopeKind,
} from './email-send-columns';

export function EmailSendDetailSheet({
    send,
    onOpenChange,
    ...pager
}: {
    send: EmailSendRow | null;
    onOpenChange: (open: boolean) => void;
} & SheetPagerProps) {
    return (
        <Sheet open={send !== null} onOpenChange={onOpenChange}>
            <SheetContent className='flex w-full flex-col gap-0 sm:max-w-2xl!'>
                {send && <EmailSendDetailBody send={send} {...pager} />}
            </SheetContent>
        </Sheet>
    );
}

function EmailSendDetailBody({
    send: r,
    onPrev,
    onNext,
    position,
}: { send: EmailSendRow } & SheetPagerProps) {
    const statusMeta = emailSendMeta(r.status);
    const streamMeta = emailStreamMeta(r.stream);
    const [confirmResend, setConfirmResend] = useState(false);

    // OB rows carry the operator id as their scope; a test render of an OB
    // template does not (its scope is `test:<userId>#<n>`), so it is never
    // resendable from here.
    const canResend = isResendableTemplate(r.templateKey) && !isTestSendRow(r);

    const copy = (value: string, message: string) => async () => {
        try {
            await navigator.clipboard.writeText(value);
            toast.success(message);
        } catch {
            toast.error('Failed to copy');
        }
    };

    return (
        <>
            <SheetHeader className='border-b'>
                <div className='flex items-center justify-between gap-3 pr-8'>
                    <div className='min-w-0'>
                        <div className='flex flex-wrap items-center gap-2.5'>
                            <SheetTitle>
                                {emailTemplateLabel(r.templateKey)}
                            </SheetTitle>
                            <StatusBadge
                                variant={statusMeta.variant}
                                hint={statusMeta.hint}>
                                {statusMeta.label}
                            </StatusBadge>
                        </div>
                        <SheetDescription>
                            {r.toEmail} · {formatDate(r.createdAt, 'long')}
                        </SheetDescription>
                    </div>
                    <SheetPager
                        onPrev={onPrev}
                        onNext={onNext}
                        position={position}
                    />
                </div>
            </SheetHeader>

            <SheetBody className='divide-y'>
                <Section label='Email'>
                    <Row
                        label='Template'
                        value={emailTemplateLabel(r.templateKey)}
                    />
                    <Row
                        label='Template key'
                        value={
                            <span className='font-mono text-xs'>
                                {r.templateKey}
                            </span>
                        }
                    />
                    <Row
                        label='Stream'
                        value={
                            <StatusBadge
                                variant={streamMeta.variant}
                                hint={streamMeta.hint}>
                                {streamMeta.label}
                            </StatusBadge>
                        }
                    />
                    <Row
                        label='Locale'
                        value={
                            r.locale ?? (
                                <span className='text-content-muted'>
                                    - (English-only send)
                                </span>
                            )
                        }
                    />
                </Section>

                <Section label='Recipient'>
                    <Row label='To' value={r.toEmail} />
                </Section>

                <Section label='Outcome'>
                    <Row
                        label='Status'
                        value={
                            <StatusBadge
                                variant={statusMeta.variant}
                                hint={statusMeta.hint}>
                                {statusMeta.label}
                            </StatusBadge>
                        }
                    />
                    <Row
                        label='Provider message id'
                        value={
                            r.providerMessageId ? (
                                <span className='inline-flex max-w-full items-center gap-1'>
                                    <span className='min-w-0 break-all font-mono text-xs'>
                                        {r.providerMessageId}
                                    </span>
                                    <Button
                                        variant='ghost'
                                        size='icon-sm'
                                        aria-label='Copy provider message id'
                                        onClick={copy(
                                            r.providerMessageId,
                                            'Provider message id copied',
                                        )}
                                        className='shrink-0 text-content-muted hover:text-foreground'>
                                        <HugeiconsIcon icon={Copy01Icon} />
                                    </Button>
                                </span>
                            ) : (
                                <span className='text-content-muted'>-</span>
                            )
                        }
                    />
                    <Row
                        label='Suppressed reason'
                        value={
                            r.suppressedReason ?? (
                                <span className='text-content-muted'>-</span>
                            )
                        }
                    />
                    <Row
                        label='Error'
                        value={
                            r.error ? (
                                <span className='break-words text-danger-fg'>
                                    {r.error}
                                </span>
                            ) : (
                                <span className='text-content-muted'>-</span>
                            )
                        }
                    />
                </Section>

                <Section label='Scope'>
                    <Row label='Kind' value={scopeKind(r)} />
                    <Row
                        label='Scope id'
                        value={
                            <span className='inline-flex max-w-full items-center gap-1'>
                                <span className='min-w-0 break-all font-mono text-xs'>
                                    {r.scopeId}
                                </span>
                                <Button
                                    variant='ghost'
                                    size='icon-sm'
                                    aria-label='Copy scope id'
                                    onClick={copy(
                                        r.scopeId,
                                        'Scope id copied',
                                    )}
                                    className='shrink-0 text-content-muted hover:text-foreground'>
                                    <HugeiconsIcon icon={Copy01Icon} />
                                </Button>
                            </span>
                        }
                    />
                </Section>

                <Section label='Timeline'>
                    <Row
                        label='Recorded'
                        value={formatDate(r.createdAt, 'long')}
                    />
                </Section>

                {canResend && (
                    <Section label='Actions'>
                        <div className='flex items-center justify-between gap-3 py-1'>
                            <p className='m-0 text-xs text-content-muted'>
                                Sends this onboarding email to the operator
                                again and records a new activity row.
                            </p>
                            <Button
                                variant='outline'
                                size='sm'
                                className='shrink-0'
                                onClick={() => setConfirmResend(true)}>
                                Resend
                            </Button>
                        </div>
                    </Section>
                )}
            </SheetBody>

            <ResendConfirmDialog
                send={r}
                open={confirmResend}
                onClose={() => setConfirmResend(false)}
            />
        </>
    );
}

function ResendConfirmDialog({
    send,
    open,
    onClose,
}: {
    send: EmailSendRow;
    open: boolean;
    onClose: () => void;
}) {
    const { mutate: resend, isPending } = useResendFromActivity();

    function handleResend() {
        resend(
            {
                operatorId: operatorIdFromScope(send.scopeId),
                templateKey: send.templateKey,
            },
            {
                onSuccess: () => {
                    toast.success(
                        `"${emailTemplateLabel(send.templateKey)}" resent to ${send.toEmail}.`,
                    );
                    onClose();
                },
                onError: (err) =>
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to resend the email.',
                    ),
            },
        );
    }

    return (
        <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        Resend &ldquo;{emailTemplateLabel(send.templateKey)}
                        &rdquo;?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        Sends the email again to {send.toEmail} and records a
                        new activity row. Use this when the original bounced
                        or the operator asks for it again.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending}>
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        disabled={isPending}
                        onClick={(e) => {
                            // Keep the dialog open while the request runs.
                            e.preventDefault();
                            handleResend();
                        }}>
                        {isPending ? 'Resending...' : 'Resend email'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
