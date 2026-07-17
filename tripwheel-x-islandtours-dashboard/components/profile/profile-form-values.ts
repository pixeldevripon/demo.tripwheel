import type { ProfileFormValues } from '@/lib/validations/profile';
import type { UserProfile } from '@/types/profile';

/**
 * Full form-value snapshot from the loaded profile. Each profile card edits
 * only its own slice but submits the complete value set, so the payload the
 * API receives is byte-identical to the old page-wide form's.
 */
export function profileValuesFromUser(user: UserProfile): ProfileFormValues {
    return {
        name: user.name ?? '',
        email: user.email ?? '',
        phone: user.phone ?? '',
        location: user.location ?? '',
        timezone: user.timezone ?? '',
        instagramUrl: user.operator?.socialMedia?.instagramUrl ?? '',
        facebookUrl: user.operator?.socialMedia?.facebookUrl ?? '',
        linkedinUrl: user.operator?.socialMedia?.linkedinUrl ?? '',
        twitterUrl: user.operator?.socialMedia?.twitterUrl ?? '',
    };
}
