# How the Pages System Works, End to End

Think of it as a tiny WordPress living inside your platform. Three apps
cooperate: the **dashboard** (where an admin writes), the **backend** (where
content is stored and cleaned), and the **public site** (where visitors
read). This document walks through one page's whole life - and for every
step it names **where the code lives** (clickable links), shows **the actual
code**, and explains **the logic**.

> Link note: backend/frontend links are relative inside this repo and work
> everywhere. Dashboard links point at the sibling repo folder
> (`tripwheel-x-islandtours-dashboard`) - they resolve in your IDE on this
> machine, not on GitHub.

| App | Repo | Its one job |
|---|---|---|
| Dashboard | `tripwheel-x-islandtours-dashboard` | Let an admin write and publish pages in an editor that already looks like the live site |
| Backend | `island-tour-development/backend` | Clean the HTML once at the door, store it, answer "give me the published page at this path" |
| Public site | `island-tour-development/frontend` | Figure out what any URL means, render pages fast from cache, keep old links alive |

---

## 1. An admin creates a page

The admin opens **Dashboard → Pages → New Page** and types a title, say
*"Refund Rules"*.

- As they type the title, the **permalink field fills itself in**:
  `refund-rules`. The moment they touch that field by hand, auto-filling
  stops (so their edit is never overwritten).
- The permalink can be **nested**, like `legal/refund-rules` - exactly like
  WordPress parent/child pages. Any depth: `help/faq/payments`.
- They write the body in the **TipTap editor** - headings, bold, lists,
  tables, images, highlights, anything on the toolbar.
- Clicking **Create Page** saves it as a **DRAFT**. Drafts are invisible to
  the world - the public URL literally 404s.

**The editor IS the preview.** The editor's writing area uses a stylesheet
(`.it-page-prose`) that is a copy of the exact styles the public site uses -
same font sizes, same colors, same table design. What you see while typing
is what visitors will see. That's also why the editor area is always white,
even in dashboard dark mode - because the public page is white.

### 📂 The code

**The auto-permalink** - [`components/pages/page-form.tsx`](../../../tripwheel-x-islandtours-dashboard/components/pages/page-form.tsx)

```tsx
// Once the admin touches the slug, stop deriving it from the title.
const [slugTouched, setSlugTouched] = useState(isEdit);

<TextField
  label="Title"
  registration={register('title', {
    onChange: (e) => {
      if (!slugTouched) {
        setValue('slug', toSlug((e.target as HTMLInputElement).value));
      }
    },
  })}
/>
<TextField
  label="Permalink"
  registration={register('slug', {
    onChange: () => setSlugTouched(true),   // ← hand-edit = auto-fill off forever
  })}
/>
```

**The editor as a form field** - same file. TipTap is a controlled
component (`value` in, `onChange(getHTML())` out), wired through a
react-hook-form `Controller`:

```tsx
<Controller
  control={control}
  name="body"
  render={({ field }) => (
    <RichTextEditor value={field.value} onChange={field.onChange} />
  )}
/>
```

**The editor itself** - [`components/pages/rich-text-editor.tsx`](../../../tripwheel-x-islandtours-dashboard/components/pages/rich-text-editor.tsx)

```tsx
const editor = useEditor({
  immediatelyRender: false,           // App Router SSR: client-only render
  extensions: [
    StarterKit.configure({ heading: { levels: [1, 2, 3, 4] }, ... }),
    TaskList, TaskItem.configure({ nested: true }),
    Highlight.configure({ multicolor: true }),
    Superscript, Subscript,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ResizableImage,                   // ← images with a drag-resize handle
    Table.configure({ resizable: false }), TableRow, TableHeader, TableCell,
  ],
  content: value,
  onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  // THE preview trick: the content area renders under the public prose class
  editorProps: { attributes: { class: 'it-page-prose' } },
});
```

**Resizable images** - [`components/pages/resizable-image.tsx`](../../../tripwheel-x-islandtours-dashboard/components/pages/resizable-image.tsx).
Dragging the corner handle writes a `width` attribute INTO the document, so
the size travels with the content:

```tsx
const onMove = (e: PointerEvent) => {
  const next = Math.round(
    Math.min(maxWidth, Math.max(MIN_WIDTH, startWidth + (e.clientX - startX))),
  );
  updateAttributes({ width: next });   // → stored as <img src width="640">
};
```

