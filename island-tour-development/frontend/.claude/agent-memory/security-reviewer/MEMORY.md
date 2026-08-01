# Security Reviewer Memory Index (frontend)

- [Checkout/TYP traveler-session review (2026-07-29)](checkout_typ_traveler_session.md) — first pass on this side of the repo; confirms the HttpOnly traveler-session cookie handoff and SSR-vs-browser fetch split are implemented correctly; one open note on `INTERNAL_API_SECRET` blast radius (shared with the backend memory)
- [Tour page v2 restyle (2026-08-01)](tour_page_v2_restyle.md) — clean design-only pass; confirms review-card initials render as plain JSX text, Maps link stays coordinate-only server-built, new SVGs are inert
- [TYP rebuild + checkout restyle (2026-08-01)](typ_rebuild_and_checkout_restyle.md) — zero findings; records renderTemplate + PAN-free card-state as reusable safe patterns to diff future changes against
