# Phase 2B - Cross-App Cache Revalidation Specification

> How the dashboard invalidates the public site's `'use cache'` entries after the split.

> ## Read this first: the domain decision does NOT solve this
>
> **DECISION 2026-07-17: the public site stays on a `tripwheel.io` subdomain for now**, which parks
> the cross-site cookie problem in `02` §1.2 completely.
>
> **It does nothing for this document.** This problem is about **process separation, not domain**.
> Two Next.js applications have two independent caches whether they sit on `island.tours` and
> `dashboard.tripwheel.io`, or on `island.tripwheel.io` and `dashboard.tripwheel.io`, or on two ports
> of localhost. `updateTag()` mutates the calling process's cache. The other process never hears it.
>
> The **only** thing the subdomain decision changes here is one env var
> (`REVALIDATE_TARGET_URL`) and the fact that the POST is now a same-site server-to-server call. The
> design, the failure mode, and every requirement below are unchanged.
>
> **This document applies in full from Phase 7 onward.** It does not apply before Phase 7, because
> until the split there is only one process and the current code is correct.
>
> This is the **only silent failure** in the extraction. Nothing else in the migration can break
> without a build error, a type error, or a 500. This can break with total silence: the dashboard
> keeps firing, the public site keeps serving stale pages, and the first report comes from a customer
> looking at a price that no longer exists.

---

## 1. The problem

### 1.1 What works today, and why

```
Browser (dashboard route)
  └─ apiFetch()                        lib/api/fetch.ts:64
       └─ revalidatePublicForPath()    lib/api/cache-revalidation.ts:167
            └─ revalidateCacheTags()   app/_actions/revalidate.ts   'use server'
                 └─ updateTag(tag)     next/cache
                      └─ invalidates entries written by lib/api/public/* cacheTag(...)
```

This works for exactly one reason: **the dashboard and the public site are the same Next.js process.** `updateTag` mutates the in-process cache that the public site's `'use cache'` scopes read from. The Server Action hop exists only because `updateTag` is server-only and the caller is a browser.

### 1.2 What breaks

After the split there are two Next.js applications on two domains with two independent caches.

`updateTag('tours')` called inside `dashboard.tripwheel.io` invalidates **the dashboard's own cache**, which contains nothing - the dashboard does not use `'use cache'` at all. It is a no-op against a cache nobody reads.

Meanwhile `island.tours` never hears about the write.

| Property | Value |
|---|---|
| Build error | none |
| Type error | none |
| Runtime error | none |
| Test failure | none (unless a test spans both apps) |
| Symptom | public pages serve stale content until `cacheLife` expires |
| Worst case today | `getPublicSiteInfo` is `cacheLife('days')` - a logo/WhatsApp change is invisible for **days** |

This is why the item is ranked as the top extraction risk in `01-AUDIT-REPORT.md` (A-5) and why it gets its own document.

### 1.3 What is already broken, and stays broken

Worth stating so the new design is not blamed for an old gap: **only writes that originate in the dashboard browser ever bust the cache today.** `revalidatePublicForPath` is called from `apiFetch`, which is the dashboard's client. Nothing else calls it.

So these writes have never busted the public cache and still will not:

| Write source | Example |
|---|---|
| BullMQ nightly jobs | quality-score recompute, eligibility, materialization |
| Stripe webhooks | booking confirmed -> capacity changes -> `isBookable` flips |
| Backend admin scripts / seeds | |
| Any future backend-initiated mutation | |

This is a **pre-existing coverage gap, not a regression**, and it is the single strongest argument for the target state in §8 (backend-emitted revalidation). It is out of scope for the split.

---

## 2. Options considered

| # | Option | Backend change | Coverage | Verdict |
|---|---|---|---|---|
| 1 | **Dashboard Server Action -> HTTP POST -> public `/api/revalidate`** | none | dashboard-originated writes only (= today) | **Chosen for v1** |
| 2 | Backend emits via outbox/BullMQ -> POST -> public `/api/revalidate` | required | **all** writes | **Target state.** Correct shape. Blocked on backend work. |
| 3 | Browser POSTs the public endpoint directly | none | same as 1 | **Rejected.** The shared secret would ship to the browser, and it needs CORS on a cache-control endpoint. Non-starter. |
| 4 | Drop push; rely on short `cacheLife` | none | n/a | **Rejected.** Tour price/status staleness windows are not acceptable, and shortening TTLs globally trades correctness for origin load. |
| 5 | Shared Redis cache handler across both apps | infra | dashboard-originated | **Rejected.** Re-couples the two frontends through shared infrastructure - precisely the coupling the split exists to remove. |

### 2.1 Why option 1, honestly