**Where images come from** - the media library dialog
([`components/common/media-selector.tsx`](../../../tripwheel-x-islandtours-dashboard/components/common/media-selector.tsx)),
opened by the toolbar's image button with `kind="image"` - never a pasted URL.

**The editor's scoped styling** - [`components/pages/rich-text-editor.css`](../../../tripwheel-x-islandtours-dashboard/components/pages/rich-text-editor.css) -
everything lives under `.it-page-editor` (nothing leaks into the dashboard
theme), and `.it-page-prose` inside it mirrors the public stylesheet
value-for-value:

```css
/* The content area is ALWAYS white, in both dashboard themes: it previews
 * the public page, which is light. */
.it-page-editor .it-page-editor-content {
  background: #ffffff;
}
```

**Routes and list** -
[`app/(app)/pages/page.tsx`](../../../tripwheel-x-islandtours-dashboard/app/(app)/pages/page.tsx) (list) ·
[`app/(app)/pages/new/page.tsx`](../../../tripwheel-x-islandtours-dashboard/app/(app)/pages/new/page.tsx) ·
[`app/(app)/pages/[id]/edit/page.tsx`](../../../tripwheel-x-islandtours-dashboard/app/(app)/pages/[id]/edit/page.tsx) ·
table + row actions in
[`components/pages/pages-table.tsx`](../../../tripwheel-x-islandtours-dashboard/components/pages/pages-table.tsx) and
[`components/pages/page-columns.tsx`](../../../tripwheel-x-islandtours-dashboard/components/pages/page-columns.tsx) ·
data layer in
[`lib/api/pages.ts`](../../../tripwheel-x-islandtours-dashboard/lib/api/pages.ts) +
[`hooks/pages/use-pages.ts`](../../../tripwheel-x-islandtours-dashboard/hooks/pages/use-pages.ts)
(TanStack Query - every mutation invalidates `pageKeys` so the list
refreshes instantly). All of it gated on `MANAGE_EDITORIAL`.

---

## 2. What happens on every save (the security gate)

When the admin hits Save, the HTML travels to the backend - and **before it
touches the database, it goes through a sanitizer**: a strict allowlist.

- ✅ **Allowed:** headings, paragraphs, lists, task lists, marks
  (bold/italic/underline/strike/code), links (https/mailto), tables,
  highlight colors, sup/sub, text alignment, https images
- ❌ **Silently deleted:** `<script>`, `onclick` handlers, iframes,
  `javascript:` links, arbitrary CSS - anything that could attack a visitor

The design choice this protects: the public site renders the stored HTML
**directly, with zero processing** - fast, and fully visible to Google. It's
safe *only* because nothing dirty can ever get in. **One gate, guarded once,
trusted everywhere.**

And the system's core invariant: **toolbar = sanitizer = stylesheet.** Add
an editor tool and you must touch all three, or the output is stripped on
save / renders unstyled.

### 📂 The code

**The sanitizer** - [`backend/src/common/utils/page-html.util.ts`](../../backend/src/common/utils/page-html.util.ts)

```ts
export function sanitizePageHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,          // h1-h4, p, lists, tables, marks, img…
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      mark: ['data-color', 'style'],
      p: ['style'], h1: ['style'], h2: ['style'], h3: ['style'], h4: ['style'],
      // …
    },
    // `style` is allowlisted PER PROPERTY, never free-form:
    allowedStyles: {
      p: { 'text-align': TEXT_ALIGN },        // left|right|center|justify only
      mark: { 'background-color': CSS_COLOR }, // hex / rgb(a) only
    },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowedSchemesByTag: { img: ['https'] },   // images: https ONLY
    transformTags: {
      // force rel-safety on new-tab links
      a: (tag, attribs) => attribs.target === '_blank'
        ? { tagName: tag, attribs: { ...attribs, rel: 'noopener noreferrer' } }
        : { tagName: tag, attribs },
    },
    // an image whose src was stripped must not survive as an empty box
    exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs.src,
  }).trim();
}
```

**Where it's called** - [`backend/src/pages/pages.service.ts`](../../backend/src/pages/pages.service.ts)
(`create` and `upsertTranslation`). Sanitization is the WRITE path - reads
never re-clean, because the column is already the trusted form:

```ts
const body =
  fields.body !== undefined ? sanitizePageHtml(fields.body) : undefined;
```

**The data model** - [`backend/prisma/pages.prisma`](../../backend/prisma/pages.prisma)

