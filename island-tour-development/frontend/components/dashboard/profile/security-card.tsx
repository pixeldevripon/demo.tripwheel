'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronRight, Lock, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { ChangePasswordDialog } from './change-password-dialog';

export function SecurityCard() {
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

    return (
        <>
            <Card className='border-none shadow-sm bg-card rounded-2xl'>
                <CardHeader className='pb-4'>
                    <CardTitle className='text-lg font-semibold flex items-center gap-2'>
                        <ShieldCheck className='w-5 h-5 text-primary' />
                        Security
                    </CardTitle>
                </CardHeader>
                <CardContent className='space-y-4'>
                    <div
                        onClick={() => setIsPasswordDialogOpen(true)}
                        className='flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors group cursor-pointer border border-transparent hover:border-border'>
                        <div className='flex items-center gap-3'>
                            <div className='p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors'>
                                <Lock className='w-4 h-4 text-primary' />
                            </div>
                            <div>
                                <p className='text-sm font-medium'>
                                    Change Password
                                </p>
                                <p className='text-xs text-muted-foreground'>
                                    Last changed 3 months ago
                                </p>
                            </div>
                        </div>
                        <ChevronRight className='w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform' />
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

