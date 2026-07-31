'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { crossFade, springPop } from '@/lib/motion';

export type TourGalleryMeta = {
    /** Icon path in /public/icons (Figma SVG export). */
    icon: string;
    label: string;
};

/**
 * One gallery photo with the text that describes it.
 *
 * `alt` is resolved on the server (media library, per locale, falling back to
 * the tour title) because this component is a client leaf and the media loader
 * is server-only. Every photo used to share the single tour title, so a gallery
 * of twelve announced the same sentence twelve times.
 */
export type TourGalleryImage = {
    url: string;
    alt: string;
};

/**
 * Tour photo gallery + meta strip (Figma node 47940:12742).
 *
 * Desktop: a 5-tile collage - one large tile (396x448) plus a 2x2 grid of small
 * tiles (190x220), 8px gaps, with a "Show all photos" pill anchored bottom-right.
 * Mobile: the large tile alone (the 4 small tiles are hidden). Beneath sits the
 * meta strip (duration / pickup / languages) between two hairline dividers.
 *
 * Any tile (or "Show all photos") opens a full-screen lightbox over the whole
 * image set, navigable by arrows / keyboard, dismissed by the close button,
 * Escape, or a backdrop click.
 */
export function TourGallery({
    images,
    title,
    meta,
    showAllPhotosLabel,
}: {
    images: TourGalleryImage[];
    title: string;
    meta: TourGalleryMeta[];
    showAllPhotosLabel: string;
}) {
    const [hero, ...rest] = images.slice(0, 5);
    const [open, setOpen] = useState(false);
    const [index, setIndex] = useState(0);
    // Inline mobile slider position (desktop shows the full collage instead).
    const [slide, setSlide] = useState(0);
    const slidePrev = () =>
        setSlide(i => (i === 0 ? images.length - 1 : i - 1));
    const slideNext = () =>
        setSlide(i => (i === images.length - 1 ? 0 : i + 1));

    const openAt = (i: number) => {
        setIndex(i);
        setOpen(true);
    };
    const close = useCallback(() => setOpen(false), []);
    const prev = useCallback(
        () => setIndex(i => (i === 0 ? images.length - 1 : i - 1)),
        [images.length],
    );
    const next = useCallback(
        () => setIndex(i => (i === images.length - 1 ? 0 : i + 1)),
        [images.length],
    );

    // While the lightbox is open: lock body scroll + wire keyboard nav.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close();
            else if (e.key === 'ArrowLeft') prev();
            else if (e.key === 'ArrowRight') next();
        };
        document.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [open, close, prev, next]);

    const tileClass =
        'group relative cursor-pointer overflow-hidden rounded-[16px] border-none bg-it-border p-0';

    return (
        <div className='flex flex-col gap-6'>
            {/* Mobile: swipeable single-image slider (prev/next + dots), like the
                tour card. Tapping the image opens the full-screen lightbox. */}
            <div className='relative aspect-396/300 w-full overflow-hidden rounded-[16px] bg-it-border lg:hidden'>
                <button
                    type='button'
                    onClick={() => openAt(slide)}
                    aria-label={title}
                    className='absolute inset-0 cursor-pointer border-none bg-transparent p-0'>
                    <motion.div
                        key={slide}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={crossFade}
                        className='absolute inset-0'>
                        <Image
                            src={images[slide].url}
                            alt={images[slide].alt}
                            fill
                            // Both gallery layouts render in the DOM (CSS picks
                            // one), and both start from images[0]. Matching
                            // `sizes` here and on the desktop hero tile makes
                            // them resolve to the SAME srcset candidate at any
                            // given viewport, so the one preload below serves
                            // whichever layout is actually visible. With a bare
                            // `100vw` the desktop tile wanted a different (much
                            // smaller) candidate and the preload was wasted.
                            sizes='(min-width: 1024px) 396px, 100vw'
                            className='object-cover'
                            priority
                        />
                    </motion.div>
                </button>
                {images.length > 1 && (
                    <>
                        <motion.button
                            type='button'
                            onClick={slidePrev}
                            aria-label='Previous photo'
                            whileTap={{ scale: 0.9 }}
                            transition={springPop}
                            className='absolute top-1/2 left-3 z-10 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-it-full border-none bg-it-white shadow-it-sm'>
                            <Image
                                src='/icons/arrow-right-listings.svg'
                                alt=''
                                width={24}
                                height={24}
                            />
                        </motion.button>
                        <motion.button
                            type='button'
                            onClick={slideNext}
                            aria-label='Next photo'
                            whileTap={{ scale: 0.9 }}
                            transition={springPop}
                            className='absolute top-1/2 right-3 z-10 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-it-full border-none bg-it-white shadow-it-sm'>
                            <Image
                                src='/icons/arrow-right-listings.svg'
                                alt=''
                                width={24}
                                height={24}
                                className='rotate-180'
                            />
                        </motion.button>
                        {/* Position indicator. Dots only for small sets - a
                            22-photo tour would render a dot row wider than the
                            phone screen, colliding with the "Show all photos"
                            pill. Larger sets get a compact counter chip at the
                            bottom-left instead (clear of arrows and the pill). */}
                        {images.length <= 6 ? (
                            <div className='absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5'>
                                {images.map((_, i) => (
                                    <motion.button
                                        type='button'
                                        key={i}
                                        onClick={() => setSlide(i)}
                                        aria-label={`Go to photo ${i + 1}`}
                                        whileTap={{ scale: 0.9 }}
                                        transition={springPop}
                                        className={`h-2 cursor-pointer rounded-it-full border-none p-0 transition-all duration-300 ${
                                            i === slide ? 'w-6 bg-it-white' : 'w-2 bg-it-white/60'
                                        }`}
                                    />
                                ))}
                            </div>
                        ) : (
                            <span className='absolute bottom-3 left-3 z-10 rounded-it-full bg-it-ink/60 px-2.5 py-1 text-[12px] leading-[1.4] tracking-[-0.012em] text-it-white tabular-nums'>
                                {slide + 1} / {images.length}
                            </span>
                        )}
                    </>
                )}
                {/* "Show all photos" - bottom-right of the slider. Compact on
                    the phone (smaller type/icon/padding than the desktop
                    collage pill) so it reads as a chip over the photo instead
                    of crowding the arrows and indicator. */}
                <motion.button
                    type='button'
                    onClick={() => openAt(slide)}
                    whileTap={{ scale: 0.97 }}
                    transition={springPop}
                    className='absolute right-3 bottom-3 z-10 inline-flex cursor-pointer items-center gap-1.5 rounded-it-full border border-it-border bg-it-white px-2.5 py-1.5 font-medium text-[13px] leading-[1.4] tracking-[-0.012em] text-it-primary transition-colors duration-300 hover:bg-it-surface'>
                    <Image
                        src='/icons/gallery-photos.svg'
                        alt=''
                        width={24}
                        height={24}
                        className='size-5 shrink-0'
                    />
                    {showAllPhotosLabel}
                </motion.button>
            </div>

            {/* Desktop: 5-tile collage - big tile + 2x2 small tiles. */}
            <div className='relative hidden gap-2 lg:grid lg:aspect-792/448 lg:grid-cols-[396fr_190fr_190fr] lg:grid-rows-2'>
                <motion.button
                    type='button'
                    onClick={() => openAt(0)}
                    aria-label={hero?.alt ?? title}
                    whileTap={{ scale: 0.98 }}
                    transition={springPop}
                    className={`${tileClass} lg:row-span-2`}>
                    {hero && (
                        <Image
                            src={hero.url}
                            alt={hero.alt}
                            fill
                            // Must match the mobile hero's `sizes` - see there.
                            sizes='(min-width: 1024px) 396px, 100vw'
                            className='object-cover transition-transform duration-500 ease-out group-hover:scale-105'
                            // This is the LCP element on desktop. Same URL as
                            // the mobile hero at any viewport, so the browser
                            // dedupes the two preloads into one fetch.
                            priority
                        />
                    )}
                </motion.button>
                {rest.map((img, i) => (
                    <motion.button
                        type='button'
                        key={i}
                        onClick={() => openAt(i + 1)}
                        aria-label={img.alt || `${title} - photo ${i + 2}`}
                        whileTap={{ scale: 0.98 }}
                        transition={springPop}
                        className={tileClass}>
                        <Image
                            src={img.url}
                            // Empty on purpose: the wrapping button already
                            // carries the description as its aria-label, and
                            // repeating it here announces the photo twice.
                            alt=''
                            fill
                            sizes='190px'
                            className='object-cover transition-transform duration-500 ease-out group-hover:scale-105'
                        />
                    </motion.button>
                ))}
                {/* "Show all photos" - bottom-right of the collage. */}
                <motion.button
                    type='button'
                    onClick={() => openAt(0)}
                    whileTap={{ scale: 0.97 }}
                    transition={springPop}
                    className='absolute right-3 bottom-3 z-10 inline-flex cursor-pointer items-center gap-2 rounded-it-full border border-it-border bg-it-white px-3 py-1.75 font-medium text-[16px] leading-[1.4] tracking-[-0.012em] text-it-primary transition-colors duration-300 hover:bg-it-surface'>
                    <Image
                        src='/icons/gallery-photos.svg'
                        alt=''
                        width={24}
                        height={24}
                        className='size-6 shrink-0'
                    />
                    {showAllPhotosLabel}
                </motion.button>
            </div>

            {/* Meta strip: duration / pickup / languages between hairlines. */}
            <div className='flex flex-col gap-2'>
                <div className='h-px w-full bg-it-heading/10' />
                <div className='flex flex-wrap items-center gap-x-10 gap-y-2 py-1.5'>
                    {meta.map(m => (
                        <span key={m.label} className='flex items-center gap-2'>
                            <Image
                                src={m.icon}
                                alt=''
                                width={24}
                                height={24}
                                className='size-6 shrink-0'
                            />
                            <span className='text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                {m.label}
                            </span>
                        </span>
                    ))}
                </div>
                <div className='h-px w-full bg-it-heading/10' />
            </div>

            {/* Full-screen lightbox */}
            <AnimatePresence>
            {open && (
                <motion.div
                    role='dialog'
                    aria-modal='true'
                    aria-label={title}
                    onClick={close}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={crossFade}
                    className='fixed inset-0 z-100 flex flex-col bg-black/95'>
                    {/* Top bar: counter + close */}
                    <div
                        className='flex items-center justify-between px-4 py-4 text-it-white md:px-6'
                        onClick={e => e.stopPropagation()}>
                        <span className='text-[14px] leading-[1.6] tracking-[-0.012em] tabular-nums'>
                            {index + 1} / {images.length}
                        </span>
                        <motion.button
                            type='button'
                            onClick={close}
                            aria-label='Close'
                            whileTap={{ scale: 0.9 }}
                            transition={springPop}
                            className='grid size-10 cursor-pointer place-items-center rounded-it-full border-none bg-white/10 text-it-white transition-colors duration-300 hover:bg-white/20'>
                            <X className='size-5' />
                        </motion.button>
                    </div>

                    {/* Stage */}
                    <div className='relative flex flex-1 items-center justify-center px-4 pb-6 md:px-16'>
                        {images.length > 1 && (
                            <motion.button
                                type='button'
                                onClick={e => {
                                    e.stopPropagation();
                                    prev();
                                }}
                                aria-label='Previous photo'
                                whileTap={{ scale: 0.9 }}
                                transition={springPop}
                                className='absolute left-3 z-10 grid size-10 cursor-pointer place-items-center rounded-it-full border-none bg-white/10 text-it-white transition-colors duration-300 hover:bg-white/20 md:size-12'>
                                <ChevronLeft className='size-6' />
                            </motion.button>
                        )}
                        <div
                            className='relative h-full w-full max-w-5xl'
                            onClick={e => e.stopPropagation()}>
                            <motion.div
                                key={index}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={crossFade}
                                className='absolute inset-0'>
                                <Image
                                    src={images[index].url}
                                    alt={
                                        images[index].alt ||
                                        `${title} - photo ${index + 1}`
                                    }
                                    fill
                                    sizes='100vw'
                                    className='object-contain'
                                    priority
                                />
                            </motion.div>
                        </div>
                        {images.length > 1 && (
                            <motion.button
                                type='button'
                                onClick={e => {
                                    e.stopPropagation();
                                    next();
                                }}
                                aria-label='Next photo'
                                whileTap={{ scale: 0.9 }}
                                transition={springPop}
                                className='absolute right-3 z-10 grid size-10 cursor-pointer place-items-center rounded-it-full border-none bg-white/10 text-it-white transition-colors duration-300 hover:bg-white/20 md:size-12'>
                                <ChevronRight className='size-6' />
                            </motion.button>
                        )}
                    </div>
                </motion.div>
            )}
            </AnimatePresence>
        </div>
    );
}