Option 1 is not the architecturally correct answer. Option 2 is. Option 1 makes the dashboard know that `island.tours` exists and know its cache-tag vocabulary, which is a frontend-to-frontend coupling between two services that are supposed to be independent.

It is chosen because:
- It requires **zero backend change**, which is a hard constraint on this project.
- It is a **small diff**: the tag-mapping logic (`cache-revalidation.ts`, ~160 lines of well-reasoned path->tag rules) is kept verbatim. Only the transport changes.
- The Server Action seam **already exists** in exactly the right place, for an unrelated reason. The secret never touches the browser.
- It preserves today's coverage exactly, so it cannot regress.
- It is a clean stepping stone: when the backend gains option 2, the public `/api/revalidate` endpoint stays identical and only the *caller* changes.

The coupling is real and should be recorded as debt, not pretended away.

---

## 3. Architecture (v1)

```
Browser (dashboard.tripwheel.io)
  └─ apiFetch(path, {method})                     lib/api/fetch.ts
       │  ... write succeeds ...
       └─ revalidatePublicForPath(path, method)   lib/api/cache-revalidation.ts   [UNCHANGED LOGIC]
            │  maps path+method -> CacheTag[]
            └─ revalidateCacheTags(tags)          app/_actions/revalidate.ts  'use server'
                 │                                 ── same-origin RPC, secret stays server-side ──
                 └─ POST https://island.tours/api/revalidate
                      headers: x-revalidate-secret: <REVALIDATE_SECRET>
                      body:    { tags: ["tour:abc", "tours", "search"] }
                            │
                            ▼
             island.tours  app/api/revalidate/route.ts   [NEW, public repo]
                 ├─ timing-safe secret compare      -> 401
                 ├─ validate every tag vs union     -> 400   (drift guard, §5)
                 └─ revalidateTag(tag) for each     -> 200 { revalidated: [...] }
                      └─ invalidates lib/api/public/* cacheTag(...) entries
```

### 3.1 Why the Server Action stays

It is tempting to delete the Server Action and POST from the browser. Do not:

1. **`REVALIDATE_SECRET` must never reach the client.** A browser-side POST needs the secret in JS.
2. Cross-origin browser POST needs CORS on the public site's cache-control endpoint - a needless attack surface.
3. The Server Action is already there. Its only reason to exist was that `updateTag` is server-only; that reason evaporates, but a better one replaces it.

---

## 4. The public endpoint

**Location:** `island.tours` repo, `app/api/revalidate/route.ts`.

### 4.1 `revalidateTag`, NOT `updateTag`

> **This is the single most important implementation detail in this document.**

Per the Next.js 16 API reference: **`updateTag` can only be called from within a Server Action and throws in a Route Handler.**

```
// This will throw an error
updateTag('posts')
// Error: updateTag can only be called from within a Server Action
```

A naive port of `revalidate.ts` into a Route Handler - keeping `updateTag` because that is what the current code says - **throws at runtime on every call**. It would fail the moment it shipped, and because the caller is fire-and-forget today (§6), it would fail *silently*.

The Route Handler must use `revalidateTag`.

### 4.2 The profile argument, and a real behavior decision

`revalidateTag` takes an optional cache-life profile that changes staleness semantics:

| Call | Semantics |
|---|---|
| `revalidateTag(tag)` (no profile) | Legacy behavior, **equivalent to `updateTag`**: immediate invalidation, the next request waits for fresh data. No stale serve. |
| `revalidateTag(tag, 'max')` | Stale-while-revalidate: serves cached data while fetching fresh in the background. Next.js docs **recommend this** for webhook/API revalidation endpoints. |

**Decision: use `revalidateTag(tag)` with no profile.**

Rationale, and the trade-off is genuine:

- The prime directive of this project is **zero functional regression**. No-profile is byte-for-byte the current `updateTag` semantics. `'max'` is a behavior change.
- `app/_actions/revalidate.ts:50-55` documents a deliberate choice of `updateTag` over `revalidateTag` *specifically for immediacy*. That reasoning was written by someone who thought about it. Overriding it during an extraction, as a side effect of a transport change, is exactly the kind of quiet scope creep that makes a migration unreviewable.
- The operator flow argues for immediacy: publish a tour -> click "View on site" -> **see the published tour**. Under `'max'` they would see the pre-publish page once, then the correct one after a refresh. That is a confusing bug report waiting to happen ("I published it and the site didn't update").

**Counter-argument, recorded because it is not weak:** the read-your-own-writes rationale is weaker across a domain boundary than it was in-process. The operator is not reading `island.tours` in the same request; there is a human hop of at least a few seconds, which is likely longer than a background refresh. `'max'` would give the public site better p99 latency and no request blocking on a cold tag.

**Therefore:** ship no-profile for parity. Revisit `'max'` as a **deliberate, separately-reviewed tuning change** after the split is green and measured - not during it. Recorded in `06` as a post-split candidate.

