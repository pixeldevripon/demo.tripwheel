---
name: finding_ical_parser_unbounded_expansion_dos
description: HIGH finding (reported 2026-08-02, unfixed as of report time) - ical-parser.util.ts caps recurrence expansion per-event and caps total blocks AFTER collection, not during, allowing a single malicious/compromised feed to freeze the API process
metadata:
  type: project
---

`backend/src/calendar-sync/ical-parser.util.ts` caps RRULE expansion at 200
instances PER EVENT (`LIMITS.maxInstancesPerRule`, correctly defeats "COUNT=999999
/ no UNTIL" on a single event) and caps total output at `LIMITS.maxEvents = 5000`
- but that second cap is applied via `blocks.slice(0, LIMITS.maxEvents)` in
`parseBusyBlocks` AFTER `collectBlocks` has already built the full array in
memory. `collectBlocks`/`emitRecurring` have no running-total check while
looping over VEVENTs.

A ~5MB feed (the max `safeFetchFeed` allows) packed with tens of thousands of
compact recurring VEVENTs (~90-100 bytes each: `UID`+`DTSTART`+
`RRULE:FREQ=DAILY;COUNT=200`) can therefore produce roughly 10 million `BusyBlock`
object pushes + a large `Set`-based dedup + a final `Array.sort` before the cap
ever applies. `parseBusyBlocks` is fully synchronous (no `await`, no yielding),
and is called SYNCHRONOUSLY in the main API request handler for both
`POST /calendar-subscriptions/validate` (calendar-sync.service.ts `validate()`)
and `POST /calendar-subscriptions/:id/sync` (`syncNow()` -> `runSync()` directly,
NOT via the BullMQ queue - only the scheduled tick path goes through the worker).
One request with one malicious URL is enough; no flooding required. This blocks
the Node event loop for the whole platform (all tenants) for as long as the
computation takes.

**How to apply**: if/when this gets fixed, verify the fix moves the
`blocks.length >= LIMITS.maxEvents` check INSIDE the collection loop (early
break, not post-hoc slice), and consider whether `validate()`/`syncNow()` should
route through the BullMQ worker like the scheduled tick does rather than running
inline in the API request. If a similar "parse third-party payload, cap it
somehow" pattern shows up elsewhere in the codebase, check whether the cap is
enforced DURING the expansion loop or only after - this exact mistake (cap
computed too late) is worth grepping for by pattern, not just in this file.
