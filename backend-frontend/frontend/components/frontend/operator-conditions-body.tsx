/**
 * The operator-conditions document body (Pastel #80 / MCK-20 §3) - ONE
 * rendering for its three surfaces: the canonical page, the intercepted
 * overlay and the checkout's in-flow reader.
 *
 * The HTML is operator-authored in the wizard's rich-text editor and
 * sanitized at WRITE time by the shared pages pipeline (sanitizePageHtml),
 * so it carries the full TipTap vocabulary - headings, lists, links,
 * tables. `.it-page-prose` is that vocabulary's one public type scale;
 * never restyle a subset here.
 */
export function OperatorConditionsBody({ html }: { html: string }) {
    return (
        <div
            className='it-page-prose [&>:first-child]:mt-0'
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}