### 4.3 Endpoint contract

| Property | Value |
|---|---|
| Method | `POST` |
| Path | `/api/revalidate` |
| Auth | `x-revalidate-secret` header, **timing-safe** compare against `REVALIDATE_SECRET` |
| Body | `{ "tags": string[] }` (max 32 entries) |
| 200 | `{ "revalidated": string[] }` |
| 400 | `{ "error": "unknown_tag", "tags": [...] }` - drift guard, §5 |
| 401 | `{ "error": "unauthorized" }` - no detail |
| 405 | non-POST |
| Rate limit | secret-gated, so low risk; a modest per-IP cap is still advised |
| Runtime | Node (needs `crypto.timingSafeEqual`) |
| Indexing | must not be crawlable or cached |

Requirements:
1. **Timing-safe comparison.** `===` on a secret leaks length and prefix under timing analysis. Use `crypto.timingSafeEqual` on equal-length buffers, and compare lengths first without early-returning on the content.
2. **Batch.** One POST carries all tags for a write. `POST /tours` maps to 3 tags (`tour:<id>`, `tours`, `search`); that must be one request, not three.
3. **Never echo the secret** in errors or logs.
4. **Bounded.** Cap `tags.length` (32 is generous - the largest current mapping produces 4).

---

## 5. The tag contract, and how it fails

After the split, the `CacheTag` union exists in **two repositories**:

| Repo | Role |
|---|---|
| dashboard | **produces** tags (`cache-revalidation.ts` maps path -> tag) |
| island.tours | **consumes** tags (`lib/api/public/*` calls `cacheTag(...)`) |

Nothing mechanically keeps them aligned. This is contract B3 in `02-EXTRACTION-SPEC.md` Appendix B.

**The failure mode is the worst kind.** If the public site renames `site-info` to `site` and the dashboard is not updated, the dashboard POSTs `site-info`, the public site cheerfully accepts a tag nothing is tagged with, returns `200 { revalidated: ["site-info"] }`, and **the cache is never busted**. Green checkmarks all the way down, stale content forever.

### 5.1 The guard: validate and reject

**The public endpoint must validate every incoming tag against its own union and return 400 on any unknown tag.**

This is the whole design. It converts a silent, permanent staleness bug into a loud 400 that the dashboard logs (§6) on the very first write after the drift. It costs one `Set` lookup.

```
Coarse:   tours | search | hubs | categories | collections | destinations
          | reviews | slug-registry | site-info | user-profile
Granular: tour:<id> | destination:<id> | hub:<id> | category:<id>
          | collection:<id> | operator:<id>
```

Validation: a tag is valid if it is in the coarse set, **or** it splits on `:` into exactly two parts whose prefix is in the granular set and whose suffix is non-empty.

**Reject partial batches wholly.** If any tag is unknown, 400 the whole request and revalidate nothing. A partial success would leave the caller believing it succeeded. Fail loud, fail complete.

### 5.2 Also required: fix defect B-1 while porting

`lib/api/cache-revalidation.ts` declares `case 'settings'` **twice**: `:142` (pushes `user-profile`, `break`) and `:150` (pushes `site-info` when `seg1 === 'site'`). The first match wins; `:150-152` is unreachable.

So `PATCH /settings/site` - logo, WhatsApp, Instagram, read by the public footer and every NeedHelp surface - pushes only `user-profile` and **never busts `site-info`**, which is `cacheLife('days')`.

**This bug is live in production today**, independent of the split. Fix: merge the two cases into one, pushing `user-profile` always and `site-info` when `seg1 === 'site'`.

Fix it **in the current repo first** (migration step 0 in `02-EXTRACTION-SPEC.md` §10) so it ships now, then carry the corrected file across. Do not let a real production bug wait on an architecture project.

### 5.3 Keep these two special cases

The existing mapping has two non-obvious rules that a rewrite would lose. Both are correct:

| Rule | Why |
|---|---|
| `/availability/check` short-circuits (`:76`) | It is a **read shaped as a POST**. Revalidating on it would loop. |
| `seg1 === 'slug'` excluded from the granular `tour:<id>` tag (`:64-66`) | `/tours/slug/:slug` is a lookup, not an entity id. |

### 5.4 Where the contract lives: `lib/cache-tags.ts` (both repos)

> **Added at implementation, 2026-07-17.** The spec above describes the contract but never said
> where it lives. Built as written, it lived nowhere in particular: the dashboard held a hand-written
> **type union** inside a `'use server'` file, the public site held a **runtime `Set`** inside the
> route handler. Two repos x two shapes x zero shared definition, and **nothing stopped the two
> halves disagreeing even within a single repo.**

**The vocabulary is now one file, at the same path in both repos:**