```prisma
model Page {
  slug        String     @unique   // "terms" or nested: "legal/terms"
  status      PageStatus @default(DRAFT)   // DRAFT | PUBLISHED | ARCHIVED
  publishedAt DateTime?  // stamped on the FIRST publish, kept forever
  translations PageTranslation[]   // one per locale: title, body, meta
  redirects    PageRedirect[]      // old permalinks that 301 here
}
```

---

## 3. Publishing

The admin clicks **Publish**. The backend:

1. **Refuses** if the page has no English title/body (an empty page must
   never go live)
2. Flips status to `PUBLISHED` and stamps `publishedAt` (first time only -
   "since when has this policy existed", not "when was the toggle flipped")
3. The dashboard then pings the public site: *"anything cached under the
   `pages` tag is stale - throw it away"*

That ping is the **cache bridge** - it's what makes an edit appear on the
live site within seconds, without redeploying anything. Unpublishing is the
same button in reverse - the URL immediately 404s again.

### 📂 The code

**Publish with guards** - [`backend/src/pages/pages.service.ts`](../../backend/src/pages/pages.service.ts) (`updateStatus`)

```ts
// A page with no English content would publish as an empty shell.
if (dto.status === PageStatus.PUBLISHED &&
    (!english || !english.title.trim() || !english.body.trim())) {
  throw new BadRequestException(
    'Cannot publish: the page needs an English title and body first');
}

await this.prisma.page.update({
  where: { id },
  data: {
    status: dto.status,
    // stamped only while still null → survives unpublish/republish cycles
    ...(dto.status === PageStatus.PUBLISHED &&
        !existing.publishedAt && { publishedAt: new Date() }),
  },
});
```

**The ping (producer side)** - [`lib/api/cache-revalidation.ts`](../../../tripwheel-x-islandtours-dashboard/lib/api/cache-revalidation.ts)
in the dashboard. After any write to a `/pages/...` API path it maps the
path to a tag and POSTs it to the public site's `/api/revalidate`:

```ts
// One coarse tag - a rename must bust the OLD slug's cached entry too,
// which a per-slug tag could not (the producer only knows the new one).
case 'pages':
  tags.push('pages');
  break;
```

