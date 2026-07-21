/**
 * Authored About + SEO copy as it arrives inside a page's `render` payload:
 * already resolved to the requested locale with an English fallback applied
 * field by field.
 *
 * There is deliberately no `locale` here - unlike the per-entity `*PageContent`
 * types, which mirror a single database row, any one of these values may have
 * come from a different row than its neighbours.
 */
export interface ResolvedPageContent {
    aboutText: string | null;
    metaTitle: string | null;
    metaDescription: string | null;
}