```
<dashboard-repo>/lib/cache-tags.ts     ← byte-identical
<public-repo>/lib/cache-tags.ts        ← byte-identical
```

| Property | Why |
|---|---|
| **Byte-identical, same path** | Makes drift **one command**: `diff <dashA>/lib/cache-tags.ts <dashB>/lib/cache-tags.ts`. Empty output = the contract holds. |
| **Types DERIVED from the arrays** (`type CoarseCacheTag = (typeof COARSE_CACHE_TAGS)[number]`) | One list per concept. Previously the type and the Set were separate hand-maintained lists that could silently disagree. |
| **Both repos carry the whole file**, though each mainly uses one half | The dashboard needs the types to *build* tags; the public site needs the arrays to *validate* them. The moment the files differ "harmlessly", `diff` stops being a check. |
| **No shared npm package** | A shared dependency would re-couple the two services the split exists to separate (same reasoning that rejects option 5 in §2). |

**Changing a tag:** edit the file in **both repos, in the same change**, and **ship the public site
first** - it must accept the new name before the dashboard sends it. Reverse that order and every
write 400s until the second deploy lands.

**What does NOT enforce this - stated plainly:**

- **There is no CI guard, and there is no cheap way to add one.** A cross-repo check needs both repos
  checked out; the monorepo has `.github/workflows/ci.yml`, and **the dashboard repo has no CI at
  all**. Options are a shared package (rejected above), a workflow that clones the sibling repo with
  a token (fragile, and it re-introduces the coupling), or a committed hash of the sibling's file
  (stale the moment either side ships). None are worth their weight against a guard that already
  fires on the first write.
- **The 400 is a runtime feedback loop, not a compile-time one.** It is fast - the first write after
  a bad deploy - but it is *detection*, not *prevention*. `diff` is the prevention, and it is manual.
- **Neither repo has a unit-test runner** (Playwright only). The §10.1/§10.2 checks were run as
  harnesses against the real files, not committed tests. **Adding a runner is a separate decision.**

**The check to re-run whenever either side's tag names move** (this is what caught nothing today
because nothing had drifted yet - run it when something has):

1. `diff` the two `lib/cache-tags.ts`. Any output at all is drift.
2. Enumerate every tag the dashboard's mapping can emit (17 distinct across 208 write shapes) and
   POST each to the live endpoint. All must 200. That is `producer ⊆ consumer`, proven rather than
   assumed.

---

## 6. Reliability: stop swallowing failures

Today: `void revalidateCacheTags(tags).catch(() => {})` (`cache-revalidation.ts:174`).

Fire-and-forget with a swallowed catch was defensible in-process, where the call was a local function that essentially could not fail, and the design goal was "a revalidation failure must never fail the operator's write."

**Across a network it is indefensible.** The call can now fail from: DNS, TLS, a public-site deploy, a 401 on a rotated secret, a 400 on tag drift (§5), a timeout, a 5xx. Every one of those means **the public site is silently stale** and nobody knows.

### 6.1 Requirements

| # | Requirement | Rationale |
|---|---|---|
| R1 | **Keep the write path non-blocking.** A revalidation failure must never fail or delay the operator's save. | Preserves today's guarantee. Non-negotiable. |
| R2 | **Log every failure with the tags, the status, and the path.** | The minimum viable fix. A swallowed catch is now a silent data-correctness bug. |
| R3 | **Retry transient failures** (network, 5xx, timeout) with the same `[300, 800]` + jitter backoff `apiFetch` uses. | Consistent with the codebase's existing, correct retry vocabulary. |
| R4 | **Never retry 400 or 401.** | Both are permanent. 400 = tag drift (a code bug). 401 = secret mismatch (a config bug). Retrying spams. |
| R5 | **Timeout at ~3s.** | Bound the Server Action. |
| R6 | **Surface a persistent failure to a human.** At minimum a structured `console.error` that the platform's log drain alerts on. | Otherwise R2 just writes to a file nobody reads. |

### 6.2 The honest gap

Even with R1-R6, a revalidation lost to a hard failure is **lost forever**. There is no queue and no replay. The public site stays stale until `cacheLife` expires or someone writes to the same entity again.

Making this durable requires a queue, and the backend already has one (outbox + BullMQ). That is §8. **v1 accepts this gap and mitigates it with the TTL safety net (§7) and alerting (R6).** Recorded as debt, not solved.

---

## 6A. Efficiency: request volume and coalescing

§6 makes revalidation *reliable*. This section makes it *cheap*. They are different problems and the
second one is currently unaddressed - in this document and in the code.

### 6A.1 The actual problem: N writes fire N revalidations of the same tags

