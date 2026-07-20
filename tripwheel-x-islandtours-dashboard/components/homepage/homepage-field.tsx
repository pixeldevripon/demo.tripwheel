'use client';

import type { ReactNode } from 'react';

import { Field, FieldDescription } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/**
 * A homepage copy field that explains itself.
 *
 * Two rules from the editor design, both applied here so no individual form has
 * to remember them:
 *
 * 1. LABEL BY CONSEQUENCE. `where` says where the text actually appears on the
 *    page ("the large text over the hero photo"), not what column it maps to.
 *    An admin should never have to load the site to find out what a field does.
 * 2. SHOW THE FALLBACK. An empty field is not blank on the live site - it
 *    renders the shipped copy. The default is the placeholder AND, when the
 *    field is empty, an explicit note says so. Without that, empty state reads
 *    as a missing section.
 */
export function HomepageField({
  label,
  where,
  value,
  fallback,
  multiline = false,
  rows = 3,
  maxLength,
  register,
  children,
}: {
  label: string;
  /** Where this text appears on the public homepage. */
  where: string;
  /** Current field value - drives the "using the default" note. */
  value: string;
  /** The copy the site ships with when this is empty. */
  fallback?: string;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  /** Spread of react-hook-form's register(name). */
  register?: Record<string, unknown>;
  /** Escape hatch for a non-text control (image picker, select). */
  children?: ReactNode;
}) {
  const usingDefault = !value.trim() && Boolean(fallback);

  return (
    <Field>
      <Label>{label}</Label>

      {children ??
        (multiline ? (
          <Textarea
            rows={rows}
            maxLength={maxLength}
            placeholder={fallback}
            {...register}
          />
        ) : (
          <Input maxLength={maxLength} placeholder={fallback} {...register} />
        ))}

      <FieldDescription>
        {where}
        {usingDefault ? (
          <>
            {' '}
            <span className='text-content-muted'>
              Currently showing the built-in default.
            </span>
          </>
        ) : null}
      </FieldDescription>
    </Field>
  );
}
