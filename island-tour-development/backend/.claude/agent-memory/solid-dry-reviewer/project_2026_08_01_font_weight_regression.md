---
name: project_2026_08_01_font_weight_regression
description: A 2026-08-01 QA-fix diff (locale-switcher prefetch, guest photo lightbox, cancellation withdraw, etc.) silently carried a bulk font-bold/medium/extrabold to font-normal Tailwind class replacement across many unrelated files.
type: project
---

While reviewing the 2026-08-01 QA-fix batch (locale-switch prefetch hook, mobile navbar icon size,
guest-photo 4:3 lightbox strip, drag-scroll dragstart fix, collections/instagram padding, traveller
cancellation withdraw), found ~15 instances across the explicitly-in-scope files (and ~9 more in
adjacent checkout files not in scope) where `font-bold` / `font-extrabold` / `font-medium` /
`font-semibold` were replaced with `font-normal` — headings, review star ratings, avatar initials,
reviewer names, CTA buttons, active-menu-item state in the locale/currency selectors. None of this
was described in the task's change summary, and the 1:1 removed/added count plus accompanying
unrelated reformatting (import order, arrow-paren style) strongly suggests an accidental bulk
edit/auto-format pass, not a deliberate typography decision.

**Why this matters for future reviews:** this repo has no prettier config (project rule: never
bare `prettier --write`), so large incidental reformatting inside a feature diff is itself a
signal something ran that shouldn't have — check `git diff` for suspiciously wide blast radius
(import reordering, quote/paren style shifts) whenever a "small QA fix" touches many lines in a
file. Also cross-check: does the git status show far more modified files than the task's explicit
scope? If so, don't assume everything in a listed file's diff is intentional — this repo runs
concurrent Claude sessions on shared working trees (see the user-global "Multi-session git traps"
memory), so unrelated regressions can get bundled into an otherwise-legitimate commit.

**How to apply:** when a diff touches visual/Tailwind classes far outside the stated scope of the
change, call it out explicitly as a likely accidental regression rather than reviewing it as an
intentional design choice.
