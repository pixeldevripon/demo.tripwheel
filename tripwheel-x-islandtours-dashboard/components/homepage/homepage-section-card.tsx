'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * The shell every homepage section shares: title, body, and a save bar.
 *
 * PUBLISHING HONESTY. There is no draft state for homepage content - a save is
 * live on the public site as soon as the cache tag is busted. The save bar says
 * so, every time, rather than letting a silent success toast imply otherwise.
 *
 * ENGLISH INLINE, other locales in the Translation Console - the standing rule
 * for every entity in this app. `translatable` renders that pointer so an admin
 * does not go looking for language tabs that deliberately are not here.
 */
export function HomepageSectionCard({
  title,
  description,
  translatable = false,
  isPending,
  onSave,
  children,
}: {
  title: string;
  description?: string;
  translatable?: boolean;
  isPending: boolean;
  onSave: () => void;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className='border-b pb-8'>
        <CardTitle>{title}</CardTitle>
        {description ? (
          <p className='m-0 mt-2 text-sm text-content-muted'>{description}</p>
        ) : null}
      </CardHeader>

      <CardContent className='pt-8'>
        <div className='space-y-6'>{children}</div>

        {translatable ? (
          <p className='mt-6 text-xs text-content-muted'>
            English only here - translate into the other languages in the{' '}
            <Link
              href='/translations/homepage/default/es'
              className='underline underline-offset-4 hover:text-primary'>
              Translation Console
            </Link>
            .
          </p>
        ) : null}

        <div className='mt-8 flex flex-wrap items-center justify-end gap-3 border-t pt-6'>
          <p className='m-0 mr-auto text-xs text-content-muted'>
            Saving publishes straight to the live homepage.
          </p>
          <Button type='button' size='sm' disabled={isPending} onClick={onSave}>
            {isPending ? 'Publishing...' : 'Save and publish'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
