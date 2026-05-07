import { getAllMedia } from '@/app/_actions/mediaActions';
import MediaGalleryManager from '@/components/dashboard/media/media-gallery-manager';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Media & Files — Island Tours',
    description: 'Organize and manage your uploaded media and files',
};

/**
 * Server Component — prefetches media on the server so first paint is
 * populated without a loading spinner. The data is passed as `initialData`
 * to TanStack Query inside MediaGalleryManager, which then keeps it fresh
 * via background refetches (including when the user returns to this tab).
 */
const MediaPage = async () => {
    const res = await getAllMedia('limit=100&page=1');
    const mediaItems = res?.result?.media || [];

    return (
        <div className='space-y-6'>
            <div className='flex items-center justify-between'>
                <div className='space-y-1'>
                    <h1 className='text-2xl font-semibold tracking-tight'>
                        Media &amp; Files
                    </h1>
                    <p className='text-sm text-muted-foreground'>
                        Organize and manage your uploaded media and files
                    </p>
                </div>
            </div>

            {/* Pass SSR data as initialData — TQ renders instantly then refetches */}
            <MediaGalleryManager media={mediaItems} />
        </div>
    );
};

export default MediaPage;
