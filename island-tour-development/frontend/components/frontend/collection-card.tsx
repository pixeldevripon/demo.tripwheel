'use client';

/**
 * Collection card component - styled similarly to TourCard but tailored for
 * Collections (no pricing, no duration).
 */

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { CollectionLocalized } from '@/types/collection';
import { localizeHref, type Locale } from '@/lib/constants/locales';

export interface CollectionCardProps {
    collection: CollectionLocalized;
    locale: Locale;
    destinationSlug: string;
    dict: { explore: string };
    className?: string;
}

export function CollectionCard({ collection, locale, destinationSlug, dict, className = '' }: CollectionCardProps) {
    const [isHovered, setIsHovered] = useState(false);

    const href = localizeHref(locale, `/${destinationSlug}/${collection.slug}`);
    const activeImage = collection.heroImage || '';

    return (
        <Link
            href={href}
            aria-label={collection.name}
            className="block rounded-[16px] @[220px]:rounded-[24px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-it-primary"
        >
            <motion.article
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                animate={{
                    backgroundColor: isHovered ? '#fdf6f0' : '#ffffff',
                }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className={cn(
                    '@container group flex flex-col rounded-[16px] @[220px]:rounded-[24px] overflow-hidden',
                    className
                )}
            >
                {/* ── Image area ──────────────────────────────────────────────── */}
                <motion.div
                    className="relative aspect-[86/74] w-full shrink-0 overflow-hidden bg-it-border @[220px]:aspect-[64/45]"
                    animate={{
                        borderTopLeftRadius: '16px',
                        borderTopRightRadius: '16px',
                        borderBottomLeftRadius: isHovered ? '0px' : '16px',
                        borderBottomRightRadius: isHovered ? '0px' : '16px',
                    }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                >
                    {activeImage && (
                        <Image
                            src={activeImage}
                            alt={collection.name}
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 384px"
                            className="object-cover"
                        />
                    )}
                </motion.div>

                {/* ── Card info ────────────────────────────────────────────────── */}
                <motion.div
                    className={cn('flex flex-col gap-1 pt-3 pb-1 @[220px]:gap-3 @[220px]:pt-4 @[220px]:pb-5', className)}
                    animate={{ paddingLeft: isHovered ? 16 : 0, paddingRight: isHovered ? 16 : 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                >
                    {/* Invisible spacer so the title aligns with where the star row would be */}
                    <div className="flex items-center gap-1 h-4 @[220px]:gap-1.5 @[220px]:h-[22px]" aria-hidden="true">
                        <span className="invisible select-none text-[14px] leading-[1.6]">&nbsp;</span>
                    </div>

                    {/* Collection title */}
                    <h3 className="m-0 font-medium text-[14px] @[220px]:text-[18px] leading-[1.4] tracking-[-0.012em] text-it-heading line-clamp-2">
                        {collection.name}
                    </h3>
                    
                    {/* Collection indicator */}
                    <div className="flex items-center gap-1 mt-1">
                        <span className="text-[12px] @[220px]:text-[14px] leading-[1.6] tracking-[-0.012em] text-it-primary font-medium">
                            {dict.explore}
                        </span>
                        <Image
                            src="/icons/cta-arrow-right.svg"
                            alt=""
                            width={16}
                            height={16}
                            className="size-3 @[220px]:size-4 transition-transform duration-150 group-hover:translate-x-0.5"
                            aria-hidden="true"
                        />
                    </div>
                </motion.div>
            </motion.article>
        </Link>
    );
}
