/**
 * Renders a Pages-system body (sanitized HTML from the backend) inside the
 * legal prose styling.
 *
 * The HTML is sanitized ON THE WRITE PATH (backend `pages.service` /
 * `sanitizePageHtml`) - that single gate is what makes rendering it directly
 * here safe, server-side and SEO-visible with no client sanitizer.
 *
 * Every `<table>` is wrapped in the horizontal-scroll guard at render time
 * (the job `LegalTableScroller` did for the hand-authored pages): the stored
 * body is pure semantic content with no presentational wrappers, and the
 * dashboard's TipTap editor emits bare tables - so the guard has to be a
 * render concern, applied uniformly, or wide tables would overflow on phones.
 */

function wrapTables(html: string): string {
    return html
        .replaceAll('<table', '<div class="it-page-table-scroller"><table')
        .replaceAll('</table>', '</table></div>');
}

export function PageBody({ html }: { html: string }) {
    return <div dangerouslySetInnerHTML={{ __html: wrapTables(html) }} />;
}
