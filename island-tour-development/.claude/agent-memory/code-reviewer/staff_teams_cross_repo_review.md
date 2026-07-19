---
name: staff_teams_cross_repo_review
description: Cross-repo review of the Staff & Teams feature (backend fine-grained permissions + dashboard team UI) - 2026-07-19
metadata:
  type: project
---

Reviewed the just-built Staff & Teams module across both repos: backend `src/staff/*` + `config/staff.config.ts` + guard/auth/operator touch points, and dashboard `components/staff/*`, `hooks/staff/use-staff.ts`, `lib/api/staff.ts`, `types/staff.ts`, sidebar/nav wiring.

**Dashboard side is clean** - no findings worth recording beyond "this is the reference implementation to point future team/permission-matrix UIs at": query key factory (`staffKeys`), toast-in-hook, minimal `'use client'` boundaries, DataTable + useTableState reused correctly, `operatorId` placement (body vs query string) matches the backend route-by-route exactly on every one of the 12 endpoints (verified, not assumed).

**Backend findings are the substantive ones** - full detail lives in the backend repo's own agent memory since they're backend-file-specific: `backend/.claude/agent-memory/solid-dry-reviewer/staff_team_module_review.md`. Headline items: a verified IDOR-shaped scope gap on `GET /users/:id/permissions` (gated by a permission that's grantable to non-owner operator seats via designation, but the service does zero ownership scoping), and `StaffService.updateTeamMember` doing two non-atomic writes (validated the response is NOT stale - Prisma always returns the fresh row - but a mid-flight validation failure leaves a committed partial write).

**How to apply:** when reviewing dashboard-only or backend-only follow-up work on this module, read the sibling memory file for the other repo's context too - the permission ceiling model (`staff.config.ts`) and the dashboard's mirrored `lib/config/rbac.ts` must stay in lockstep, and a change on one side without checking the other is how they'd drift.
