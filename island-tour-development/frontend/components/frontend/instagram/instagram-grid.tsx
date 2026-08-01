import type { InstagramTile as Tile } from '@/lib/api/public';
import { InstagramTile } from './instagram-tile';

/**
 * The curated band (design v2 .iggrid): square rounded tiles - 2 columns on
 * phones, 3 on tablet, 6 on desktop with tight gutters. Reads as a feed strip
 * rather than a card section.
 */
export function InstagramGrid({ posts }: { posts: Tile[] }) {
    return (
        <div className='grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-6'>
            {posts.map(post => (
                <InstagramTile
                    key={post.id}
                    post={post}
                    className='rounded-it-md'
                    aspectRatio='1 / 1'
                    sizes='(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 190px'
                />
            ))}
        </div>
    );
}
