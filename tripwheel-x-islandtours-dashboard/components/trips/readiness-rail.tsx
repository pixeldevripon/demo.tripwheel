'use client';

/**
 * Publish-readiness bar (04 §2.2 C, Phase 16; horizontal per user decision
 * 2026-07-17 - the right-rail variant crowded the editor, so readiness now
 * sits inline between the page header and the tabs, full width).
 *
 * Tells the whole truth on every editor tab:
 * - the five PUBLISH checks (mirroring the backend publish gate), each unmet
 *   one linking to the exact tab that fixes it;
 * - the LISTING requirements ("the 6th requirement" the old card omitted) so
 *   "published but invisible" stops being a surprise;
 * - the Publish action, disabled with the remaining count while any publish
 *   check fails. Listing checks never block Publish (warn, don't block).
 *
 * Keeps the literal heading "Publish Readiness" (e2e text contract).
 */

import { Cancel01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { motion } from 'framer-motion';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ReadinessCheck } from '@/lib/trips/readiness';
import type { TripStatus } from '@/types/trip';

interface ReadinessChipProps {
    tripId: string;
    check: ReadinessCheck;
    index: number;
}

function ReadinessChip({ tripId, check, index }: ReadinessChipProps) {
    const chip = (
        <motion.span
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.18,
                delay: index * 0.03,
                ease: [0.25, 1, 0.5, 1],
            }}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap ${
                check.passed
                    ? 'border-line bg-surface text-content-muted'
                    : 'border-danger-border bg-danger-subtle text-danger-fg'
            }`}>
            {check.passed ? (
                <HugeiconsIcon
                    icon={Tick02Icon}
                    size={13}
                    className='text-success-solid shrink-0'
                />
            ) : (
                <HugeiconsIcon
                    icon={Cancel01Icon}
                    size={13}
                    className='shrink-0'
                />
            )}
            {check.label}
        </motion.span>
    );

    if (check.passed) return chip;

    return (
        <Link
            href={`/trips/${tripId}/edit?tab=${check.tab}`}
            className='transition-opacity duration-fast hover:opacity-80'
            title='Go to the tab that fixes this'>
            {chip}
        </Link>
    );
}

interface ReadinessRailProps {
    tripId: string;
    status: TripStatus;
    publishChecks: ReadinessCheck[];
    listingChecks: ReadinessCheck[];
    canManage: boolean;
    onPublish: () => void;
    isPublishing: boolean;
}

export function ReadinessRail({
    tripId,
    status,
    publishChecks,
    listingChecks,
    canManage,
    onPublish,
    isPublishing,
}: ReadinessRailProps) {
    const passedCount = publishChecks.filter(c => c.passed).length;
    const allPassed = passedCount === publishChecks.length;
    const remaining = publishChecks.length - passedCount;
    const isDraft = status === 'DRAFT';

    return (
        <Card size='sm' className='mb-6 py-4'>
            <CardContent className='space-y-3'>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                    <div className='flex items-center gap-3'>
                        <p className='text-sm font-semibold'>
                            Publish Readiness
                        </p>
                        <span
                            className={`text-2xs font-semibold tracking-caps uppercase rounded-full px-2 py-0.5 ${
                                allPassed
                                    ? 'bg-success-subtle text-success-fg'
                                    : 'bg-warning-subtle text-warning-fg'
                            }`}>
                            {passedCount}/{publishChecks.length}
                        </span>
                    </div>

                    {isDraft && canManage && (
                        <div className='flex items-center gap-3'>
                            {!allPassed && (
                                <p className='text-xs text-content-muted'>
                                    {remaining} item
                                    {remaining === 1 ? '' : 's'} left before
                                    this tour can go live.
                                </p>
                            )}
                            <Button
                                size='sm'
                                onClick={onPublish}
                                disabled={!allPassed || isPublishing}>
                                {isPublishing ? 'Publishing...' : 'Publish'}
                            </Button>
                        </div>
                    )}
                </div>

                <div className='flex flex-wrap items-center gap-2'>
                    {publishChecks.map((check, i) => (
                        <ReadinessChip
                            key={check.key}
                            tripId={tripId}
                            check={check}
                            index={i}
                        />
                    ))}
                    <span
                        aria-hidden
                        className='mx-1 hidden h-4 w-px bg-line sm:block'
                    />
                    <span className='text-2xs font-semibold tracking-caps uppercase text-content-subtle'>
                        To be listed
                    </span>
                    {listingChecks.map((check, i) => (
                        <ReadinessChip
                            key={check.key}
                            tripId={tripId}
                            check={check}
                            index={publishChecks.length + i}
                        />
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
