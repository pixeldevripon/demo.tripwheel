'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useProfileQuery } from '@/hooks/profile/use-profile';
import { SettingsCardSkeleton } from './settings-fields';

/**
 * Operator settings. "Your Business" (the operator's own company info) LEFT
 * this page on 2026-07-28 - it now lives on `/profile` under Your business, in
 * the profile page's flat block layout. Payments (`OperatorPaymentsForm`) is
 * still parked, so with both gone the page has nothing to edit and points at
 * the profile rather than render an empty tab strip.
 *
 * When payments comes back, restore the `EntityTabs` wrapper here (see git
 * history for the two-tab version) - the form component itself is untouched.
 */
export function OperatorSettings() {
  const { data: user, isLoading } = useProfileQuery();
  const operatorId = user?.operator?.id;

  if (isLoading) return <SettingsCardSkeleton />;

  if (!operatorId) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No operator account is linked to your profile. Please contact an administrator.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <p className="max-w-sm text-sm text-muted-foreground">
          Your company details moved to your profile. Everything else on this
          page is managed by the platform.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/profile">Go to your profile</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