`revalidatePublicForPath` is called from `apiFetch` on **every successful write**
(`lib/api/fetch.ts:64`). The dashboard's save model is per-row and per-tab (finding C-2: "no global
save, no autosave"), so a single operator task produces a burst of writes - and every one of them
maps to the **same 2-3 tags**.

Measured from the Phase 0 discovery:

| Operator action | Writes | Revalidation POSTs | Tags fired (identical every time) |
|---|---|---|---|
| Save a 7-day x 3-time schedule (`trip-schedules-tab.tsx:464-477`) | 21 sequential POSTs | **21** | `tours`, `search` |
| Add 5 images (`trip-images-tab.tsx:80-108`, one POST per image) | 5 | **5** | `tour:<id>`, `tours`, `search` |
| Reorder one image (`:155-184`, 2 PATCHes per arrow click) | 2 | **2** | `tour:<id>`, `tours`, `search` |
| Add/remove one start time | 1 full `PATCH /tours/:id` | 1 | `tour:<id>`, `tours`, `search`, `slug-registry` |
| **Translate 1 tour into 6 locales** (C-1) | **~120 saves** | **~120** | `tour:<id>`, `tours`, `search` |

Each POST costs: a Server Action RPC, a cross-app HTTP round trip, and - on the public side - a
`revalidateTag` that invalidates **every cached entry carrying that tag**. `tours` and `search` are
coarse: they span 7 locales x 2 currencies x N destinations. So ~120 saves during one translation
session invalidate the entire public tour surface ~120 times, and every public request landing in
that window pays a regeneration.

**This is not a regression** - it happens today, in-process. The split makes it *visible* (it becomes
network traffic) but not *worse*. It is, however, the thing to fix while we are here.

### 6A.2 Fix 1 (largest): reduce the writes, not the revalidations

**The efficiency of revalidation is downstream of the save model.** This is the important insight:
do not optimize the revalidation transport for a write pattern the redesign is already deleting.

| Action | Writes today | Writes after `04` | Revalidations after |
|---|---|---|---|
| Translate 1 tour x 6 locales | ~120 | **6** (Translation Console, one save per locale - `04` §3.2) | 6 |
| Edit a tour's details | up to 20 scattered saves | **1 per route** (`04` §2.2 D) | 1 |
| Save a 7x3 schedule | 21 | **1** (bulk endpoint, Appendix A5) | 1 |
| Reorder images | 2 per arrow click | **1 per drop** (bulk reorder, A6) | 1 |

`04` and Appendix A5/A6 remove ~95% of the volume at source, without touching the cache layer at all.
Nothing in this section beats that.

### 6A.3 Fix 2 (immediate): throttle with leading + trailing edge

For the bursts that remain, coalesce in the dashboard **before** the Server Action.

**Design: per-unique-tag-set throttle, leading + trailing, ~1s window.**

| Property | Behavior | Why |
|---|---|---|
| **Leading edge fires immediately** | A single isolated save revalidates instantly | **No regression.** The common case (one save, then "view on site") is unchanged. |
| **Trailing edge flushes once at window end** | A burst of 21 collapses to **2** calls, not 21 | Catches anything that changed after the leading call |
| **Tags accumulate into a `Set`** | The burst's tags are de-duplicated | They are identical anyway |
| **Window ~1s** | Short enough to be imperceptible against the human hop to the public site | |
| **Flush on `pagehide` / `visibilitychange`** | Best-effort rescue if the operator closes the tab mid-window | |

Result: 21 POSTs -> 2. ~120 -> a handful. And combined with 6A.2, the bursts largely stop existing.

**Why not a plain trailing debounce:** it would delay *every* revalidation, including the single-save
case, and a debounce long enough to be useful is long enough to be lost on tab close. Leading+trailing
keeps the common case instant and only coalesces actual bursts.

**The honest risk:** a trailing flush can still be lost if the tab dies inside the window. Mitigations:
keep the window short, flush on `pagehide`, and rely on the `cacheLife` backstop (§7). Note
`navigator.sendBeacon` is **not** an option here - it cannot invoke a Server Action, and calling the
public endpoint directly would leak `REVALIDATE_SECRET` to the browser (§2, option 3 - rejected).

### 6A.4 Fix 3 (optional, deferred): the `'max'` profile

§4.2 chose `revalidateTag(tag)` with no profile, for parity with today's `updateTag` semantics.

There is a real efficiency argument for `'max'` (stale-while-revalidate) that §4.2 did not make: under
no-profile, the next public request **blocks** until fresh. During a burst, every public visitor
landing in that window pays a blocking regeneration. Under `'max'`, they get stale content instantly
while the refresh happens in the background - better p99, no thundering herd.

**It is still deferred, and 6A.2 + 6A.3 are why:** once bursts are coalesced and the save model is
fixed, the blocking window is rare enough that the parity argument wins. Revisit `'max'` only if
measurement shows the blocking regenerations actually hurt. **Do not adopt it as a guess.**

