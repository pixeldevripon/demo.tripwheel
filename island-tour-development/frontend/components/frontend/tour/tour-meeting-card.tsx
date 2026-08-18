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
 * Meeting & Pickup card (design v2 .mpcard, LD19): a white bordered card of
 * STACKED sub-blocks separated by hairlines. Each block: a 15px bold h3 with
 * an 18px orange icon, then the body copy; the meeting block carries the
 * "Open in Google Maps" text link (no embedded map).
 */
function SubBlock({
    icon,
    info,
    children,
}: {
    icon: string;
    info: TourMeetingInfo;
    children?: React.ReactNode;
}) {
    return (
        <div className='flex flex-col px-5 py-[18px]'>
            <h3 className='m-0 mb-1.5 flex items-center gap-[9px] text-[15px] leading-[1.6] text-it-ink'>
                <Image
                    src={icon}
                    alt=''
                    width={24}
                    height={24}
                    className='size-[18px] shrink-0'
                />
                {info.label}
            </h3>
            {(info.title || info.detail) && (
                <p className='m-0 whitespace-pre-line text-[14px] leading-[1.6] text-it-ink'>
                    {[info.title, info.detail].filter(Boolean).join('\n')}
                </p>
            )}
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
    /** Departure-time block, shown when start times exist. */
    departure?: TourMeetingInfo | null;
}) {
    return (
        <div className='mt-1 divide-y divide-it-divider rounded-it-lg border border-it-border bg-it-white shadow-it-sm'>
            <SubBlock icon='/icons/qi-pin.svg' info={meeting}>
                {mapLink && (
                    <MotionA
                        href={mapLink.href}
                        target='_blank'
                        rel='noopener noreferrer'
                        whileTap={{ scale: 0.97 }}
                        transition={springPop}
                        className='mt-2 flex w-fit items-center gap-[7px] text-[13.5px] font-medium leading-[1.6] text-it-primary-hover underline underline-offset-[3px] transition-colors duration-300 hover:text-it-primary'>
                        <Image
                            src='/icons/pin-deep.svg'
                            alt=''
                            width={24}
                            height={24}
                            className='size-[15px] shrink-0'
                        />
                        {mapLink.label}
                    </MotionA>
                )}
            </SubBlock>
            {pickup && <SubBlock icon='/icons/qi-car.svg' info={pickup} />}
            {departure && (
                <SubBlock icon='/icons/qi-clock.svg' info={departure} />
            )}
        </div>
    );
}

