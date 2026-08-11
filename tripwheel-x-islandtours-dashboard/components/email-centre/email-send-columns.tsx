'use client';

import { type ColumnDef } from '@tanstack/react-table';

import { StatusBadge } from '@/components/common/status-badge';
import {
    emailSendMeta,
    emailStreamMeta,
} from '@/components/common/status-maps';
import { emailTemplateLabel } from '@/lib/emails/template-labels';
import { formatDate } from '@/lib/utils';
import type { EmailSendRow } from '@/types/email';

/** `test:<userId>#<n>` rows are the admin's own sample renders (H-07). */
export function isTestSendRow(row: Pick<EmailSendRow, 'scopeId'>): boolean {
    return row.scopeId.startsWith('test:');
}

/** `...#resend-{n}` rows are admin-triggered re-sends of an OB email. */
export function isResendRow(row: Pick<EmailSendRow, 'scopeId'>): boolean {
    return row.scopeId.includes('#resend-');
}

/**
 * For the OB templates the send-log `scopeId` IS the operator id — a resend
 * appends `#resend-{n}`, so strip from the first `#`. Never valid for test
 * rows (`test:<userId>#<n>`), which the caller excludes first.
 */
export function operatorIdFromScope(scopeId: string): string {
    return scopeId.split('#')[0];
}

/** Human word for what the scope id points at, next to the raw id. */
export function scopeKind(row: EmailSendRow): string {
    if (isTestSendRow(row)) return 'Test send';
    if (row.templateKey.startsWith('OB') || row.templateKey.startsWith('INT'))
        return 'Operator';
    if (
        row.templateKey.startsWith('BK') ||
        row.templateKey.startsWith('CX') ||
        row.templateKey.startsWith('MK')
    )
        return 'Booking';
    return 'Scope';
}

export function makeEmailSendColumns(): ColumnDef<EmailSendRow>[] {
    return [
        {
            accessorKey: 'templateKey',
            header: 'Email',
            cell: ({ row }) => {
                const r = row.original;
                return (
                    <div className='min-w-0'>
                        <span className='flex flex-wrap items-center gap-2 text-sm font-medium'>
                            {emailTemplateLabel(r.templateKey)}
                            {isTestSendRow(r) && (
                                <span className='text-2xs uppercase tracking-caps text-content-muted'>
                                    Test
                                </span>
                            )}
                            {isResendRow(r) && (
                                <span className='text-2xs uppercase tracking-caps text-content-muted'>
                                    Resend
                                </span>
                            )}
                        </span>
                        <span className='font-mono text-xs text-muted-foreground'>
                            {r.templateKey}
                        </span>
                    </div>
                );
            },
            enableSorting: false,
        },
        {
            accessorKey: 'stream',
            header: 'Stream',
            cell: ({ row }) => {
                const meta = emailStreamMeta(row.original.stream);
                return (
                    <StatusBadge variant={meta.variant} hint={meta.hint}>
                        {meta.label}
                    </StatusBadge>
                );
            },
            enableSorting: false,
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const meta = emailSendMeta(row.original.status);
                return (
                    <StatusBadge variant={meta.variant} hint={meta.hint}>
                        {meta.label}
                    </StatusBadge>
                );
            },
            enableSorting: false,
        },
        {
            accessorKey: 'toEmail',
            header: 'Recipient',
            cell: ({ row }) => (
                <span className='block max-w-52 truncate text-sm'>
                    {row.original.toEmail}
                </span>
            ),
            enableSorting: false,
        },
        {
            accessorKey: 'scopeId',
            header: 'Scope',
            cell: ({ row }) => {
                const r = row.original;
                return (
                    <div className='min-w-0'>
                        <span className='block text-xs text-muted-foreground'>
                            {scopeKind(r)}
                        </span>
                        <span
                            className='block max-w-40 truncate font-mono text-xs'
                            title={r.scopeId}>
                            {r.scopeId}
                        </span>
                    </div>
                );
            },
            enableSorting: false,
        },
        {
            accessorKey: 'createdAt',
            header: 'Date',
            cell: ({ row }) => (
                <span className='whitespace-nowrap text-sm'>
                    {formatDate(row.original.createdAt, 'long')}
                </span>
            ),
            enableSorting: false,
        },
    ];
}
