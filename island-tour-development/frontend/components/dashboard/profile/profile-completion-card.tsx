interface ProfileCompletionCardProps {
    percentage?: number;
}

export function ProfileCompletionCard({
    percentage = 85,
}: ProfileCompletionCardProps) {
    return (
        <div className='p-6 bg-muted/20  border border-dashed border-border/60'>
            <h4 className='text-sm font-semibold mb-3'>Profile Completion</h4>
            <div className='w-full bg-muted rounded-full h-2 mb-2'>
                <div
                    className='bg-primary h-2 rounded-full transition-all duration-500'
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <p className='text-xs text-muted-foreground text-right'>
                {percentage}% Complete
            </p>
        </div>
    );
}

