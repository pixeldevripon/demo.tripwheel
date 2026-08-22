/**
 * Shown when a session holds neither MANAGE_STAFF nor MANAGE_TEAM. The nav
 * item never renders for them, so this only ever surfaces on a hand-typed URL
 * - the backend guards are the real enforcement.
 */
export function StaffNoAccess() {
    return (
        <div className='flex h-64 flex-col items-center justify-center gap-1 text-center'>
            <p className='font-medium'>User management is owner-only.</p>
            <p className='text-sm text-muted-foreground'>
                Ask the account owner if you need access changed.
            </p>
        </div>
    );
}
