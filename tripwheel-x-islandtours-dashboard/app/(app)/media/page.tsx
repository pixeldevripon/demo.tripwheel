import MediaGalleryManager from '@/components/media/media-gallery-manager';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Media & Files - Island Tours',
    description: 'Organize and manage your uploaded media and files',
};

export default function MediaPage() {
    return <MediaGalleryManager />;
}
