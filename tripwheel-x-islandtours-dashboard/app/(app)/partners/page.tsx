import { PartnersView } from '@/components/partners/partners-view';

export default function PartnersPage() {
    return (
        <div>
            <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
                <div>
                    <h1 className='text-2xl font-medium'>Distribution</h1>
                    <p className='mt-1 max-w-2xl text-sm text-muted-foreground'>
                        Channels that sell our tours through their own
                        marketplace, and the API keys they authenticate with. A
                        key decides which operator&apos;s inventory a partner
                        can see, so it is issued per relationship, never shared.
                    </p>
                </div>
            </div>
            <PartnersView />
        </div>
    );
}
