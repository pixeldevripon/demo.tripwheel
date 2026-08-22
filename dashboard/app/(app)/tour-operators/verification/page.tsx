import { VerificationQueueView } from '@/components/operators/verification-queue-view';

export default function OperatorVerificationPage() {
    return (
        <div>
            <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
                <div>
                    <h1 className='text-2xl font-medium'>
                        Operator Verification
                    </h1>
                    <p className='text-sm text-muted-foreground mt-1'>
                        Review pending operators - approving sends the
                        &ldquo;You&rsquo;re approved&rdquo; email and unlocks
                        tour creation.
                    </p>
                </div>
            </div>
            <VerificationQueueView />
        </div>
    );
}
