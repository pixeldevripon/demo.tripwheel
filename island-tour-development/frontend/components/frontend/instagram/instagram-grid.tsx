import type { InstagramTile as Tile } from '@/lib/api/public';
import { InstagramTile } from './instagram-tile';

/**
 * The curated band (the Figma design): 2 columns on phones, 3 on desktop,
 * rounded 384x337 cards with generous gutters. Reads as a section OF the page,
 * where the gallery layout reads as a feed embedded in it.
 */
export function InstagramGrid({ posts }: { posts: Tile[] }) {
    return (
        <div className='grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-6'>
            {posts.map(post => (
                <InstagramTile
                    key={post.id}
                    post={post}
                    className='rounded-[16px]'
                    aspectRatio='384 / 337'
                    sizes='(max-width: 768px) 50vw, 33vw'
                />
            ))}
        </div>
    );
}
