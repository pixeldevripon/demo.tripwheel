# Custom Scripts

> Admin-pasted vendor snippets injected into every public page.
> Dashboard: **Settings → Scripts** (`/settings?tab=scripts`). Built 2026-07-29.

---

## 1. What it is

A place for the tracking/vendor code the platform has no first-class field for -
Hotjar, Microsoft Clarity, a domain-verification `<meta>`, a chat widget. GTM,
GA4, the Meta Pixel and Cookiebot all have dedicated fields on `SiteSEO` and do
**not** belong here.

**One row per snippet, not two text blobs.** The obvious design is a "header
scripts" and a "footer scripts" textarea; it is the wrong one. In a merged blob
every edit is a diff against every other vendor's code, one broken snippet takes
the rest of them down with it, and there is no way to switch a single tool off
while working out which one slowed the site down. Each row instead carries its
own name, note, position, on/off switch and order.

---

## 2. Data model

`backend/prisma/custom-scripts.prisma` → table `custom_scripts`.

| Column | Notes |
|---|---|
| `name` | Required. An unnamed `<script>` is unmaintainable the moment a second one exists |
| `description` | Optional note: who owns the account, when it can be removed |
| `position` | `CustomScriptPosition`: `HEAD` \| `BODY_END`. Defaults to `BODY_END` |
| `code` | `@db.Text`. The raw markup, stored **verbatim** |
| `isActive` | Off removes it from every page without deleting it |
| `displayOrder` | Order within a position. **Execution order, not cosmetic** |

`@@index([isActive, position, displayOrder])` is exactly the public read's
predicate.

**Why `code` is stored verbatim:** an admin pastes a vendor's exact snippet.
Reformatting it would break subresource-integrity hashes and make vendor support
impossible ("we don't recognise this code"). Safety lives on the write path
instead, never in a rewrite.

Migration: `20260728170000_custom_scripts`.

---

## 3. The security model

This feature runs third-party JavaScript on every page including checkout. Be
honest about what is and is not being defended.

### What actually controls it

`MANAGE_SETTINGS` - ADMIN only, the same permission that controls the Stripe
keys. Anyone who can write here could already take the money. That is the
control; everything below is damage limitation around it.

### What is NOT validated, and cannot be

The **body of a `<script>`**. There is no rule that separates "Hotjar" from
"exfiltrate the checkout form". Any claim to sanitise this would be false
comfort.

### What IS validated

`backend/src/common/utils/custom-scripts.util.ts`, applied by
`@IsSafeCustomScript()` on the DTO. It stops the markup *around* the script from
breaking or hijacking the document:

- **Root allowlist** - only `<script> <style> <link> <meta> <noscript>` at the
  top level. Deny by default, so a tag nobody thought of is refused rather than
  waved through.
- **`<base>` is therefore impossible.** One `<base href>` silently re-points
  every relative URL on the site, including form actions. The quietest
  defacement there is, and the reason an allowlist beats a blocklist.
- **No loose text** at the root - it ends the `<head>` early and detaches
  everything after it.
- **Nothing unclosed** - an unterminated `<script>` swallows the rest of the
  document, on every route. Detected via htmlparser2's `isImplied` close flag.
- **No `on*` handlers, no `javascript:`/`vbscript:`/`data:text/html` URLs.**
- **`<iframe>`/`<img>` only inside `<noscript>`** - that is the shape of GTM's
  own snippet, and a `<noscript>` body is inert for anyone running JavaScript.
- **`<noscript>` is refused in `HEAD`** (cross-field rule, so it lives in the
  service, not the DTO): a browser closes the head when it meets one.
- 20 000 character ceiling per snippet.

### Defence in depth, in order

1. `MANAGE_SETTINGS` on every write endpoint.
2. The structural allowlist above, on create AND update - a snippet cannot be
   edited into an unsafe shape.
