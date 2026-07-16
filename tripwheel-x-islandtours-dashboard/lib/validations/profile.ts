import { z } from 'zod';

export const profileSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address').optional(),
    phone: z.string().optional().nullable(),
    location: z.string().optional().nullable(),
    timezone: z.string().min(1, 'Please select a timezone'),
    
    // Social links (optional)
    instagramUrl: z.string().url('Invalid Instagram URL').optional().or(z.literal('')),
    facebookUrl: z.string().url('Invalid Facebook URL').optional().or(z.literal('')),
    linkedinUrl: z.string().url('Invalid LinkedIn URL').optional().or(z.literal('')),
    twitterUrl: z.string().url('Invalid Twitter URL').optional().or(z.literal('')),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string()
        .min(12, 'Password must be at least 12 characters')
        .max(32, 'Password cannot exceed 32 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

export const setPasswordSchema = z.object({
    newPassword: z.string()
        .min(12, 'Password must be at least 12 characters')
        .max(32, 'Password cannot exceed 32 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
export type SetPasswordFormValues = z.infer<typeof setPasswordSchema>;
