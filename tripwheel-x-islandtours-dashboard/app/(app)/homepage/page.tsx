import { HomepageEditView } from '@/components/homepage/homepage-edit-view';

/**
 * The homepage is a singleton, so this is a top-level page rather than an
 * entity detail route: there is no list to go back to and no breadcrumb to
 * build, which is why it uses a plain page header instead of EntityDetailShell.
 * Everything below it is the standard entity editor.
 */
export default async function HomepagePage({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string }>;
}) {
    const { tab } = await searchParams;

    return (
        <div>
            <div className='mb-6'>
                <h1 className='text-2xl font-medium'>Homepage</h1>
                <p className='mt-1 text-sm text-muted-foreground'>
                    The copy and imagery on the public homepage. Sections and
                    their layouts are fixed in the site design - what you change
                    here is what goes in them. Anything left blank keeps the
                    copy the site ships with.
                </p>
            </div>
            <HomepageEditView initialTab={tab} />
        </div>
    );
}