3. The public payload ships **parsed nodes**, never the raw string
   (`parseCustomScript`). Anything outside the root allowlist is dropped at this
   step, so a row written straight into the database - direct SQL, a restored
   dump, a future endpoint that forgets the DTO - can still only ever render as
   one of five tags. **Verified**: a `<base href="https://evil.example/">`
   inserted by hand never reached the payload.
4. The frontend re-checks each node's tag before rendering
   (`lib/api/public/custom-scripts.ts`).

### Auditing

Every mutation logs the admin id, the script name, and *which* dangerous thing
changed - `CODE CHANGED`, `ENABLED`, `DISABLED`, `moved to HEAD`. The code itself
is never logged: that would put the payload into the log pipeline. When something
starts misbehaving the first question is "what changed and who changed it", and
that answer has to exist before it is needed.

---

## 4. API

Base: `/api/v1/custom-scripts`

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `public` | public | Active snippets, parsed, split by position |
| GET | `/` | VIEW_SETTINGS | Every snippet, active or not |
| POST | `/` | MANAGE_SETTINGS | Add one (appends to the end of its position) |
| PATCH | `reorder` | MANAGE_SETTINGS | Whole list, one transaction |
| GET/PATCH/DELETE | `:id` | VIEW/MANAGE_SETTINGS | Read / edit / remove |

`GET public` returns `{ head: [{id, nodes}], bodyEnd: [...] }` where a node is
`{tag, attributes, html}`. Inactive rows are filtered **in the query** - a
switched-off vendor's code must never sit in the payload with a false flag for
the frontend to skip.

---

## 5. Rendering

`frontend/components/frontend/tracking/custom-scripts.tsx`, mounted twice in the
**root layout** (`app/layout.tsx`).

It must stay in the root layout: `next/script`'s `beforeInteractive` only works
there, and that layout renders once per document and is not re-rendered on soft
navigation, so each snippet executes exactly once - which every analytics vendor
assumes.

**Where each tag actually lands** (measured against the rendered document, not
assumed):

| Tag | Saved as `HEAD` ("Header") | Saved as `BODY_END` ("Footer") |
|---|---|---|
| `<meta>`, `<link>` | inside `<head>` | inside `<head>` |
| `<script async src>` | inside `<head>` | inside `<head>` |
| `<script>` inline | inside `<head>` | end of `<body>` |
| `<style>` | inside `<head>` | end of `<body>` |
| `<noscript>` | refused by validation | end of `<body>` |

All five allowlisted tags render; the table is measured, not assumed.

**"Header" really is the head.** The root layout renders an explicit `<head>`
element for this block. React only hoists SOME tags on its own (`<meta>`,
`<link>`, async `<script src>`); an inline `<script>` or a `<style>` is not
hoisted, so without a real `<head>` those fell to the top of `<body>` - which
executed early enough, but is not what a vendor means when their install page
says "paste this in `<head>`".

The Next docs advise against hand-writing `<head>` for METADATA; that is what
`generateMetadata` is for and nothing here bypasses it. This element carries only
admin-pasted vendor markup, which the Metadata API has no concept of. Verified
together: an inline script and a `<style>` render inside `<head>` while `<title>`,
`og:*` and the meta description are all still emitted correctly.

`<noscript>` stays refused in `HEAD`, and matters MORE now that this really is
the head - a browser closes `<head>` the moment it meets one, detaching every tag
after it.

### When a snippet runs - and why a DOM one-liner "does nothing"

Both positions execute **during document parse, before the page is
interactive**. `HEAD` runs before any content is drawn; `BODY_END` runs when the
browser reaches the end of the HTML - which is still before React has rendered
and hydrated the interactive chrome (the navbar search, the destination picker,
anything client-rendered).

Vendor snippets are written for exactly this and work. Hand-written code that
reaches for an element does not:

```html
<!-- Reported 2026-08-01 as "custom JavaScript is not working" -->
<script>document.querySelector("input[placeholder='Which Island?']").placeholder = "hello";</script>
```