### 6A.5 Fix 4 (do not do this yet): narrower tags

It is tempting to narrow the mapping - e.g. "a highlight translation should not bust the whole `tours`
listing".

**Resist it.** The current mapping is deliberately conservative, and conservative is correct here: the
cost of over-invalidation is a regeneration; the cost of under-invalidation is **serving wrong prices**.
Those are not symmetric.

There is also a concrete trap. `hooks/trips/use-trips.ts:362-363` and `:858-861` invalidate
`tripKeys.detail` on age-band/highlight/inclusion/exclusion/schedule/exception mutations, with the
comment that `priceFrom`/`isBookable`/counts **recompute server-side**. So a child-collection write
genuinely can change what the public listing shows. A "surely a highlight doesn't affect the listing"
narrowing would be wrong.

If tag granularity is ever revisited, it needs the **backend** to say what changed (§8), not a frontend
guessing from a URL.

### 6A.6 Where efficiency really ends up: §8

The target state (backend-emitted revalidation) coalesces *naturally* and for free:

- The outbox worker already batches. One tour edit -> one event -> one revalidation, regardless of how
  many HTTP writes the dashboard made.
- The backend **knows what actually changed** (which columns, which relations), so it can emit precise
  tags instead of a frontend reverse-engineering them from a URL path.
- BullMQ gives durable retries, so the §6.2 "lost forever" gap closes too.

**6A.3 is a workaround for the dashboard being the one announcing writes it does not fully understand.**
§8 is the fix.

### 6A.7 Summary

| # | Fix | Effect | When |
|---|---|---|---|
| 1 | **Save-model redesign** (`04`) + bulk endpoints (A5, A6) | **~95% of the volume disappears at source** | Stage D / when A5-A6 land |
| 2 | **Leading+trailing throttle, ~1s, per tag set** | 21 -> 2; bursts collapse | **Phase 7, with the transport** |
| 3 | `'max'` profile | Removes blocking regeneration | Deferred - only if measured |
| 4 | Narrower tags | Fewer regenerations | **Do not** - asymmetric risk; needs §8 first |
| 5 | Backend-emitted (§8) | Natural coalescing + precise tags + durable retry | Target state |

**Order matters: 2 now, 1 as the redesign lands, then re-measure before touching 3.**

---

## 7. `cacheLife` as the safety net

With push revalidation as the primary mechanism and a known durability gap (§6.2), TTL stops being the invalidation strategy and becomes the **backstop**: the maximum time a lost revalidation can hurt.

This is a **public-repo tuning exercise** and is listed here as a request, not a mandate. Current values need auditing per tag; only `site-info` is confirmed.

| Tag | Current | Proposed | Reasoning |
|---|---|---|---|
| `site-info` | `days` | **`hours`** | Confirmed too long. Even with B-1 fixed, a `days` backstop on branding is a bad worst case. Low write frequency, low read cost. |
| `tour:<id>`, `tours`, `search` | audit | `hours` | Price and availability. The highest-cost staleness in the product. |
| `destinations`, `categories`, `collections`, `hubs` | audit | `hours`-`days` | Editorial, changes rarely. |
| `slug-registry` | audit | `hours` | A stale slug registry serves 404s or wrong pages. |
| `reviews` | audit | `days` | Low stakes. |

Principle: **TTL is a bound on damage, not a cache strategy.** Every value should answer "how long can this be wrong before it is a customer-visible problem?"

---

## 8. Target state: backend-emitted revalidation

Recorded as the destination so v1 is understood as a stepping stone, not an endpoint. Requires backend work (Appendix A8 in `02-EXTRACTION-SPEC.md`).

```
api.tripwheel.io
  entity write (any source: dashboard, BullMQ job, Stripe webhook, script)
    └─ outbox row                       [exists: EVENT-DRIVEN-AND-QUEUES.md]
         └─ BullMQ worker               [exists]
              └─ POST island.tours/api/revalidate    { tags }
```

### 8.1 What it fixes

| Problem | v1 | Target |
|---|---|---|
| Dashboard knows `island.tours` exists and knows its cache vocabulary | yes (coupling) | **no** |
| Backend-originated writes bust the cache (§1.3) | **no** | **yes** |
| Lost revalidations are retried durably | no | **yes** (BullMQ retries) |
| Tag taxonomy lives in the write's owner | no (a frontend maps paths back to tags) | **yes** |
| Adding a consumer (mobile app, second storefront) | each re-implements mapping | backend fans out |

That fourth row is the deepest one. Today a **frontend** reverse-engineers "what changed" by pattern-matching the URL it just called (`cache-revalidation.ts` is 160 lines of `switch (seg0)`). The service that actually performed the write - and knows precisely what changed - says nothing. v1 keeps that inversion. The target state removes it.

