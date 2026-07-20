import { HomepageEditView } from '@/components/homepage/homepage-edit-view';

export default async function HomepagePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;

  return (
    <div>
      <div className='mb-6 flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-semibold'>Homepage</h1>
          <p className='mt-1 text-sm text-muted-foreground'>
            The copy and imagery on the public homepage. Sections and their
            layouts are fixed in the site design - what you change here is
            what goes in them. Anything left blank keeps the copy the site
            ships with.
          </p>
        </div>
      </div>
      <HomepageEditView initialTab={tab} />
    </div>
  );
}
