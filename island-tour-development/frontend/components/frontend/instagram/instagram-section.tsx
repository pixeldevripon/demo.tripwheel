import { getInstagramFeed } from '@/lib/api/public';
import { Reveal } from '../reveal';
import { InstagramGallery } from './instagram-gallery';
import { InstagramGrid } from './instagram-grid';

export type InstagramDict = {
    viewMore: string;
};

/**
 * The brand Instagram section - handle row plus tiles (master 3.9).
 *
 * Tiles come from our own data, never a third-party embed: an iframe widget
 * cannot be server-rendered into this prerendered page, and it would drag
 * consent-managed cookies into six EU locales for a decorative strip.
 *
 * Renders NOTHING unless there is a real section to show - the admin kill
 * switch, a missing Instagram access token, an empty feed, or a missing handle
 * each remove it entirely. A handle row over an empty grid, or an '@' with no
 * name, looks broken in a way that no section does.
 *
 * The first three arrive folded into `feed.enabled`, decided by the backend. Do
 * not try to re-derive the token case here: this component must never be able to
 * see a credential, and a second copy of the rule would drift from the first.
 *
 * The LAYOUT is admin-chosen (Settings > Instagram) and arrives on the feed
 * payload, so switching it is a content decision rather than a deploy. Both
 * layouts render the same tiles through the same `InstagramTile`; only shape
 * and spacing differ.
 */
export async function InstagramSection({
    dict,
    destination,
}: {
    dict: InstagramDict;
    /** Destination slug - adds that island's pinned tiles to the brand-wide set. */
    destination?: string;
}) {
    const feed = await getInstagramFeed(destination);
    if (!feed.enabled || !feed.username) return null;

    const profileUrl =
        feed.profileUrl ?? `https://www.instagram.com/${feed.username}`;

    return (
        <section className='it-section pt-[32px]! bg-it-white'>
            <div className='it-container'>
                <Reveal className='flex flex-col gap-8 md:gap-10'>
                    {/* Header row - @handle  |  View more on Instagram */}
                    <div className='flex items-center justify-between'>
                        <h2 className='m-0 font-medium text-[28px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                            @{feed.username}
                        </h2>
                        <a
                            href={profileUrl}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='font-medium text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-primary underline decoration-1 underline-offset-4 transition-colors hover:text-it-primary-hover'>
                            {dict.viewMore || 'View more on Instagram'}
                        </a>
                    </div>

                    {feed.layout === 'GALLERY' ? (
                        <InstagramGallery posts={feed.posts} />
                    ) : (
                        <InstagramGrid posts={feed.posts} />
                    )}
                </Reveal>
            </div>
        </section>
    );
}