**The shared vocabulary** - [`frontend/lib/cache-tags.ts`](../../frontend/lib/cache-tags.ts)
(byte-identical copy in the dashboard repo - that's the contract):

```ts
export const COARSE_CACHE_TAGS = [
  // …
  'pages',   // the Pages system (legal/policy permalinks)
] as const;
```

**The consumer** - [`frontend/lib/api/public/pages.ts`](../../frontend/lib/api/public/pages.ts) -
the cached loader is tagged `pages`; busting the tag empties every cached
page at once:

```ts
export async function getPublishedPage(slug, locale) {
  'use cache';
  cacheLife('days');
  cacheTag('pages');
  return publicGetStrict<PublicPage>(
    `/pages/public/${encodeURIComponent(slug)}${buildQuery({ locale })}`);
}
```

---

## 4. A visitor opens the URL (the clever part)

### First: how does `/en/privacy-policy` even reach the "destination" route?

This is the one non-obvious routing fact everything else stands on.
**Next.js routes by folder SHAPE, not by meaning.** A bracketed folder like
`[destination]` is a *wildcard for any single URL segment* - the word
"destination" is only the parameter's label, not a filter. The router's
rule is: **exact static folders win; otherwise the wildcard catches it.**

```text
Request: /en/privacy-policy
            │
            ▼
   Is there a static folder named "privacy-policy" under [locale]?
            │
            ├─ It used to exist (the hand-coded legal route) - DELETED in the
            │  cutover. Still-existing static folders would win: search,
            │  wishlist, cancel, review, manage-cookies.
            │
            └─ NO → falls into the wildcard  [destination]/page.tsx
                    with  params.destination = "privacy-policy"
                          (a label, not a claim - it is NOT a destination yet)
```

From there the CODE decides what the segment actually is:

```text
1. getDestinationBySlug("privacy-policy")   → backend: no such island → null
2. getPublishedPage("privacy-policy", "en") → backend: PUBLISHED Page found ✓
3. render it through LegalPageShell + PageBody
   (a redirectToSlug answer would 301 instead; null would 404)
```

And one production nicety: `generateStaticParams` in that same route file
feeds every published single-segment page slug into the build, so
`/en/privacy-policy` is **prerendered** - real visitors get baked HTML
instantly, and the runtime chain above only runs for cold / just-published
paths.

#### Where exactly this code lives

All of it is in **one route file** -
[`frontend/app/(frontend)/[locale]/[destination]/page.tsx`](../../frontend/app/(frontend)/[locale]/[destination]/page.tsx) -
in three functions, because a route has three surfaces (render, metadata,
prerender):

| Surface | Function | Line | What it does |
|---|---|---|---|
| Render | `DestinationContent` | ~187 | The fall-through itself: `if (!island \|\| !island.isActive)` → `getPublishedPage()` → render / `permanentRedirect` / `notFound` |
| SEO / `<title>` | `generateMetadata` | ~97 (page branch ~112) | Same island-miss → page-lookup order, but returns metadata instead of JSX |
| Prerender | `generateStaticParams` | ~49 | Feeds published single-segment page slugs into the build |

The render fall-through, verbatim:

```tsx
// ask "is it an island?" - "privacy-policy" → null
const [dict, island] = await Promise.all([
    getDictionary(locale),
    getDestinationBySlug(destination, locale),
]);

// THE fall-through
if (!island || !island.isActive) {
    const page = await getPublishedPage(destination, locale);
    if (!page) notFound();
    if (page.redirectToSlug) {
        permanentRedirect(`/${locale}/${page.redirectToSlug}`);
    }
    return (
        <LegalPageShell locale={locale} title={page.title}
            showEnglishNotice={page.isEnglishFallback}>
            <PageBody html={page.body} />
        </LegalPageShell>
    );
}
// …below this: the normal destination-page render
```

And the call chain underneath that file:

| Step | File |
|---|---|
| `getPublishedPage()` - cached loader, tag `pages` | [`frontend/lib/api/public/pages.ts`](../../frontend/lib/api/public/pages.ts) |
| HTTP: `GET /api/v1/pages/public/privacy-policy?locale=en` | [`backend/src/pages/pages.controller.ts`](../../backend/src/pages/pages.controller.ts) (`getPublic`, the `@Public()` route) |
| The final authority: published page → else redirect row → else 404 | [`backend/src/pages/pages.service.ts`](../../backend/src/pages/pages.service.ts) (`getPublicBySlug`) |

So: **Next's router** gets the URL into the file (wildcard match),
**`DestinationContent`** decides what the segment *is*, and the backend's
**`getPublicBySlug`** is the final authority on whether a published page
exists at that path.

### The resolution chain at every depth

The puzzle in general: `/en/terms` looks *exactly like* `/en/curacao`, and
`/en/legal/terms` looks exactly like `/en/curacao/boat-trip`. The site can't
tell from the shape. So resolution is a chain of **"is it this? no? try
next"** - at every depth:

```text
ONE segment - /en/{something}
        │
        ├─ Is {something} an active island?  → render the destination page
        ├─ No? Is it a PUBLISHED page?       → render the page   ← /en/terms
        ├─ No? Is it an old renamed slug?    → redirect to the new permalink
        └─ No?                               → 404

TWO segments - /en/{a}/{b}
        │
        ├─ Is {a} an island? → {b} is a tour/category/hub/collection (normal flow)
        └─ Not an island?    → try the page "a/b" → else redirect → else 404
                                  ← /en/legal/terms

THREE OR MORE - /en/help/faq/payments
        │
        └─ join the segments → "help/faq/payments" → page? → redirect? → 404
```

**Why can't a page and a tour ever collide?** The backend enforces it at
*creation time*, both directions: a page can't start with an island's name,
an island can't take a name that pages live under, and pages can never take
the hard-coded routes (`search`, `wishlist`, `cancel`, `review`,
`manage-cookies`). The two worlds are separated at the door, so the resolver
never faces an ambiguous case.

### 📂 The code

**Depth 1** - [`frontend/app/(frontend)/[locale]/[destination]/page.tsx`](../../frontend/app/(frontend)/[locale]/[destination]/page.tsx).
The destination route doubles as the page route (two dynamic siblings at
one level is a Next.js conflict, so the fall-through must live INSIDE it):

```tsx
// Unknown or not-yet-launched (inactive) island → fall through to the
// Pages system before 404ing.
if (!island || !island.isActive) {
    const page = await getPublishedPage(destination, locale);
    if (!page) notFound();

    // A renamed permalink: send visitor + crawler to the new slug.
    if (page.redirectToSlug) {
        permanentRedirect(`/${locale}/${page.redirectToSlug}`);
    }

    return (
        <LegalPageShell locale={locale} title={page.title}
            showEnglishNotice={page.isEnglishFallback}>
            <PageBody html={page.body} />
        </LegalPageShell>
    );
}
```

**Depth 2** - [`frontend/app/(frontend)/[locale]/[destination]/[slug]/page.tsx`](../../frontend/app/(frontend)/[locale]/[destination]/[slug]/page.tsx).
Only when the slug registry misses AND the first segment is not an active
island - so the tour flow for real islands is untouched:

```tsx
// NESTED Pages fall-through: pages can never start with a real destination
// segment (the backend rejects that), so this branch cannot shadow the
// flat-tour default below.
if (!resolution) {
    const island = await getDestinationBySlug(destination, locale);
    if (!island || !island.isActive) {
        const page = await getPublishedPage(`${destination}/${slug}`, locale);
        if (!page) notFound();
        if (page.redirectToSlug) permanentRedirect(`/${locale}/${page.redirectToSlug}`);
        return ( /* …render the page, same as depth 1… */ );
    }
}
```

**Depth 3+** - [`frontend/app/(frontend)/[locale]/[destination]/[slug]/[...path]/page.tsx`](../../frontend/app/(frontend)/[locale]/[destination]/[slug]/[...path]/page.tsx).
A catch-all that joins every segment back into the stored permalink:

```tsx
/** Join the dynamic segments back into the stored permalink path. */
function pagePath({ destination, slug, path }): string {
    return [destination, slug, ...path].join('/');
}
// → getPublishedPage("help/faq/payments") → render / redirect / 404
```

**The creation-time guards** - backend
[`src/pages/pages.service.ts`](../../backend/src/pages/pages.service.ts)
(`assertSlugAvailable`):

```ts
const firstSegment = slug.split('/')[0];

if (RESERVED_PAGE_SLUGS.has(firstSegment)) {           // search, wishlist, …
  throw new ConflictException(`Page slug "${slug}" is reserved…`);
}
const destination = await this.prisma.destination.findUnique({
  where: { slug: firstSegment } });
if (destination) {                                      // curacao/… forbidden
  throw new ConflictException(
    `Page slug "${slug}" starts with the destination "${firstSegment}"…`);
}
```

…and the mirror in
[`src/destinations/destinations.service.ts`](../../backend/src/destinations/destinations.service.ts)
(create) - a new island must not shadow pages nested under its name:

```ts
const shadowedPage = await this.prisma.page.findFirst({
  where: { OR: [{ slug }, { slug: { startsWith: `${slug}/` } }] },
});
if (shadowedPage) throw new ConflictException(
  `Destination slug "${slug}" would shadow the page "/${shadowedPage.slug}"`);
```

**The permalink normaliser** - [`backend/src/common/utils/slug.util.ts`](../../backend/src/common/utils/slug.util.ts):

```ts
/** "Legal//Términos " → "legal/terminos" - slugify each segment, drop empties */
export function normalizePagePath(input: string): string {
  return input
    .split('/')
    .map((segment) => generateSlug(segment))
    .filter((segment) => segment.length > 0)
    .join('/');
}
```

**The loader's outage safety** - [`frontend/lib/api/public/pages.ts`](../../frontend/lib/api/public/pages.ts)
uses `publicGetStrict` ([`frontend/lib/api/public/fetch.ts`](../../frontend/lib/api/public/fetch.ts)):
a backend "not found" returns null (→ 404), but a backend **outage throws** -
so a temporary outage can never bake a 404 over a live legal page; the cache
keeps serving the last good copy.

---

## 5. What the visitor actually gets

- The **title** as the big H1
- The **body HTML** dropped straight in (safe - remember the gate) with the
  shared prose styling
- Every **table** wrapped in a rounded, scrollable card - wide tables scroll
  on phones instead of breaking the layout
- Proper **SEO metadata**: `<title>`, description, canonical, hreflang for
  all 7 languages, OG image
- Automatic presence in **`/sitemap.xml`** (drafts never)

**Languages:** only English content exists today. A Dutch visitor at
`/nl/terms` gets the English text plus the *"available in English only"*
notice, driven by the backend's `isEnglishFallback` flag - the day a real
Dutch translation lands in the database, the notice disappears on its own.

### 📂 The code

**English fallback** - backend [`src/pages/pages.service.ts`](../../backend/src/pages/pages.service.ts) (`getPublicBySlug`) -
one query fetches the requested locale AND English together:

```ts
translations: { where: { locale: { in: [locale, Locale.en] } } },
// …
const requested = page.translations.find((t) => t.locale === locale);
const english  = page.translations.find((t) => t.locale === Locale.en);
const copy = requested ?? english;
return { …, isEnglishFallback: copy.locale !== locale };
```

**The chrome** - [`frontend/components/frontend/legal/legal-page-shell.tsx`](../../frontend/components/frontend/legal/legal-page-shell.tsx) -
title, notice, prose container:

```tsx
{(showEnglishNotice ?? locale !== 'en') && (
    <p className='…'>This page is currently available in English only…</p>
)}
<div className='it-page-prose mt-8 md:mt-10'>{children}</div>
```

**The body + table cards** - [`frontend/components/frontend/legal/page-body.tsx`](../../frontend/components/frontend/legal/page-body.tsx) -
tables are wrapped **at render time**, so stored bodies stay clean and
editor-made tables get the card too:

```tsx
function wrapTables(html: string): string {
    return html
        .replaceAll('<table', '<div class="it-page-table-scroller"><table')
        .replaceAll('</table>', '</table></div>');
}

export function PageBody({ html }: { html: string }) {
    return <div dangerouslySetInnerHTML={{ __html: wrapTables(html) }} />;
}
```

**The prose styles - SOURCE OF TRUTH** -
[`frontend/app/(frontend)/frontend-tokens.css`](../../frontend/app/(frontend)/frontend-tokens.css)
(search `.it-page-prose`). Every h2/p/list/table/image rule the pages use;
the dashboard's editor CSS mirrors it value-for-value:

```css
.it-page-prose .it-page-table-scroller {
    overflow-x: auto;
    border: 1px solid var(--it-border);
    border-radius: 14px;              /* the rounded table card */
}
.it-page-prose th {
    background: var(--it-surface);    /* the grey header row */
}
```

**Sitemap** - backend [`src/sitemap/sitemap.service.ts`](../../backend/src/sitemap/sitemap.service.ts)
enumerates only PUBLISHED pages; frontend
[`app/sitemap.ts`](../../frontend/app/sitemap.ts) expands each into 7 locale
URLs with hreflang:

```ts
// backend: only what actually renders a 200
this.prisma.page.findMany({
  where: { status: PageStatus.PUBLISHED },
  select: { slug: true, updatedAt: true },
}),
// → entries.push({ path: `/${p.slug}`, type: 'page' })
```

---

## 6. Renaming a permalink (nothing ever breaks)

Renaming `terms` → `terms-of-service` on a **published** page is ONE atomic
operation: change the slug + write a redirect record *"terms → this page"*.
Old bookmarks forward instantly; Google transfers the ranking. The redirect
points at the *page itself*, not the next slug - even after five renames,
old links resolve in **one hop**:

```text
   terms ──────────────┐
   terms-of-service ───┼────►  📄 the Page   (current slug: tos-2026)
   tos ────────────────┘        one hop from ANY old name
```

Draft renames write no redirect (the URL was never public). And you **can't
delete a published page** - unpublish first, so killing a live URL is always
a deliberate two-step.

### 📂 The code

**The rename** - backend [`src/pages/pages.service.ts`](../../backend/src/pages/pages.service.ts) (`update`):

```ts
const page = await this.prisma.$transaction(async (tx) => {
  if (renaming) {
    // the new slug may be an old redirect (incl. renaming BACK) - reclaim it
    await tx.pageRedirect.deleteMany({ where: { fromSlug: nextSlug } });

    if (existing.status === PageStatus.PUBLISHED) {
      await tx.pageRedirect.create({
        data: { fromSlug: existing.slug, toPageId: existing.id },  // ← the 301
      });
    }
  }
  return tx.page.update({ where: { id }, data: { slug: nextSlug, … } });
});
```

**Serving it** - backend `getPublicBySlug`: a real published page always
beats a redirect with the same name, and a redirect whose target got
unpublished is dead (404), never a bounce onto nothing:

```ts
const redirect = await this.prisma.pageRedirect.findUnique({
  where: { fromSlug: slug },
  select: { toPage: { select: { slug: true, status: true } } },
});
if (redirect && redirect.toPage.status === PageStatus.PUBLISHED) {
  return { …, redirectToSlug: redirect.toPage.slug };   // frontend 301s
}
```

**Delete protection** - backend `remove`:

```ts
if (existing.status === PageStatus.PUBLISHED) {
  throw new ConflictException(
    'Cannot delete a published page - unpublish it first');
}
```

---

## 7. Where the legal pages came from (the migration)

The six legal pages (terms, privacy, cookies, cancellation, legal notice,
reviews policy) used to be **hard-coded React files** - editing a comma
meant a developer and a deploy. The migration:

1. The **exact HTML** each live page rendered was captured once into fixture
   files
2. A seed script publishes them as Page rows - through the same sanitizer as
   any admin save
3. Every URL was verified to render **identically** before and after
4. Only then were the old hard-coded files deleted

(One exception stayed as code: `manage-cookies` - it embeds the live
Cookiebot consent button, which a text CMS can't hold.)

### 📂 The code

**The captured content** - [`backend/prisma/pages-content/`](../../backend/prisma/pages-content/) -
six checked-in `.html` files, byte-true to what the routes rendered.

**The seed** - [`backend/scripts/seed-pages.ts`](../../backend/scripts/seed-pages.ts) -
run with `pnpm pages:seed` (or `--dry-run`). Fill-only-empty: an admin's
edits always beat the fixtures, so re-running is a no-op:

```ts
const english = existing.translations[0];
if (english && english.body.trim()) {
  // An admin (or an earlier run) already owns this content.
  console.log(`SKIP    ${slug}  (English body present)`);
  continue;
}
```

---

## The whole loop in one picture

```text
 ADMIN                      BACKEND                       VISITOR
──────                     ─────────                     ─────────
Dashboard /pages
  │ write in TipTap
  │ (live preview =
  │  public styling)
  ▼
 Save ──────────────► sanitizer cleans HTML
                          │ store in Postgres
 Publish ───────────► status → PUBLISHED
                          │
                          ├──► "bust the pages cache" ──► public site drops
                          │                               stale copies
                          │                                   │
                          │                              /en/terms requested
                          │                                   │
                          │            island? no → page? YES ┘
                          ▼                                   ▼
                    GET /pages/public/terms ──────► render title + body
                                                    tables in scroll cards
                                                    SEO tags + sitemap entry
```

**In one sentence:** the admin writes in an editor that already looks like
the live site, the backend cleans and stores the HTML once so it's forever
safe to render raw, and the public site catches any URL that isn't something
else, serves the page cached-fast, keeps old links alive through redirects,
and updates within seconds of every save.

---

## Appendix - every file in the system

### Backend (`island-tour-development/backend`)

| File | Role |
|---|---|
| [`prisma/pages.prisma`](../../backend/prisma/pages.prisma) | Page / PageTranslation / PageRedirect models + PageStatus enum |
| [`src/pages/pages.service.ts`](../../backend/src/pages/pages.service.ts) | All business logic: public read, CRUD, publish, rename+301, translations |
| [`src/pages/pages.controller.ts`](../../backend/src/pages/pages.controller.ts) | Routes: public `GET /pages/public/:slug`, admin CRUD under `MANAGE_EDITORIAL` |
| [`src/pages/dto/pages.dto.ts`](../../backend/src/pages/dto/pages.dto.ts) | Request/response shapes + validation (slug pattern, length ceilings) |
| [`src/pages/pages.swagger.ts`](../../backend/src/pages/pages.swagger.ts) | API documentation decorators |
| [`src/pages/pages.service.spec.ts`](../../backend/src/pages/pages.service.spec.ts) | 25 unit tests (fallback, rename, guards, sanitization) |
| [`src/common/utils/page-html.util.ts`](../../backend/src/common/utils/page-html.util.ts) | THE sanitizer (the security gate) |
| [`src/common/utils/slug.util.ts`](../../backend/src/common/utils/slug.util.ts) | `normalizePagePath` + `RESERVED_PAGE_SLUGS` / `RESERVED_GLOBAL_SLUGS` |
| [`src/destinations/destinations.service.ts`](../../backend/src/destinations/destinations.service.ts) | The mirror guard: a new island can't shadow existing pages |
| [`src/sitemap/sitemap.service.ts`](../../backend/src/sitemap/sitemap.service.ts) | Published pages enter the sitemap enumeration as `type: 'page'` |
| [`scripts/seed-pages.ts`](../../backend/scripts/seed-pages.ts) | The legal-pages migration seed (`pnpm pages:seed`) |
| [`prisma/pages-content/`](../../backend/prisma/pages-content/) | The captured legal HTML fixtures |

### Public frontend (`island-tour-development/frontend`)

| File | Role |
|---|---|
| [`app/(frontend)/[locale]/[destination]/page.tsx`](../../frontend/app/(frontend)/[locale]/[destination]/page.tsx) | Depth-1 fall-through (island → page → redirect → 404) |
| [`app/(frontend)/[locale]/[destination]/[slug]/page.tsx`](../../frontend/app/(frontend)/[locale]/[destination]/[slug]/page.tsx) | Depth-2 fall-through (entity → nested page) |
| [`app/(frontend)/[locale]/[destination]/[slug]/[...path]/page.tsx`](../../frontend/app/(frontend)/[locale]/[destination]/[slug]/[...path]/page.tsx) | Depth-3+ catch-all (Pages only) |
| [`components/frontend/legal/legal-page-shell.tsx`](../../frontend/components/frontend/legal/legal-page-shell.tsx) | Page chrome: title, English-only notice, prose container |
| [`components/frontend/legal/page-body.tsx`](../../frontend/components/frontend/legal/page-body.tsx) | Renders the sanitized body + wraps tables in scroll cards |
| [`app/(frontend)/frontend-tokens.css`](../../frontend/app/(frontend)/frontend-tokens.css) | `.it-page-prose` - the typography SOURCE OF TRUTH |
| [`lib/api/public/pages.ts`](../../frontend/lib/api/public/pages.ts) | Cached page loader (`getPublishedPage`, tag `pages`, strict fetch) |
| [`lib/cache-tags.ts`](../../frontend/lib/cache-tags.ts) | The cross-repo tag contract (byte-identical in the dashboard) |
| [`app/sitemap.ts`](../../frontend/app/sitemap.ts) | Expands page entries into 7-locale sitemap URLs |

### Dashboard (`tripwheel-x-islandtours-dashboard` - links resolve locally)

| File | Role |
|---|---|
| [`app/(app)/pages/`](../../../tripwheel-x-islandtours-dashboard/app/(app)/pages/page.tsx) | Routes: list, `/new`, `/[id]/edit` |
| [`components/pages/page-form.tsx`](../../../tripwheel-x-islandtours-dashboard/components/pages/page-form.tsx) | The form: title, auto-permalink, body Controller, SEO, OG image |
| [`components/pages/rich-text-editor.tsx`](../../../tripwheel-x-islandtours-dashboard/components/pages/rich-text-editor.tsx) | The TipTap editor + full toolbar |
| [`components/pages/resizable-image.tsx`](../../../tripwheel-x-islandtours-dashboard/components/pages/resizable-image.tsx) | Drag-corner image resizing (persisted `width`) |
| [`components/pages/rich-text-editor.css`](../../../tripwheel-x-islandtours-dashboard/components/pages/rich-text-editor.css) | Scoped editor styles + the `.it-page-prose` mirror |
| [`components/pages/pages-list-view.tsx`](../../../tripwheel-x-islandtours-dashboard/components/pages/pages-list-view.tsx) | List view: publish toggle, delete dialog, RBAC gating |
| [`components/pages/page-edit-view.tsx`](../../../tripwheel-x-islandtours-dashboard/components/pages/page-edit-view.tsx) | Edit header: status badge, Publish/Unpublish, View live |
| [`lib/api/pages.ts`](../../../tripwheel-x-islandtours-dashboard/lib/api/pages.ts) + [`hooks/pages/use-pages.ts`](../../../tripwheel-x-islandtours-dashboard/hooks/pages/use-pages.ts) | API client + TanStack Query hooks |
| [`lib/api/cache-revalidation.ts`](../../../tripwheel-x-islandtours-dashboard/lib/api/cache-revalidation.ts) | The cache-bridge producer (`case 'pages'`) |
| [`lib/page-highlight-colors.ts`](../../../tripwheel-x-islandtours-dashboard/lib/page-highlight-colors.ts) | Highlight swatch values (document data, shared with the sanitizer) |
| [`types/pages.ts`](../../../tripwheel-x-islandtours-dashboard/types/pages.ts) | TypeScript shapes mirroring the backend DTOs |
