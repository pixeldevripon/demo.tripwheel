'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { ViewIcon, ViewOffIcon } from '@hugeicons/core-free-icons';

import { useState, type ReactNode } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { ImageSelectorField } from '@/components/common/image-selector-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

/**
 * Inline connection indicator for integration cards: green when the service
 * has credentials stored, neutral when it still needs configuring.
 */
export function ConnectionStatus({ connected }: { connected: boolean }) {
  return (
    <span
      className={
        connected
          ? 'inline-flex items-center gap-1.5 rounded-full bg-success-subtle px-2.5 py-0.5 text-xs font-medium text-success-fg'
          : 'inline-flex items-center gap-1.5 rounded-full bg-surface-inset px-2.5 py-0.5 text-xs font-medium text-content-muted'
      }
    >
      <span
        className={
          connected
            ? 'size-1.5 rounded-full bg-success-solid'
            : 'size-1.5 rounded-full bg-content-subtle'
        }
      />
      {connected ? 'Configured' : 'Not configured'}
    </span>
  );
}

/** Card shell shared by every settings form: heading, body, and a footer Save button. */
export function SettingsCard({
  title,
  description,
  children,
  onSubmit,
  isSaving,
  saveLabel = 'Save Changes',
  canSave = true,
  status,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onSubmit: () => void;
  isSaving: boolean;
  saveLabel?: string;
  canSave?: boolean;
  /** Optional indicator rendered beside the title (e.g. connection status). */
  status?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="border-b pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle>{title}</CardTitle>
          {status}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground mt-1 normal-case tracking-normal font-normal">
            {description}
          </p>
        )}
      </CardHeader>
      <CardContent className="pt-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="space-y-6"
        >
          {children}
          {canSave && (
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : saveLabel}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

export function TextField({
  label,
  registration,
  error,
  description,
  placeholder,
  type = 'text',
  disabled,
}: {
  label: string;
  registration: UseFormRegisterReturn;
  error?: string;
  description?: string;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <Field>
      <Label>{label}</Label>
      <Input
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={!!error}
        {...registration}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError>{error}</FieldError>
    </Field>
  );
}

export function TextareaField({
  label,
  registration,
  error,
  description,
  placeholder,
  disabled,
}: {
  label: string;
  registration: UseFormRegisterReturn;
  error?: string;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <Field>
      <Label>{label}</Label>
      <Textarea
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={!!error}
        {...registration}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError>{error}</FieldError>
    </Field>
  );
}

/** Password-style input with an eye toggle to reveal the entered value. */
export function SecretField({
  label,
  registration,
  error,
  description,
  placeholder,
  disabled,
}: {
  label: string;
  registration: UseFormRegisterReturn;
  error?: string;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Field>
      <Label>{label}</Label>
      <div className="relative">
        <Input
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={!!error}
          autoComplete="off"
          className="pr-8"
          {...registration}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide value' : 'Show value'}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          tabIndex={-1}
        >
          {visible ? <HugeiconsIcon icon={ViewOffIcon} className="size-4" /> : <HugeiconsIcon icon={ViewIcon} className="size-4" />}
        </button>
      </div>
      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError>{error}</FieldError>
    </Field>
  );
}

/** Single-image picker backed by the media gallery, wired to a form value/onChange. */
export function ImageField({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <Field>
      <Label>{label}</Label>
      {description && <FieldDescription>{description}</FieldDescription>}
      <ImageSelectorField value={value} onChange={onChange} disabled={disabled} />
    </Field>
  );
}

export function CheckboxField({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Field>
      <div className="flex items-center gap-2">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(c) => onChange(!!c)}
          disabled={disabled}
        />
        <Label htmlFor={id} className="cursor-pointer">
          {label}
        </Label>
      </div>
      {description && <FieldDescription>{description}</FieldDescription>}
    </Field>
  );
}

export function SettingsCardSkeleton() {
  return (
    <Card>
      <CardHeader className="border-b pb-6">
        <Skeleton className="h-6 w-40" />
      </CardHeader>
      <CardContent className="pt-8 space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
