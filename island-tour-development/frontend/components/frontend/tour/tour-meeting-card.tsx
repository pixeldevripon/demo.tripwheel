import { springPop } from '@/lib/motion';
import Image from 'next/image';
import { MotionA } from '../motion-primitives';

type MapLink = { label: string; href: string };

export type TourMeetingInfo = {
    label: string;
    title: string;
    /** Supports line breaks (rendered pre-line). */
    detail: string;
};

/**
 * Meeting & Pickup panel (Figma 47979:4746): one #f8f8f8 panel with a 10% ink
 * hairline and 24px of padding, holding three labelled blocks - meeting point
 * and hotel pickup stacked on the left, departure time on the right.
 *
 * It was a white card of blocks stacked vertically and separated by hairlines.
 * The hairlines are gone: Figma groups by COLUMN instead, which puts the two
 * facts a traveller needs together (where to be, when to be there) on one line
 * of sight rather than one above the other.
 */
function SubBlock({
    icon,
    info,
    children,
    className,
}: {
    icon: string;
    info: TourMeetingInfo;
    children?: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={`flex flex-col gap-2 ${className ?? ''}`}>
            {/* The label is the quiet one - 14px at 40% ink, uppercased. The
                `uppercase` is a style, not the copy: the dictionary supplies
                sentence case, and a locale that has no capitals is unharmed by
                a CSS transform in a way a hardcoded string would not be. */}
            <h3 className='m-0 flex items-center gap-2 it-meta text-it-heading/40 uppercase '>
                <Image
                    src={icon}
                    alt=''
                    width={24}
                    height={24}
                    className='size-4 shrink-0 lg:size-5'
                />
                {info.label}
            </h3>
            <div className='flex flex-col gap-0.5 ps-7 lg:ps-8'>
                {info.title && (
                    <p className='m-0 it-text font-medium leading-[1.4] text-it-heading '>
                        {info.title}
                    </p>
                )}
                {info.detail && (
                    <p className='m-0 whitespace-pre-line it-text text-it-text-muted '>
                        {info.detail}
                    </p>
                )}
                {children}
            </div>
        </div>
    );
}

export function TourMeetingCard({
    meeting,
    mapLink,
    pickup,
    departure,
}: {
    meeting: TourMeetingInfo;
    /** Google Maps link, shown under the meeting point when coordinates exist. */
    mapLink?: MapLink | null;
    /** Hotel-pickup block, shown only when the tour offers pickup. */
    pickup?: TourMeetingInfo | null;
    /** Departure-time block, shown when start times exist. */
    departure?: TourMeetingInfo | null;
}) {
    return (
        <div className='rounded-[16px] border border-it-heading/10 bg-it-surface p-5 lg:p-6'>
            <div className='flex flex-col gap-6 md:flex-row md:justify-between md:gap-10'>
                <div className='flex min-w-0 flex-col gap-6 md:justify-between'>
                    <SubBlock icon='/icons/tour/mp-location.svg' info={meeting}>
                        {mapLink && (
                            <MotionA
                                href={mapLink.href}
                                target='_blank'
                                rel='noopener noreferrer'
                                whileTap={{ scale: 0.97 }}
                                transition={springPop}
                                className='mt-3 flex w-fit items-center gap-1 it-text font-medium text-it-primary transition-colors duration-300 hover:text-it-primary-hover '>
                                {mapLink.label}
                                <Image
                                    src='/icons/tour/mp-arrow.svg'
                                    alt=''
                                    width={24}
                                    height={24}
                                    className='size-4 shrink-0 lg:size-5'
                                />
                            </MotionA>
                        )}
                    </SubBlock>
                    {pickup && (
                        <SubBlock icon='/icons/tour/mp-car.svg' info={pickup} />
                    )}
                </div>
                {departure && (
                    <SubBlock
                        icon='/icons/tour/mp-clock.svg'
                        info={departure}
                        className='min-w-0 md:w-[274px] md:shrink-0'
                    />
                )}
            </div>
        </div>
    );
}