### 8.2 Migration path

The public `/api/revalidate` endpoint is **identical** in both designs. Only the caller changes.

1. Backend adds outbox emission + the worker; POSTs the same contract.
2. Both callers run in parallel briefly. `revalidateTag` is idempotent, so double-revalidation is harmless.
3. Dashboard's `revalidatePublicForPath` becomes a no-op behind a flag; verify coverage.
4. Delete `cache-revalidation.ts` and `revalidate.ts` from the dashboard. The dashboard no longer knows `island.tours` exists.

Step 2's overlap is why this is safe: there is no flag-day.

---

## 9. Environment variables

| Var | Repo | Public? | Value |
|---|---|---|---|
| `REVALIDATE_TARGET_URL` | dashboard | **no** | `https://island.tours/api/revalidate` |
| `REVALIDATE_SECRET` | dashboard | **no** | 32+ chars; **must match the public site** |
| `REVALIDATE_SECRET` | island.tours | **no** | same value |

Per the project's env rule, each lands in `.env.example` **and** `.env.production.example` in the same change.

**Rotation:** the endpoint should accept a comma-separated list of valid secrets so rotation is a two-deploy operation rather than a synchronized flag-day. Cheap now, painful to retrofit.

**Behavior when unset:** `REVALIDATE_TARGET_URL` absent -> skip revalidation and **log once at startup**, so local dev does not spam and a misconfigured production deploy is loud. It must not throw.

---

## 10. Verification

### 10.1 Unit (dashboard)

| # | Check |
|---|---|
| 1 | `POST /tours` -> `["tour:<id>", "tours", "search"]` |
| 2 | `PATCH /tours/:id` -> same + `slug-registry` |
| 3 | `POST /availability/check` -> `[]` (short-circuit, §5.3) |
| 4 | `/tours/slug/:slug` -> no granular `tour:` tag (§5.3) |
| 5 | **`PATCH /settings/site` -> includes `site-info`** (regression test for B-1) |
| 6 | `PATCH /settings/seo` -> `["user-profile"]`, no `site-info` |
| 7 | `GET` of any path -> `[]` (no revalidation on reads) |
| 8 | Unmapped segment (`media-gallery`) -> `[]` |
| 9 | Tags de-duplicated |

### 10.2 Unit (public endpoint)

| # | Check |
|---|---|
| 10 | Valid secret + valid tags -> 200, `revalidateTag` called once per tag |
| 11 | Wrong secret -> 401, **no revalidation**, no detail leaked |
| 12 | Missing secret header -> 401 |
| 13 | **Unknown tag -> 400, nothing revalidated** (drift guard, §5.1) |
| 14 | Mixed known + unknown -> **400, nothing revalidated** (no partial success) |
| 15 | `tour:` with empty suffix -> 400 |
| 16 | `tags.length > 32` -> 400 |
| 17 | GET -> 405 |
| 18 | **The handler uses `revalidateTag`, never `updateTag`** (which would throw - §4.1) |

### 10.3 Integration (both apps deployed)

| # | Check |
|---|---|
| 19 | Publish a tour -> it appears on island.tours |
| 20 | Change a price -> island.tours reflects it |
| 21 | Rename a slug -> 301 works and `slug-registry` is busted |
| 22 | Deactivate a destination -> its public page 404s |
| 23 | **Settings -> General logo change -> the public footer updates** (B-1 end-to-end) |
| 24 | Tier change -> ranking reflects it |
| 25 | Wrong `REVALIDATE_SECRET` -> the write **still succeeds**, and the failure is **logged** (R1 + R2) |
| 26 | Public site down -> the write **still succeeds**, failure logged, no user-visible error (R1) |
| 27 | Unknown tag -> 400 is logged and **not retried** (R4) |
| 28 | Network blip -> retried per R3 |
| 29 | `REVALIDATE_TARGET_URL` unset -> no throw, logged once (§9) |
| 30 | **A single isolated save revalidates immediately** - the leading edge fires with no delay (§6A.3). This is the no-regression check. |
| 31 | **A 7x3 schedule save (21 POSTs) produces 2 revalidation calls, not 21** (§6A.3) |
| 32 | Tags are de-duplicated within the throttle window |
| 33 | Closing the tab mid-window flushes on `pagehide` (best-effort) |

### 10.4 The check that actually matters

> **26 and 25 are the acceptance criteria for this whole document.** If a revalidation failure ever
> fails an operator's save, R1 is violated and the design is wrong. If a revalidation failure is ever
> silent, R2 is violated and we have rebuilt the exact bug we set out to prevent - only now it is
> distributed across two repositories and harder to find.

---

