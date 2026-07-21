import { getInstagramFeed } from '@/lib/api/public';
import Image from 'next/image';
import { Play } from 'lucide-react';
import { Reveal } from '../reveal';

export type InstagramDict = {
    viewMore: string;
};

/**
 * The brand Instagram grid - handle row + 2 x 3 photo grid (master 3.9).
 *
 * Tiles come from our own data, never a third-party embed: an iframe widget
 * cannot be server-rendered into this prerendered page, and it would drag
 * consent-managed cookies into six EU locales for a decorative strip.
 *
 * Renders NOTHING unless there is a real section to show - the admin kill
 * switch, an empty feed, or a missing handle each remove it entirely. A handle
 * row over an empty grid, or an '@' with no name, looks broken in a way that no
 * section does.
 */
export async function InstagramGrid({
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

                    {/* 2 x 3 photo grid */}
                    <div className='grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-6'>
                        {feed.posts.map(post => (
                            <a
                                key={post.id}
                                href={post.href}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='group relative block overflow-hidden rounded-[16px] bg-it-border'
                                style={{ aspectRatio: '384 / 337' }}
                                aria-label={post.alt}>
                                <Image
                                    src={post.imageUrl}
                                    alt={post.alt}
                                    fill
                                    sizes='(max-width: 768px) 50vw, 33vw'
                                    className='object-cover transition-transform duration-500 ease-out group-hover:scale-105'
                                />
                                {/* Hover overlay */}
                                <div className='absolute inset-0 bg-it-heading/0 transition-colors duration-300 group-hover:bg-it-heading/20' />
                                {/* A video tile shows its poster - nothing plays
                                    in the grid, so it needs to say it is a video. */}
                                {post.mediaType === 'VIDEO' && (
                                    <span className='absolute right-3 top-3 flex size-8 items-center justify-center rounded-it-full bg-it-heading/50'>
                                        <Play
                                            className='size-4 text-it-white'
                                            fill='currentColor'
                                            aria-hidden='true'
                                        />
                                    </span>
                                )}
                            </a>
                        ))}
                    </div>
                </Reveal>
            </div>
        </section>
    );
}
