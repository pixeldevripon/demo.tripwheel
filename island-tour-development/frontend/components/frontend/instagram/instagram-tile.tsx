import type { InstagramTile as Tile } from '@/lib/api/public';
import Image from 'next/image';
import { InstagramTileVideo } from './instagram-tile-video';

/**
 * Cloudinary delivery transformations, injected right after `/upload/` - the
 * same trick the Top Experiences reel uses. Tiles top out around 384px wide
 * (768px at 2x), so w_768 + c_limit keeps retina quality without shipping
 * originals. Non-Cloudinary URLs pass through untouched.
 */
const CLD_IMAGE_TX = 'f_auto,q_auto,w_768,c_limit';
const CLD_VIDEO_TX = 'q_auto,vc_auto,w_768,c_limit';

export const cld = (url: string, transform: string) =>
    url.includes('/upload/')
        ? url.replace('/upload/', `/upload/${transform}/`)
        : url;

/**
 * The corner badge, exactly as Instagram marks it: reels get the play glyph,
 * carousels the stacked squares, pinned posts the pin - and a single photo gets
 * NOTHING. A badge on every tile would say "this is a photo" to someone already
 * looking at the photo; the badges exist only where the tile is not what it
 * appears to be (it moves, it has more pages, it is pinned).
 *
 * It is a LABEL, not a control: `pointer-events-none`, so the whole tile stays
 * one outbound link and the glyph can never look like something to click.
 * Pin wins when a post is both, matching Instagram's own precedence.
 */
function TileBadge({ post }: { post: Tile }) {
    const badge = post.mediaType === 'VIDEO' && {
        src: '/icons/instagram-reel.svg',
        label: 'Video',
    };

    if (!badge) return null;

    return (
        <Image
            src={badge.src}
            alt={badge.label}
            width={24}
            height={24}
            // drop-shadow, not a chip: Instagram floats the bare white glyph,
            // and the shadow is what keeps it legible over a pale photo.
            className='pointer-events-none absolute right-2 top-2 size-4 drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)] md:right-2.5 md:top-2.5 md:size-5'
        />
    );
}

/**
 * One tile: poster, optional looping reel, type badge, and the hover state that
 * tells you it opens Instagram. Shared by both layouts so the two can never
 * drift on media handling - they differ only in shape and spacing.
 */
export function InstagramTile({
    post,
    className,
    aspectRatio,
    sizes,
    zoomOnHover = true,
}: {
    post: Tile;
    className?: string;
    aspectRatio: string;
    sizes: string;
    /** The gallery packs tiles edge to edge, where a zoom would clip its neighbours. */
    zoomOnHover?: boolean;
}) {
    const poster = cld(post.imageUrl, CLD_IMAGE_TX);

    return (
        <a
            href={post.href}
            target='_blank'
            rel='noopener noreferrer'
            className={`group relative block overflow-hidden bg-it-border ${className ?? ''}`}
            style={{ aspectRatio }}
            aria-label={post.alt}>
            {/* Base layer. On a reel this is the poster, and it stays mounted
                for the video's whole life, so playback never flashes an empty
                tile. */}
            <Image
                src={poster}
                alt={post.alt}
                fill
                sizes={sizes}
                className={
                    zoomOnHover
                        ? 'object-cover transition-transform duration-500 ease-out group-hover:scale-105'
                        : 'object-cover'
                }
            />

            {post.videoUrl && (
                <InstagramTileVideo
                    src={cld(post.videoUrl, CLD_VIDEO_TX)}
                    poster={poster}
                />
            )}

            <TileBadge post={post} />

            {/* Hover: dim the photo and float the Instagram mark, so the tile
                says where it goes before it is clicked. */}
            <div className='absolute inset-0 flex items-center justify-center bg-it-heading/0 transition-colors duration-300 group-hover:bg-it-heading/35'>
                <Image
                    src='/icons/instagram-tile.svg'
                    alt=''
                    width={10}
                    height={10}
                    className='size-6! opacity-0 transition-opacity duration-300 group-hover:opacity-100 md:size-9'
                />
            </div>
        </a>
    );
}

