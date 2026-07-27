'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon } from '@hugeicons/core-free-icons';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { authClient } from '@/lib/auth-client';
import { formatDate } from '@/utils/intl-utils';
import { useState } from 'react';
import { ChangePasswordDialog } from './change-password-dialog';

export function SecurityCard() {
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
    const { data: session } = authClient.useSession();
    const user = session?.user;
    const hasPassword = (user as any)?.hasPassword;
    const passwordChangedAt = (user as any)?.passwordChangedAt;

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Security</CardTitle>
                </CardHeader>
                <CardContent>
                    <button
                        type='button'
                        onClick={() => setIsPasswordDialogOpen(true)}
                        className='group flex w-full cursor-pointer items-center justify-between rounded-lg border border-line px-4 py-3 text-left transition-colors hover:bg-muted/50'>
                        <div>
                            <p className='text-sm font-medium'>
                                {hasPassword
                                    ? 'Change Password'
                                    : 'Set Password'}
                            </p>
                            <p className='mt-0.5 text-xs text-muted-foreground'>
                                {hasPassword
                                    ? passwordChangedAt
                                        ? `Last changed ${formatDate(passwordChangedAt, { year: 'numeric', month: 'short', day: 'numeric' })}`
                                        : 'Password is set'
                                    : 'No password set yet'}
                            </p>
                        </div>
                        <HugeiconsIcon
                            icon={ArrowRight01Icon}
                            className='size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5'
                        />
                    </button>
                </CardContent>
            </Card>

            <ChangePasswordDialog
                open={isPasswordDialogOpen}
                onOpenChange={setIsPasswordDialogOpen}
            />
        </>
    );
}
