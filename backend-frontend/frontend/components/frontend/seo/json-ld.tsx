/**
 * Emits a single `<script type="application/ld+json">` for a structured-data
 * graph. Serialized (not interpolated) with `<` escaped, so a stray `<` in any
 * string field can never close the script tag - the same guard the tour-review
 * JSON-LD uses (`tour-reviews-blocks.tsx`).
 *
 * Server component: renders in the initial HTML where crawlers read it. Pass a
 * plain schema.org object (or null to render nothing).
 */
export function JsonLd({ data }: { data: Record<string, unknown> | null }) {
    if (!data) return null;
    return (
        <script
            type='application/ld+json'
            dangerouslySetInnerHTML={{
                __html: JSON.stringify(data).replace(/</g, '\\u003c'),
            }}
        />
    );
}
