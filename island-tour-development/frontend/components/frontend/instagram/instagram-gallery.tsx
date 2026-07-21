import type { InstagramTile as Tile } from '@/lib/api/public';
import { InstagramTile } from './instagram-tile';

/**
 * The Instagram profile look: a wall of 4:5 portraits, five columns on desktop
 * and three on phones - one column wider than Instagram's own six-up web
 * profile, because our container is narrower than a full browser window and at
 * six the portraits shrank to stamps.
 *
 * Five and three both divide the gallery's 15-tile default cleanly (3 rows and
 * 5 rows), which is the point: a half-filled last row reads as a loading state
 * in a layout whose whole job is to look like a solid wall. Changing the column
 * count means revisiting `DEFAULT_LIMIT_BY_LAYOUT.GALLERY` in the backend.
 *
 * The radius belongs to the WALL, not the tiles. Rounding each tile would put
 * four curves around every hairline gap and turn a dense sheet into a bag of
 * loose stamps; rounding the container and clipping to it leaves the interior
 * grid crisp and square while the block still sits on the page like every other
 * card. `overflow-hidden` is what does the work - the radius alone does nothing,
 * because each tile paints its own square corner right over it.
 *
 * NOT zoom-on-hover: at a 1px gutter a scaling tile bleeds over its neighbours,
 * and the site's motion rule is that hover is colour/opacity only. The hover dim
 * plus the Instagram mark carries the affordance.
 */
export function InstagramGallery({ posts }: { posts: Tile[] }) {
    return (
        <div className='grid grid-cols-3 gap-px overflow-hidden rounded-[5px] md:grid-cols-5'>
            {posts.map(post => (
                <InstagramTile
                    key={post.id}
                    post={post}
                    aspectRatio='4 / 5'
                    sizes='(max-width: 768px) 33vw, 20vw'
                    zoomOnHover={false}
                />
            ))}
        </div>
    );
}