From **either** position this throws `TypeError: Cannot set properties of null` -
the input does not exist yet. The same line pasted into the console works,
because by then the page has hydrated. Nothing about the injection is broken;
the snippet simply runs too early. Reproduced and confirmed: a probe snippet in
each position set its `window` flag and logged normally on the same page load.

The Footer hint in the dashboard used to read *"Runs once the content is on
screen"*, which is what made this look like a platform failure rather than a
timing one. Both hints now describe the moment, and the dialog carries a standing
note: code that looks for something on the page needs a `setTimeout` or a
`MutationObserver`, and it fails **quietly** - the error lives only in the
visitor's console.

The dashboard labels the two positions **Header** and **Footer** - the words
every vendor's install page uses, so an admin does not have to translate the docs
they are following. The stored enum stays `HEAD` / `BODY_END`.

Note the gap between that label and the table above: a "Header" inline `<script>`
does not literally sit in `<head>`. The guarantee it makes is about ORDER (it runs
before any content and before hydration), not placement, and the field hint in the
dialog says so. App Router has no supported way to author raw `<head>` children,
and the Metadata API owns that element - do not hand-write a `<head>` in the root
layout to "fix" this.

---

## 6. Caching

Cache tag **`custom-scripts`** (its own, not folded into `site-info`).

- Loader: `frontend/lib/api/public/custom-scripts.ts`, `cacheLife('days')`.
- Bust: `tagsForMutation` in the dashboard's `lib/api/cache-revalidation.ts`
  maps every `/custom-scripts*` write to it.
- The tag is registered in `lib/cache-tags.ts` in **both** repos (they are
  byte-identical by rule) so `app/api/revalidate/route.ts` accepts it.

It has its own tag because it busts the ROOT LAYOUT - the most expensive thing on
the site to regenerate - and because an admin toggling a snippet off is usually
mid-incident, where "wait out `cacheLife('days')`" is not an answer.

Outage behaviour: an unreachable backend degrades to **no scripts**, never to a
partial snippet.

---

## 7. The editor

`dashboard/components/settings/script-editor.tsx` - CodeMirror 6 with GitHub's
own light/dark themes (`@uiw/codemirror-theme-github`), following `next-themes`.
HTML mode, so `<script>` bodies get JS highlighting from the nested parser.

Autocomplete and auto-close-brackets are **off on purpose**: both EDIT what you
paste, and a snippet has to arrive byte for byte or the vendor cannot support it.

Validation is deliberately **not** mirrored in the browser. The backend allowlist
is the single source of truth; a second copy would drift and start rejecting
snippets the server accepts. The server's reason comes back in the error toast
and is specific enough to act on ("`<base>` is not allowed", "`<script>` is never
closed").

---

## 8. Code map

**Backend** (`island-tour-development/backend/`)
- `prisma/custom-scripts.prisma` · `prisma/enums.prisma` (`CustomScriptPosition`)
- `src/common/utils/custom-scripts.util.ts` - allowlist + parser (the security core)
- `src/common/validators/is-safe-custom-script.validator.ts`
- `src/custom-scripts/` - dto / swagger / service / controller / module

**Public site** (`island-tour-development/frontend/`)
- `lib/api/public/custom-scripts.ts` · `lib/cache-tags.ts`
- `components/frontend/tracking/custom-scripts.tsx` · `app/layout.tsx`

**Dashboard** (`tripwheel-x-islandtours-dashboard/`)
- `types/custom-scripts.ts` · `lib/api/custom-scripts.ts` · `lib/api/cache-revalidation.ts`
- `hooks/custom-scripts/use-custom-scripts.ts`
- `components/settings/script-editor.tsx` · `components/settings/custom-scripts-form.tsx`
- `components/settings/admin-settings.tsx` - its own **Scripts** tab, directly
  after SEO. Not folded into SEO: it emits into the same place SEO does, but it
  is the one surface on this page that executes arbitrary third-party code on
  every route including checkout, and a thing you audit should not be a card you
  have to scroll to find.
