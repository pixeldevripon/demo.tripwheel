import MediaGalleryManager from '@/components/media/media-gallery-manager';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Media & Files - Island Tours',
    description: 'Organize and manage your uploaded media and files',
};

export default function MediaPage() {
    return (
        <div>
            <div className='flex items-center justify-between mb-6'>
                <div>
                    <h1 className='text-2xl font-semibold uppercase tracking-wider'>
                        Media &amp; Files
                    </h1>
                    <p className='text-sm text-muted-foreground mt-1'>
                        Organize and manage your uploaded media and files
                    </p>
                </div>
            </div>
            <MediaGalleryManager />
        </div>
    );
}
