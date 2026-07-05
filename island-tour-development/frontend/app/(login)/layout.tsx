/**
 * Login-surfaces route group: the three bespoke auth doors from the login design
 * spec (technical-doc/login/) - traveler `/bookings`, operator `/portal`, staff
 * `/staff`. Each page owns its own full-screen chrome (takeover / split-screen /
 * dark), so this layout only establishes the `.frontend-root` token scope + base
 * typography. It is intentionally separate from `app/(auth)/*`, which keeps the
 * existing `/login` system running untouched until these surfaces are wired.
 */
export default function LoginSurfacesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <div className='frontend-root min-h-screen'>{children}</div>;
}
