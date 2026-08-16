---
name: tours-admin-only-authority-stamp-pattern
description: tours.service.ts has an established, deliberate convention — raw `Role.ADMIN` (not isPlatformWideRole, not a Permission) gates "this write IS the official Island Tours stamp" actions; do not flag it as inconsistent on its own
metadata:
  type: project
---

`backend/src/tours/tours.service.ts` has TWO different, both-deliberate patterns for
"Island-Tours-owned" gating, and reviewing one against the other in isolation produces a false
positive:

1. **Permission-based** (`@RequirePermissions(Permission.MANAGE_EDITORIAL)` at the controller) —
   used for `locals-favourite` toggle. Any role holding that permission (including a STAFF account
   granted it via a designation) can act.
2. **Raw `requesterRole === Role.ADMIN` in-service** — used for actions that are specifically "the
   real admin's stamp," even excluding platform STAFF/EDITOR who otherwise read platform-wide via
   `isPlatformWideRole` (`common/utils/operator.util.ts`). Existing examples in this exact file
   before issue #73:
   - `cancellationHours` late-change bypass (~line 2900-2911)
   - `publish()`/`unpause()` approval-bypass — comment explicitly says "a platform-STAFF account
     granted MANAGE_TRIPS via a designation can review... but still cannot skip the gate here -
     only the real ADMIN role bypasses" (~line 3617-3625, ~3786-3794)
   - `remove()` archived-only bypass (~line 3882)

Issue #73 (slug becomes Island-Tours-owned, `create()`/`update()` slug handling) added a THIRD
instance of pattern 2, gated identically (`userRole === Role.ADMIN`), with comment language
("client review #12... only the real ADMIN role") that directly mirrors the publish/unpause
precedent. **This is consistent with established in-file convention, not a deviation** — do not
flag a bare `Role.ADMIN` check in this file as "should use a Permission instead" without first
checking whether it's an authority-stamp action (pattern 2) vs a general capability gate
(pattern 1, which already uses `@RequirePermissions`).

**Why:** `isPlatformWideRole` exists because a real incident (test report 2026-08-01 §Admin.4) —
checking ADMIN alone left an invited STAFF Operations Manager staring at empty Tours/Reviews/
Settlements screens for READ scope. That fix does NOT mean every ADMIN-only WRITE gate in this file
is the same bug; reads-scope and authority-stamp-writes are different axes and the file keeps them
deliberately separate.

**How to apply:** When reviewing a new mutation in `tours.service.ts` (or a sibling service) that
gates on `Role.ADMIN` alone, check: is this "who may call this endpoint" (→ should be
`@RequirePermissions`) or "whose action counts as the official platform decision, even among
callers who already passed the permission gate" (→ raw `Role.ADMIN` is the established pattern,
matches publish/unpause/cancellationHours/remove). Only flag the latter if it contradicts one of
the four precedents above.
