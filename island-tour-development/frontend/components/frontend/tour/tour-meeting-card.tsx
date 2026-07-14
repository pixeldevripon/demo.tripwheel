import Image from 'next/image';
import { MotionA } from '../motion-primitives';
import { springPop } from '@/lib/motion';

type MapLink = { label: string; href: string };

export type TourMeetingInfo = {
    label: string;
    title: string;
    /** Supports line breaks (rendered pre-line). */
    detail: string;
};

/**
 * Meeting & Pickup info card (Figma node 47936:3746). A surface card with three
 * labeled blocks - Meeting Point (with an "Open in Google Maps" link), Hotel
 * Pickup, and Departure Time. Each block: an icon + uppercase caption, then a
 * title + muted detail indented under the caption.
 */
function InfoBlock({
    icon,
    info,
    children,
}: {
    icon: string;
    info: TourMeetingInfo;
    children?: React.ReactNode;
}) {
    return (
        <div className='flex flex-col gap-4'>
            <div className='flex flex-col gap-2'>
                <div className='flex items-center gap-2'>
                    <Image
                        src={icon}
                        alt=''
                        width={24}
                        height={24}
                        className='size-6 shrink-0'
                    />
                    <span className='text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading uppercase'>
                        {info.label}
                    </span>
                </div>
                <div className='flex flex-col gap-0.5 pl-8'>
                    <span className='font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                        {info.title}
                    </span>
                    <span className='whitespace-pre-line text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                        {info.detail}
                    </span>
                </div>
            </div>
            {children}
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
    /** Departure-time block (right column), shown when start times exist. */
    departure?: TourMeetingInfo | null;
}) {
    return (
        <div className='rounded-[16px] border border-it-border bg-it-surface p-6'>
            <div className='flex flex-col gap-10 md:flex-row md:gap-10'>
                <div className='flex flex-1 flex-col gap-10'>
                    <InfoBlock icon='/icons/meeting-location.svg' info={meeting}>
                        {mapLink && (
                            <MotionA
                                href={mapLink.href}
                                target='_blank'
                                rel='noopener noreferrer'
                                whileTap={{ scale: 0.97 }}
                                transition={springPop}
                                className='flex w-fit items-center gap-1 pl-8 font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-primary no-underline transition-colors duration-300 hover:text-it-primary-hover'>
                                {mapLink.label}
                                <Image
                                    src='/icons/cta-arrow-right.svg'
                                    alt=''
                                    width={24}
                                    height={24}
                                    className='size-6 shrink-0'
                                />
                            </MotionA>
                        )}
                    </InfoBlock>
                    {pickup && (
                        <InfoBlock icon='/icons/meeting-car.svg' info={pickup} />
                    )}
                </div>
                {departure && (
                    <div className='md:w-68.5'>
                        <InfoBlock
                            icon='/icons/meeting-clock.svg'
                            info={departure}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
