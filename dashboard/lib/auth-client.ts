import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5050",
});

export const { signIn, signOut, useSession } = authClient;

/**
 * The authoritative role of the current session, or null when signed out.
 *
 * `role` is a backend additionalField (a Prisma enum, so UPPERCASE values like
 * 'ADMIN' matching the checks elsewhere in this app), which this client's plain
 * `createAuthClient` cannot infer - so the cast lives HERE, once, instead of
 * being re-derived at every caller.
 *
 * Used by the admin door to verify the session it just minted really is an
 * ADMIN before handing over. Everything else in the dashboard reads the role
 * server-side, which is authoritative; this is a client-side belt on top of
 * the backend's own surface enforcement, not a replacement for it.
 */
export async function getSessionRole(): Promise<string | null> {
    const session = await authClient.getSession();
    return (session.data?.user as { role?: string } | undefined)?.role ?? null;
}
