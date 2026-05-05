import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AccountStatusCardProps {
    status?: string;
    memberSince?: string;
    accountType?: string;
}

export function AccountStatusCard({
    status = 'Verified',
    memberSince = 'May 2024',
    accountType = 'Premium',
}: AccountStatusCardProps) {
    return (
        <Card className='border-none shadow-sm bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl overflow-hidden border-l-4 border-l-primary'>
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
                    <Badge className='bg-success/10 text-success border-success/20 hover:bg-success/20 transition-colors'>
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
                    <Badge variant='outline' className='font-medium'>
                        {accountType}
                    </Badge>
                </div>
            </CardContent>
        </Card>
    );
}

