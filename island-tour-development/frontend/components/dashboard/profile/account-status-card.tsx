import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AccountStatusCardProps {
    user: any;
}

export function AccountStatusCard({ user }: AccountStatusCardProps) {
    const memberSince = user?.createdAt
        ? new Intl.DateTimeFormat('en-US', {
              month: 'long',
              year: 'numeric',
          }).format(new Date(user.createdAt))
        : 'Unknown';

    const status = user?.emailVerified ? 'Verified' : 'Unverified';
    const accountType = user?.role?.replace('_', ' ') || 'User';

    return (
        <Card className='border-none shadow-sm bg-gradient-to-br from-primary/5 to-primary/10  overflow-hidden border-l-4 border-l-primary'>
            <CardHeader className='pb-3'>
                <CardTitle className='text-sm font-semibold uppercase tracking-wider text-primary/80'>
                    Account Status
                </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
                <div className='flex items-center justify-between'>
                    <span className='text-sm text-muted-foreground'>
                        Verification
                    </span>
                    <Badge
                        className={
                            user?.emailVerified
                                ? 'bg-success/10 text-success border-success/20 hover:bg-success/20 transition-colors'
                                : 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20 transition-colors'
                        }>
                        {status}
                    </Badge>
                </div>
                <div className='flex items-center justify-between'>
                    <span className='text-sm text-muted-foreground'>
                        Member Since
                    </span>
                    <span className='text-sm font-medium'>{memberSince}</span>
                </div>
                <div className='flex items-center justify-between'>
                    <span className='text-sm text-muted-foreground'>
                        Account Type
                    </span>
                    <Badge
                        variant='outline'
                        className='font-medium uppercase text-[10px] tracking-widest bg-background/50'>
                        {accountType}
                    </Badge>
                </div>
            </CardContent>
        </Card>
    );
}

