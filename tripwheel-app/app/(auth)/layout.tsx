import { LoginPromo } from '@/components/marketing/login-promo';

/**
 * Shared auth shell: every auth door (login / forgot / reset) renders inside
 * the same split - the branded promo panel on the left (hero gradient,
 * floating booking cards), the auth column centred on the right.
 */
export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <main className='flex min-h-screen bg-mk-paper'>
            <div className='sticky top-0 hidden h-screen w-1/2 p-4 lg:block xl:p-6'>
                <LoginPromo />
            </div>
            <div className='flex w-full items-center justify-center bg-mk-paper px-6 py-16 lg:w-1/2'>
                {children}
            </div>
        </main>
    );
}
