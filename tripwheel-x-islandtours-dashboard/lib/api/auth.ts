/**
 * Pre-login door check. Each login door asks the backend whether the email
 * belongs at that surface BEFORE submitting the password, so multi-hat users
 * get pointed at the right door instead of a generic failure.
 *
 * Advisory only: sign-in itself independently enforces the surface via the
 * `x-login-surface` header, so this failing open never weakens the gate.
 */
import { apiFetch } from './fetch';

export type LoginSurface = 'account' | 'portal' | 'staff' | 'admin';

export interface LoginPrecheckResult {
    ok: boolean;
    /** Only when ok=false: every surface this account can sign in at. */
    surfaces?: LoginSurface[];
    /** Only when ok=false: the door to suggest. */
    suggested?: LoginSurface;
}

export async function loginPrecheck(
    email: string,
    surface: LoginSurface,
): Promise<LoginPrecheckResult> {
    try {
        return await apiFetch<LoginPrecheckResult>('/auth/login-precheck', {
            method: 'POST',
            body: JSON.stringify({ email, surface }),
        });
    } catch {
        // Fail open (429/network/endpoint down): the backend header
        // enforcement is the real gate; the pre-check is UX sugar.
        return { ok: true };
    }
}
