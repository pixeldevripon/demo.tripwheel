/**
 * Login-surfaces route group: the bespoke auth doors from the login design spec
 * (technical-doc/login/) - operator `/portal`, staff `/staff` and system admin
 * `/admin`. (The traveler door lives on the public site, not in this app.) Each
 * page owns its own full-screen chrome (split-screen / dark takeover), so this
 * layout only establishes the `.frontend-root` token scope + base typography.
 *
 * `/admin` was merged in from the standalone `tripwheel-app` deployment, which
 * used to serve the system admin door from its own origin. One application owns
 * all three doors now.
 */
export default function LoginSurfacesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <div className='frontend-root min-h-screen'>{children}</div>;
}
