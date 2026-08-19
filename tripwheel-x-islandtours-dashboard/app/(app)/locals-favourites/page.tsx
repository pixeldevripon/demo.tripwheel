import { LocalsFavouritesView } from '@/components/locals-favourites/locals-favourites-view';

export default function LocalsFavouritesPage() {
    return (
        <div>
            <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
                <div>
                    <h1 className='text-2xl font-medium'>
                        Locals&apos; Favourites
                    </h1>
                    <p className='text-sm text-muted-foreground mt-1'>
                        Curate the editorial Locals&apos; favourite flag. Manual
                        selection only — never tier-linked. Target ~30% of live
                        tours.
                    </p>
                </div>
            </div>
            <LocalsFavouritesView />
        </div>
    );
}

