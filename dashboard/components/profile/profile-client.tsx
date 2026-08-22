'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import {
    Building02Icon,
    SquareLock02Icon,
    UserIcon,
} from '@hugeicons/core-free-icons';

import { ProfileSkeleton } from '@/components/skeletons/profile-skeleton';
import { useRole } from '@/contexts/role-context';
import { useEmailChangeLanding } from '@/hooks/profile/use-email-change-landing';
import { useProfileQuery } from '@/hooks/profile/use-profile';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { AccountSection } from './account-section';
import { CompanySection } from './company-section';
import { SecuritySection } from './security-section';

type ProfileSection = 'account' | 'company' | 'security';

type NavItem = {
    key: ProfileSection;
    label: string;
    icon: typeof UserIcon;
};

/**
 * Profile page, Webflow-settings style (2026-07-28 redesign): a slim
 * nav-only left rail beside a flat content column whose sections are
 * separated by hairlines - no cards, no shadows. Deliberately minimal: no
 * identity header or back affordance up here (the shell's sidebar and header
 * already carry both). Sections are client state, not routes: the page is
 * small enough that splitting it into URLs would only slow navigation down.
 */
export function ProfileClient() {
    const { data: user, isLoading } = useProfileQuery();
    const { can } = useRole();
    const [section, setSection] = useState<ProfileSection>('account');

    // Toast the outcome when the user arrives from a change-email link
    // (?email_change=1 / ?error=... appended by the backend redirect).
    useEmailChangeLanding(user?.email);

    // Company information lives here since 2026-07-28 (it used to be a
    // Settings tab). Same role split `SettingsClient` used: admins own the
    // platform legal entity, operators own their business. Anyone who is
    // neither - a plain user, a seat with no operator record - never sees it.
    const operatorId = user?.operator?.id;
    const showCompany =
        can('VIEW_SETTINGS') ||
        (!!operatorId && can('EDIT_OPERATOR_PROFILE'));

    if (isLoading) return <ProfileSkeleton />;
    if (!user) return <div>Error loading profile. Please try again.</div>;

    const navItems: NavItem[] = [
        { key: 'account', label: 'Account', icon: UserIcon },
        ...(showCompany
            ? [
                  {
                      key: 'company' as const,
                      // Admins edit the platform's legal entity, operators
                      // their own business - the label says which.
                      label: can('VIEW_SETTINGS') ? 'Company' : 'Business',
                      icon: Building02Icon,
                  },
              ]
            : []),
        { key: 'security', label: 'Security', icon: SquareLock02Icon },
    ];

    return (
        <div className='w-full max-w-5xl pb-16'>
            <div className='flex flex-col gap-8 lg:flex-row lg:gap-12'>
                {/* ── Left rail: section nav only ───────────────────── */}
                <aside className='shrink-0 lg:w-52'>
                    {/* Horizontal pills on mobile, vertical list on desktop. */}
                    <nav
                        aria-label='Profile sections'
                        className='flex gap-1 overflow-x-auto lg:flex-col'>
                        {navItems.map(item => (
                            <button
                                key={item.key}
                                type='button'
                                onClick={() => setSection(item.key)}
                                aria-current={
                                    section === item.key ? 'page' : undefined
                                }
                                className={cn(
                                    'flex shrink-0 cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                                    section === item.key
                                        ? 'bg-muted font-medium text-foreground'
                                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                                )}>
                                <HugeiconsIcon
                                    icon={item.icon}
                                    className='size-4'
                                    strokeWidth={1.75}
                                />
                                {item.label}
                            </button>
                        ))}
                    </nav>
                </aside>

                {/* ── Content column ────────────────────────────────── */}
                <motion.div
                    key={section}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className='min-w-0 flex-1'>
                    {section === 'account' ? (
                        <AccountSection user={user} />
                    ) : section === 'company' ? (
                        // `showCompany` decides WHETHER the section renders;
                        // the presence of an operator id decides WHICH branch.
                        // An admin who also owns an operator record still gets
                        // the platform entity, matching the settings order.
                        <CompanySection
                            operatorId={
                                can('VIEW_SETTINGS') ? undefined : operatorId
                            }
                        />
                    ) : (
                        <SecuritySection />
                    )}
                </motion.div>
            </div>
        </div>
    );
}