## 11. Summary of decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Server-to-server POST from the dashboard's existing Server Action | Zero backend change; keeps the secret off the browser; smallest diff |
| 2 | Tag-mapping logic (`cache-revalidation.ts`) carried **verbatim** | It is well-reasoned and correct except for one bug |
| 3 | **`revalidateTag`, never `updateTag`**, in the Route Handler | `updateTag` is Server-Action-only and **throws** in a Route Handler |
| 4 | **No profile argument** (legacy semantics) | Byte-for-byte parity with today's `updateTag`. `'max'` is a separate, later, reviewed decision. |
| 5 | Public endpoint **validates tags and 400s on unknown** | Converts silent permanent staleness into a loud first-write error |
| 6 | Reject partial batches wholly | Partial success is a lie to the caller |
| 7 | **Log failures; never swallow** | Fire-and-forget across a network is a silent correctness bug |
| 8 | Retry transient only; never 400/401 | Both are permanent config/code bugs |
| 9 | Non-blocking: never fail the operator's write | Preserves today's guarantee |
| 10 | **Coalesce with a leading+trailing throttle (~1s, per tag set)** | 21 POSTs -> 2. Leading edge keeps the single-save case instant, so no regression. §6A.3 |
| 11 | **Do NOT narrow the tag mapping** | Over-invalidation costs a regeneration; under-invalidation serves wrong prices. Not symmetric. §6A.5 |
| 12 | `cacheLife` is a **damage bound**, not a strategy | Push is primary; TTL is the backstop for lost pushes |
| 13 | Fix **B-1 in the current repo first** | A live production bug must not wait on an architecture project |
| 14 | Backend-emitted revalidation is the **target**, v1 is a stepping stone | The write's owner should announce the write - and coalesces for free (§6A.6) |

## 11A. What this design does and does not promise

> The short version, for anyone who wants the answer without reading 500 lines. Each row links to the
> section that backs it.

### Performance: no cost. This is a firm commitment.

| Claim | Why | Where |
|---|---|---|
| **Operator writes take zero extra time** | Revalidation is fire-and-forget and never blocks a save. If the public site is down, the save still succeeds at full speed. | §6 R1 |
| **The public site gets faster, not slower** | Coalescing means **fewer** regenerations than today: a schedule save currently triggers 21 rounds of cache-busting, after this it triggers 2. | §6A.3 |
| **Backend load drops** | Same reason - fewer regenerations to serve. | §6A.1 |

### Reliability: as good as today, and it fails loudly instead of silently.

| Claim | |
|---|---|
| **Coverage is identical to today** | Only dashboard-originated writes revalidate. Unchanged. §1.3 |
| **Failures are logged, not swallowed** | The real upgrade. Today's code does `.catch(() => {})`. §6 R2 |
| **Tag drift becomes a loud 400** on the first write, instead of silent permanent staleness | §5.1 |

### The two gaps. Neither is a regression; neither is solved by v1.

| # | Gap | Mitigated by | Fixed by |
|---|---|---|---|
| 1 | **A revalidation lost to a hard failure is lost forever.** No queue, no replay. The public site stays stale until `cacheLife` expires. Logging is not recovery. | TTL backstop (§7) + alerting (§6 R6) | **§8** |
| 2 | **Backend-originated writes never bust the cache** - BullMQ nightly jobs, materialization, Stripe webhooks flipping `isBookable`. | nothing | **§8** |

### The honest summary

> **This design will work as reliably as the current code does, cost nothing in performance, and fail
> loudly instead of silently. It is not "perfect".**
>
> "Perfect" is §8 - backend-emitted revalidation through the outbox that already exists. That closes
> both gaps, because the service that performs a write is the only one that reliably knows it happened.
> v1 is a stepping stone that matches today's coverage exactly and needs zero backend work. **Do not
> present it as more than that.**

---

## 12. Known debt accepted in v1

Stated plainly so nobody mistakes this for the finished design:

1. **The dashboard knows `island.tours` exists** and knows its cache-tag vocabulary. A frontend-to-frontend coupling between two nominally independent services.
2. **Backend-originated writes never bust the cache** (BullMQ jobs, Stripe webhooks, materialization). Pre-existing, unchanged, invisible until §8.
3. **Lost revalidations are not replayed.** No queue. Mitigated by TTL + alerting, not solved.
4. **The tag contract is duplicated** across two repos and enforced only by the 400 guard at runtime - a fast feedback loop, but not a compile-time one. It lives in **`lib/cache-tags.ts`, byte-identical at the same path in both repos** (§5.4), so `diff` is a complete check - but **the diff is manual: there is no CI guard, and no cheap way to add one** (the dashboard repo has no CI at all, and a shared package would re-couple the two services). Detection is the 400; prevention is a human remembering to change both.

All four are resolved by §8. None of them blocks the split.
