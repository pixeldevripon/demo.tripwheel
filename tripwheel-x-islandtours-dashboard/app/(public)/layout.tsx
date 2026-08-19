/**
 * Ungated route group.
 *
 * Pages here are reached by people who are NOT signed in - today that is the
 * password-change confirmation link, which is routinely opened on a phone that
 * has no dashboard session. The `(app)` layout redirects any sessionless
 * request to `/portal`, and Next drops the query string when it does, which
 * would silently swallow the `?token=` these pages exist to read.
 *
 * No chrome and no `.frontend-root` scope: these pages use the dashboard
 * design tokens from the root layout.
 */
export default function PublicLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
