'use client';

import { emailCentreKeys } from '@/lib/email-centre/query-keys';
import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query';
import { emailCentreApi } from '@/lib/api/email-centre';
import { emailsApi } from '@/lib/api/emails';
import { emailKeys } from '@/hooks/emails/use-operator-emails';
import type {
    EmailPeopleQueryParams,
    EmailSendsQueryParams,
    UpdateEmailSettingsPayload,
} from '@/types/email-centre';


export function useEmailSettings() {
    return useQuery({
        queryKey: emailCentreKeys.settings(),
        queryFn: emailCentreApi.getSettings,
    });
}

/**
 * Tri-state settings PATCH. Success/error toasts stay with the form — it
 * needs the API's own 400 message (bounds, the window rule) rendered inline,
 * not swallowed by a generic handler. The response IS the fresh GET shape,
 * so it replaces the cached settings directly instead of refetching.
 */
export function useUpdateEmailSettings() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: UpdateEmailSettingsPayload) =>
            emailCentreApi.updateSettings(payload),
        onSuccess: (result) => {
            queryClient.setQueryData(emailCentreKeys.settings(), result);
        },
    });
}

/** Global send-log list (Activity), server-filtered and paginated. */
export function useEmailSends(params: EmailSendsQueryParams = {}) {
    return useQuery({
        queryKey: emailCentreKeys.sends(params),
        queryFn: () => emailCentreApi.listSends(params),
        placeholderData: keepPreviousData,
    });
}

export function useEmailOptOuts(
    params: EmailPeopleQueryParams = {},
    enabled = true,
) {
    return useQuery({
        queryKey: emailCentreKeys.optOuts(params),
        queryFn: () => emailCentreApi.listOptOuts(params),
        placeholderData: keepPreviousData,
        enabled,
    });
}

export function useEmailConsents(
    params: EmailPeopleQueryParams = {},
    enabled = true,
) {
    return useQuery({
        queryKey: emailCentreKeys.consents(params),
        queryFn: () => emailCentreApi.listConsents(params),
        placeholderData: keepPreviousData,
        enabled,
    });
}

/**
 * Test-send to the calling admin's own address. Invalidates the Activity
 * list so the fresh `test:<userId>#<n>` row appears immediately.
 */
export function useTestSend() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (templateKey: string) =>
            emailCentreApi.testSend(templateKey),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: emailCentreKeys.sendsAll(),
            });
        },
    });
}

/**
 * Resend an onboarding email from the Activity table (WP-D endpoint, WP-E
 * client). For OB rows the send-log `scopeId` IS the operator id (strip any
 * `#resend-{n}` suffix first). Invalidates both the global Activity list and
 * that operator's WP-E timeline so the new `#resend-{n}` row shows up in
 * both places.
 */
export function useResendFromActivity() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            operatorId,
            templateKey,
        }: {
            operatorId: string;
            templateKey: string;
        }) => emailsApi.resend(operatorId, templateKey),
        onSuccess: (_data, { operatorId }) => {
            queryClient.invalidateQueries({
                queryKey: emailCentreKeys.sendsAll(),
            });
            queryClient.invalidateQueries({
                queryKey: emailKeys.operator(operatorId),
            });
        },
    });
}

export { emailCentreKeys };
