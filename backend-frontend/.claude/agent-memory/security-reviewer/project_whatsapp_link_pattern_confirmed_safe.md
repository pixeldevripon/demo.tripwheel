---
name: project_whatsapp_link_pattern_confirmed_safe
description: The site-wide WhatsApp deep-link helper (lib/whatsapp.ts buildWhatsappUrl) is a confirmed-safe, reusable pattern - checked when reviewing tours-trust-strip.tsx (2026-08-01)
metadata:
  type: project
---

`frontend/lib/whatsapp.ts` → `buildWhatsappUrl(number, enabled, greeting?)` is the one deep-link
builder for every WhatsApp surface on the public site (per its own header comment: tour description
inline links, global footer, error states, NeedHelp components, post-purchase email, and now
`tours-trust-strip.tsx`). Confirmed safe on the 2026-08-01 review of the All Tours trust-strip
rewrite:

- URL is always hardcoded to `https://wa.me/{digits}` - `digits` comes from
  `normalizeWhatsappNumber()` which strips everything but `\D` via regex, so there is no path for a
  `javascript:` scheme or arbitrary host even if an admin puts garbage in the Settings number field.
- Optional `greeting` (prefilled message) goes through `encodeURIComponent` before being appended as
  a query string - no raw interpolation.
- Returns `null` (not `href='#'`) when chat is disabled or the number is unusable ( < 8 digits after
  stripping), so callers branch on one value and the whole anchor is omitted rather than rendering a
  dead/malformed link.
- Backing data (`getPublicSiteInfo()` in `lib/api/public/settings.ts`) nulls `whatsappNumber`
  server-side whenever `enableWhatsappChat` is false, and falls back to chat-disabled on a backend
  outage.

**How to apply:** any future review of a component that renders a WhatsApp link only needs to check
(a) it calls `buildWhatsappUrl` (not building the `wa.me` URL by hand) and (b) the anchor carries
`target='_blank' rel='noopener noreferrer'`. No need to re-audit the helper itself unless
`lib/whatsapp.ts` or its backend mirror (`backend/src/common/utils/whatsapp.util.ts`) changes.
