'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon, SecurityCheckIcon, SquareLock02Icon } from '@hugeicons/core-free-icons';

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
            <Card className='border-none shadow-sm bg-card '>
                <CardHeader className='pb-4'>
                    <CardTitle className='text-lg font-semibold flex items-center gap-2'>
                        <HugeiconsIcon icon={SecurityCheckIcon} className='w-5 h-5 text-primary' />
                        Security
                    </CardTitle>
                </CardHeader>
                <CardContent className='space-y-4'>
                    <div
                        onClick={() => setIsPasswordDialogOpen(true)}
                        className='flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors group cursor-pointer border border-transparent hover:border-border'>
                        <div className='flex items-center gap-3'>
                            <div className='p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors'>
                                <HugeiconsIcon icon={SquareLock02Icon} className='w-4 h-4 text-primary' />
                            </div>
                            <div>
                                <p className='text-sm font-medium'>
                                    {hasPassword ? 'Change Password' : 'Set Password'}
                                </p>
                                <p className='text-xs text-muted-foreground'>
                                    {hasPassword ? (
                                        passwordChangedAt ? (
                                            <>Last changed: {formatDate(passwordChangedAt, { year: 'numeric', month: 'short', day: 'numeric' })}</>
                                        ) : (
                                            'Password set but date unknown'
                                        )
                                    ) : (
                                        'No password set yet'
                                    )}
                                </p>
                            </div>
                        </div>
                        <HugeiconsIcon icon={ArrowRight01Icon} className='w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform' />
                    </div>
                </CardContent>
            </Card>

            <ChangePasswordDialog
                open={isPasswordDialogOpen}
                onOpenChange={setIsPasswordDialogOpen}
            />
        </>
    );
}

