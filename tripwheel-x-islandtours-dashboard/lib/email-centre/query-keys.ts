import type {
    EmailPeopleQueryParams,
    EmailSendsQueryParams,
} from '@/types/email-centre';

/**
 * The email-centre TanStack Query key factory. Lives in lib/ (not the hooks
 * domain) because hooks/settings/ also invalidates the settings key for
 * cache coherence, and hook domains must not import each other (D4 rule -
 * review of #57).
 */
export const emailCentreKeys = {
    all: ['email-centre'] as const,
    settings: () => [...emailCentreKeys.all, 'settings'] as const,
    sends: (params: EmailSendsQueryParams) =>
        [...emailCentreKeys.all, 'sends', params] as const,
    sendsAll: () => [...emailCentreKeys.all, 'sends'] as const,
    optOuts: (params: EmailPeopleQueryParams) =>
        [...emailCentreKeys.all, 'opt-outs', params] as const,
    consents: (params: EmailPeopleQueryParams) =>
        [...emailCentreKeys.all, 'consents', params] as const,
};
