import Image from 'next/image';

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
        <section className='bg-it-white pt-11 md:pt-14 pb-11 md:pb-16'>
            <div className='it-container'>
                <Reveal className='flex flex-col gap-4'>
                    {/* Handle row (design v2 .ighead): dark mark + @handle,
                        follow link on the right. */}
                    <div className='flex items-center gap-3'>
                        <span className='flex size-10 shrink-0 items-center justify-center rounded-it-md bg-it-dark'>
                            <Image
                                src='/icons/instagram-mark.svg'
                                alt=''
                                width={24}
                                height={24}
                                className='size-5'
                            />
                        </span>
                        <h2 className='m-0 font-it-body text-[15.5px] font-bold leading-[1.4] text-it-ink'>
                            @{feed.username}
                        </h2>
                        <a
                            href={profileUrl}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='ml-auto text-[13.5px] font-bold text-it-primary-hover underline underline-offset-[3px] whitespace-nowrap'>
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
