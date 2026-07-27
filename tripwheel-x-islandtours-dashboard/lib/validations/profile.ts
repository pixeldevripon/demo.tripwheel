import { z } from 'zod';

/**
 * The profile keeps ONE editable identity field. Email changes only through
 * the verified Better Auth change-email flow (ChangeEmailDialog); phone,
 * location, timezone and social links were removed from the profile page by
 * design (2026-07-28 Webflow-style redesign).
 */
export const profileSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

// No confirm-password field on purpose - same decision as the login screens
// (password managers make it redundant; paste is allowed).
export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string()
        .min(12, 'Password must be at least 12 characters')
        .max(32, 'Password cannot exceed 32 characters'),
});

export const setPasswordSchema = z.object({
    newPassword: z.string()
        .min(12, 'Password must be at least 12 characters')
        .max(32, 'Password cannot exceed 32 characters'),
});

/**
 * The RHF field shape for the security section - ONE form type regardless of
 * which schema validates it (`currentPassword` simply stays empty and
 * unvalidated on the set-password branch). Keeping this separate from the
 * union of schema infers avoids `Path<union>` collapsing to the intersection
 * of keys, which would force casts at every register() call.
 */
export interface PasswordFormValues {
    currentPassword?: string;
    newPassword: string;
}

export const changeEmailSchema = z.object({
    newEmail: z.string().email('Invalid email address'),
});

export type ChangeEmailFormValues = z.infer<typeof changeEmailSchema>;
