import { getAllMedia } from '@/app/_actions/mediaActions';
import MediaGalleryManager from '@/components/dashboard/media/media-gallery-manager';

const MediaPage = async () => {
    // Prefetch on the server so the first paint is populated
    const res = await getAllMedia('limit=100&page=1');
    const mediaItems = res?.result?.media || [];

    console.log(`media responses`, res);

    console.log(`mediaItems`, mediaItems);

    return (
        <div className='space-y-6'>
            <div className='flex items-center justify-between'>
                <div className='space-y-1'>
                    <h1 className='text-2xl font-semibold tracking-tight'>
                        Media & Files
                    </h1>
                    <p className='text-sm text-muted-foreground'>
                        Organize and manage your uploaded media and files
                    </p>
                </div>
            </div>

            <MediaGalleryManager media={mediaItems} />
        </div>
    );
};

export default MediaPage;

