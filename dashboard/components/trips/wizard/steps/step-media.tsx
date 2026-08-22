'use client';

/**
 * Step 6 - Photos (07 §3).
 *
 * Isolated on its own step because it carries two of the five publish gates,
 * and because photos are the single biggest lever on whether a listing
 * converts. No collapsible sections: there is one job here.
 *
 * The gates render as a single quiet line naming whatever is still missing,
 * never a warning box. "2 more photos to publish" is a target an operator moves
 * toward; "Need at least 5 to publish" in red is a telling-off for not having
 * finished a step they only just started.
 *
 * Images save themselves through the media library the moment they are picked,
 * so this step registers no footer commit - Continue just advances.
 */

import { CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { useRole } from '@/contexts/role-context';
import { useImages, useTripPendingChange } from '@/hooks/trips/use-trips';
import { cn } from '@/lib/utils';
import type { TripListItem } from '@/types/trip';
import { TripImagesTab } from '../../trip-images-tab';
import { WizardStepBody, WizardStepHeader } from '../wizard-step';

const REQUIRED_IMAGES = 5;

interface StepMediaProps {
    trip: TripListItem;
}

export function StepMedia({ trip }: StepMediaProps) {
    // The list is already in cache from the tab below; this reads the same
    // query so the meter and the grid can never disagree.
    const { data: images } = useImages(trip.id);
    const count = images?.length ?? trip.imageCount ?? 0;
    const hasHero = images
        ? images.some(img => img.isHero)
        : !!trip.heroImage;

    return (
        <>
            <WizardStepHeader step='media' aside={<GateLine count={count} hasCover={hasHero} />} />
            <WizardStepBody>
                <StagedGalleryNote trip={trip} />
                <TripImagesTab trip={trip} />
            </WizardStepBody>
        </>
    );
}

/**
 * While photo changes wait for review, this tab shows the operator's
 * PROPOSED gallery, not what travellers see (client review #19) - without
 * this line the two are indistinguishable and edits feel silently ignored.
 */
function StagedGalleryNote({ trip }: { trip: TripListItem }) {
    const { can } = useRole();
    const { data: change } = useTripPendingChange(trip.id);
    // REJECTED counts too: a rejection sends the proposal back, it does not
    // erase it - this tab keeps serving the operator's draft gallery.
    if (
        trip.status !== 'LIVE' ||
        can('MANAGE_TRIPS') ||
        (change?.status !== 'PENDING' && change?.status !== 'REJECTED') ||
        !change.payload.images
    ) {
        return null;
    }
    return (
        <p className='rounded-md bg-warning-subtle px-3 py-2 text-xs text-warning-fg'>
            These photos are your proposed gallery
            {change.status === 'REJECTED'
                ? ' - Island Tours sent this proposal back; editing and saving resubmits it.'
                : ', waiting for Island Tours review - travellers keep seeing the approved photos until then.'}
        </p>
    );
}

/**
 * One quiet line, not a meter plus a chip.
 *
 * A progress bar and a pill sitting side by side spent the most contrast on the
 * page saying "done" - and once both were satisfied they were pure decoration,
 * a green bar next to a green tick reporting nothing that changes. This says
 * only the next thing that is missing, and goes quiet when nothing is.
 */
function GateLine({ count, hasCover }: { count: number; hasCover: boolean }) {
    const missingPhotos = Math.max(0, REQUIRED_IMAGES - count);
    const ready = missingPhotos === 0 && hasCover;

    const message = missingPhotos
        ? `${missingPhotos} more photo${missingPhotos === 1 ? '' : 's'} to publish`
        : hasCover
          ? 'Photos ready'
          : 'Choose a cover photo';

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 text-xs whitespace-nowrap',
                ready ? 'text-content-muted' : 'text-content',
            )}>
            {ready && (
                <HugeiconsIcon
                    icon={CheckmarkCircle02Icon}
                    className='size-3.5 shrink-0 text-success-solid'
                />
            )}
            {message}
        </span>
    );
}
