import { StatusBadge } from '@/components/common/status-badge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { UserProfile } from '@/types/profile';

interface AccountStatusCardProps {
    user: UserProfile;
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
                <CardTitle className='text-sm font-semibold text-primary/80'>
                    Account Status
                </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
                <div className='flex items-center justify-between'>
                    <span className='text-sm text-muted-foreground'>
                        Verification
                    </span>
                    <StatusBadge
                        variant={user?.emailVerified ? 'success' : 'danger'}>
                        {status}
                    </StatusBadge>
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
                        className='font-medium text-2xs bg-background/50'>
                        {accountType}
                    </Badge>
                </div>
            </CardContent>
        </Card>
    );
}

