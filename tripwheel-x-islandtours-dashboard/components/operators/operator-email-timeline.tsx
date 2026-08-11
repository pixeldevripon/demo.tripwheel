'use client';

/**
 * The operator email timeline (WP-E): every send-log row for one operator -
 * onboarding sequence, approval email, internal sales alerts - newest first,
 * with status badge, sent-at, and the suppression/error line when a row
 * deliberately or accidentally did not go out.
 *
 * Rendered in two places (E-21): the verification queue's detail sheet and
 * the operator edit page. Resend is offered per-row for the onboarding (OB)
 * set only, behind a confirm dialog; the endpoint is WP-D's
 * `POST /operators/:id/emails/:templateKey/resend`.
 */

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
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/common/status-badge';
import { emailSendMeta } from '@/components/common/status-maps';
import { Section } from '@/components/common/detail-sheet';
import {
    useOperatorEmails,
    useResendEmail,
} from '@/hooks/emails/use-operator-emails';
import { emailTemplateLabel } from '@/lib/emails/template-labels';
import { formatDate } from '@/lib/utils';
import { isResendableTemplate, type EmailSendRow } from '@/types/email';

export function OperatorEmailTimeline({
    operatorId,
    canResend,
}: {
    operatorId: string;
    /** MANAGE_OPERATORS - gates the per-row Resend action. */
    canResend: boolean;
}) {
    const { data: rows, isLoading, isError } = useOperatorEmails(operatorId);
    const [resendTarget, setResendTarget] = useState<EmailSendRow | null>(null);

    return (
        <Section label='Email timeline'>
            {isLoading ? (
                <div className='space-y-2 py-1'>
                    <Skeleton className='h-9 w-full' />
                    <Skeleton className='h-9 w-full' />
                    <Skeleton className='h-9 w-full' />
                </div>
            ) : isError ? (
                <p className='m-0 py-1 text-sm text-content-muted'>
                    Could not load the email timeline.
                </p>
            ) : !rows || rows.length === 0 ? (
                <p className='m-0 py-1 text-sm text-content-muted'>
                    No emails recorded for this operator yet.
                </p>
            ) : (
                <div className='divide-y'>
                    {rows.map(row => (
                        <EmailTimelineRow
                            key={row.id}
                            row={row}
                            canResend={canResend}
                            onResend={setResendTarget}
                        />
                    ))}
                </div>
            )}

            <ResendConfirmDialog
                operatorId={operatorId}
                target={resendTarget}
                onClose={() => setResendTarget(null)}
            />
        </Section>
    );
}

function EmailTimelineRow({
    row,
    canResend,
    onResend,
}: {
    row: EmailSendRow;
    canResend: boolean;
    onResend: (row: EmailSendRow) => void;
}) {
    const meta = emailSendMeta(row.status);
    const isResend = row.scopeId.includes('#resend-');

    return (
        <div className='flex items-start justify-between gap-3 py-2'>
            <div className='min-w-0'>
                <div className='flex flex-wrap items-center gap-2'>
                    <span className='text-sm font-medium'>
                        {emailTemplateLabel(row.templateKey)}
                    </span>
                    {isResend && (
                        <span className='text-2xs uppercase tracking-caps text-content-muted'>
                            Resend
                        </span>
                    )}
                    <StatusBadge variant={meta.variant} hint={meta.hint}>
                        {meta.label}
                    </StatusBadge>
                </div>
                <p className='m-0 mt-0.5 text-xs text-content-muted'>
                    {formatDate(row.createdAt, 'long')} · {row.toEmail}
                </p>
                {row.status === 'SUPPRESSED' && row.suppressedReason && (
                    <p className='m-0 mt-0.5 text-xs text-content-muted'>
                        Suppressed: {row.suppressedReason}
                    </p>
                )}
                {row.status === 'FAILED' && row.error && (
                    <p className='m-0 mt-0.5 text-xs text-danger-fg break-words'>
                        Error: {row.error}
                    </p>
                )}
            </div>
            {canResend && isResendableTemplate(row.templateKey) && (
                <Button
                    variant='outline'
                    size='sm'
                    className='shrink-0'
                    onClick={() => onResend(row)}>
                    Resend
                </Button>
            )}
        </div>
    );
}

function ResendConfirmDialog({
    operatorId,
    target,
    onClose,
}: {
    operatorId: string;
    target: EmailSendRow | null;
    onClose: () => void;
}) {
    const { mutate: resend, isPending } = useResendEmail();

    function handleResend() {
        if (!target) return;
        resend(
            { operatorId, templateKey: target.templateKey },
            {
                onSuccess: () => {
                    toast.success(
                        `"${emailTemplateLabel(target.templateKey)}" resent to ${target.toEmail}.`,
                    );
                    onClose();
                },
                onError: err =>
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to resend the email.',
                    ),
            },
        );
    }

    return (
        <AlertDialog open={!!target} onOpenChange={o => !o && onClose()}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        Resend &ldquo;
                        {target ? emailTemplateLabel(target.templateKey) : ''}
                        &rdquo;?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        Sends the email again to {target?.toEmail} and records
                        a new timeline row. Use this when the original bounced
                        or the operator asks for it again.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending}>
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        disabled={isPending}
                        onClick={e => {
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
