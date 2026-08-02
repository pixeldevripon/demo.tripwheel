# iCal PRD — gap analysis against Island Tours

> **Reconciles** [`ICAL-CALENDAR-SYNC-PRD.md`](./ICAL-CALENDAR-SYNC-PRD.md) (01 Aug 2026) with
> the master doc, `APPLICATION-FEATURES-AND-TASKS.md`, and the shipped code.
>
> **This file wins where it disagrees with the PRD.** The PRD is written for a generic
> lodging platform; this is the Island Tours reading of it.
>
> **Status 2026-08-02: the import half is BUILT** along the lines below — see
> [`AVAILABILITY-AND-DEPARTURES.md`](./AVAILABILITY-AND-DEPARTURES.md) §9b for what
> shipped. Export shipped 2026-07-29 (§9a). The one adopted item still outstanding is
> the `CHANNEL` export feed (§2), which is why no OTA should be given an export URL yet.

---

## 0. The headline

**The PRD is high quality and mostly adoptable — but it is written for day-granular lodging
inventory, and Island Tours is neither.** Every tour here is time-slotted (`Tour.startTimes[]`)
and multi-capacity (`maxPartySize`, commonly 60). The PRD says so itself, three times:

- **§1.7** — *"Time-slotted tours with multiple daily departures → Direct API or channel
  manager. iCal cannot represent a 09:00 departure being full while 14:00 is open."*
- **§1.6** — *"A tour with 12 seats is either fully open or fully blocked."*
- **§16 E28** — *"iCal blocks the whole day, since the format cannot express slot-level
  availability. This must be stated in the UI when a listing has slots configured."*
- **§20.4 open question 2** — asks the product owner to decide whether to ship iCal for
  slot-based listings at all.

**Our answer to that open question is already better than the PRD's.** The PRD recommends
"block the whole day and warn". The four import modes agreed on 2026-07-31 —
`CLOSE_DATES` / `CLOSE_SLOTS` / `WARN_ONLY` / `IGNORE` — let the operator pick per connection,
and `WARN_ONLY` is the correct default for a 60-seat catamaran where one external booking must
not close the day. **Keep our design. Adopt the PRD's honesty about the limitation in the UI.**

**The second headline:** the PRD's export and our shipped export are solving *two different
problems*, and conflating them is a privacy incident waiting to happen. See §2.

---

## 1. Do NOT adopt the PRD's availability model

| PRD | Island Tours | Verdict |
|---|---|---|
| `blocked_dates` — one row per listing per calendar day, *"the single availability layer read by search, the booking engine and the export builder"* | `departures` (tour × date × startTime, with `capacity`/`bookedCount`) is the source of truth; `availability_schedules` + `availability_exceptions` project into it | **REJECT the table outright** |

Adopting `blocked_dates` would create a **second availability layer** beside `departures`,
which directly violates spec non-negotiable **(1)**: *"the single source of truth is the
`departures` table — not iCal, not a cache, not the operator's external calendar."* It would
also duplicate what `availability_exceptions` already does, with worse semantics: the PRD's
`slot_id` column is an afterthought bolted onto a day-granular design, whereas our exceptions
are natively `(date, startTime?)`.

**What we take from §9.5 instead** is the *idea* behind `source_type`: an imported block must
be attributable and independently releasable. Our plan already does this with `source`
(`MANUAL` | `ICAL`) + `subscriptionId` + `externalUid` on `AvailabilityException`. The PRD's
architectural-decision-to-protect #1 ("adding a direct API is a new source type, not a
migration") is satisfied by that column just as well.

**Also reject:** the PRD's framing that "several sources block the same day independently and
releasing one never opens a day another still holds". Our materializer already produces the
correct result because CLOSE exceptions are additive projections, not stored booleans.

---

## 2. Two different export feeds — the sharpest finding

Our shipped export and the PRD's export are **not the same product**:

| | Shipped (`cbe399c`) | PRD |
|---|---|---|
| Audience | The **operator's own** phone/laptop calendar | **OTA channels** (Airbnb, Booking.com) |
| Scope | Per **operator**, all tours, 2 kinds | Per **listing** |
| Content | Traveller name, pax, ref | **"never guest names, emails, phone numbers, prices or booking references"** (§17.2) |
| Granularity | One VEVENT per booking / per departure | **One VEVENT per contiguous occupied range** |
| Cache | `private, max-age=300` | `public, max-age=300` |

Both are legitimate; they are just different feeds. The danger is an operator pasting the
**BOOKINGS** URL into Airbnb, which would publish their customers' names to a third party. Our
current UI actively invites this — the header says *"Add these links to Google Calendar, Apple
Calendar or Outlook"*, and nothing stops someone pasting it into an OTA.

### Required

1. **Add a third feed kind, `CHANNEL`** — per **tour**, no PII whatsoever, contiguous ranges,
   a generic `SUMMARY` ("Unavailable"), deterministic UIDs. This is the only URL that may be
   given to an OTA.
2. **Warn on the BOOKINGS feed** that it is for personal calendar apps only and must never be
   given to a sales channel.
3. Keep BOOKINGS and DEPARTURES exactly as they are — the operator-ops use case is real and
   the token+minimal-PII design was a deliberate, documented trade.

**Per-tour scope is not optional for the channel feed.** Airbnb blocks dates on *one listing*.
Handing it an operator-wide feed covering 12 tours would block every date any tour is busy,
across the whole account.

---

## 3. Already shipped, no work needed

| PRD requirement | Status |
|---|---|
| Token-protected public feed, 404 on unknown/revoked | ✅ Flat 404 for unknown, malformed and revoked alike |
| ETag / `If-None-Match` → 304 | ✅ Plus `DTSTAMP` pinned to data mtime, which is what makes it work |
| `Last-Modified`, `Content-Type`, `Content-Disposition` | ✅ |
| One-click copy with checkmark + toast | ✅ |
| Last-fetched display, "never fetched" state | ✅ `lastFetchedAt` + `fetchCount`, "Waiting for the first sync" |
| Regenerate with confirmation dialog | ✅ (no grace period — see §4) |
| Revoke | ✅ Soft, row retained so a token can never be re-minted |
| Per-channel setup help with steps | ✅ Google / Apple Mac / Apple iOS / Outlook, verified against vendor docs |
| "Be honest about latency" (§18.2) | ✅ Header promises no interval; the guide states Outlook can take >24 h |
| Token from a CSPRNG | ✅ **32 bytes / 256 bits — stronger than the PRD's 32 chars** |

---

## 4. ADOPT — the PRD is right and we had missed it

| # | Item | Why it matters here |
|---|---|---|
| A1 | **Encrypt the stored iCal URL at rest** (§17.3) | OTA iCal URLs *are bearer credentials for the operator's Airbnb account*. We were going to store them in plaintext. This is the single biggest thing we missed |
| A2 | **Mask the URL by permission** (§11.3) | Full URL only to whoever may manage connections; masked in list responses, logs, errors and analytics |
| A3 | **Feedback-loop detection** (E12) | Our export includes imported blocks (hub topology), so a channel echoing our feed back would ping-pong blocks forever. Detect our own deterministic UID prefix on inbound and skip. Plus a per-connection `excludeFromExport` |
| A4 | **Dry-run validate endpoint before save** (§11.4) | Already in our plan as "preview" — the PRD's shape (event count, first/last event, warnings) is better. `Test & Connect` converts silent failures into caught mistakes |
| A5 | **Disconnect = keep-or-release choice** (§5.3, B23/B24) | We had "delete removes its blocks". Defaulting to **keep** is right: releasing dates on disconnect is how you get a double booking |
| A6 | **`TRUNCATED_FEED` is transient, not permanent** (§12.2) | A body missing `END:VCALENDAR` is a partial download. Treating it as malformed would flip a healthy connection to ERROR on a flaky network |
| A7 | **Reject the whole payload on corruption** (E18) | *"A truncated feed looks identical to a feed where all the later bookings were cancelled."* This is the failure that silently reopens sold dates |
| A8 | **`DTSTART == DTEND` means one day, not zero** (E9) | Real feeds get the exclusive-end rule wrong. Without this, single-day blocks vanish |
| A9 | **Synthesize a UID when absent** (§12.3) | Deterministic hash of start+end+summary. Some feeds omit UID entirely and our unique key depends on it |
| A10 | **Skip `TRANSP:TRANSPARENT` and `STATUS:CANCELLED`** (§12.3) | Already planned — confirming it against the PRD |
| A11 | **Per-event failures skip and count, never fail the sync** (§12.3) | One malformed VEVENT must not block 200 good ones |
| A12 | **Conflict is a first-class record, not just a notification** (§9.7) | A `CalendarConflict` row with acknowledge. In `WARN_ONLY` mode this *is* the product |
| A13 | **Retention + partitioning on sync logs** (§9.6) | Already flagged: 15-min polling is ~96 rows/subscription/day |
| A14 | **Property tests + a real-feed fixture library** (§20.2) | *"Include the ugly ones."* Same-feed-twice = no-op; A→B→A returns to A |
| A15 | **Notification content rule** (§14.2) | What broke → what it means for the business → what to do. And **always state that existing blocks are retained** — it is the operator's first question |
| A16 | **Manual sync must work on paused and errored connections** (§18.2) | It is how an operator verifies a fix |
| A17 | **Never trust `DTSTAMP` for ordering** (E32) | Diff on content. Clock skew between us and the channel is real |

---

## 5. ADAPT — take the intent, change the mechanism

| # | PRD says | We should | Why |
|---|---|---|---|
| D1 | `blocked_dates` day rows | `AvailabilityException` + `syncTourAvailability` | §1. Non-negotiable (1) |
| D2 | Conflict policies `keep_local` / `block_anyway` / `manual_review`, account-level | Our four **per-connection** modes `CLOSE_DATES` / `CLOSE_SLOTS` / `WARN_ONLY` / `IGNORE` | Ours is per-connection (an operator may want strict Airbnb, lenient Google) and adds slot precision the PRD says is impossible. `WARN_ONLY` ≡ `keep_local`. `manual_review` is worth adding later as a fifth |
| D3 | 6 new permission keys (`calendar.view/sync/manage/settings/audit/admin`) | Reuse `MANAGE_AVAILABILITY` + `VIEW_BOOKINGS`; consider adding **one** key for "sync but not configure" | We have an existing `Permission` enum, a staff-seat ceiling engine and a `STOP_SELL`-style precedent. Six new keys is a large blast radius for one feature. But the PRD's *distinction* is sound — staff forcing a refresh without being able to detach a channel is a real workflow |
| D4 | Token stored as SHA-256, lookup by hash | Keep plaintext + unique index **for now**, revisit with A1 | Our token is 256-bit and revocable; the hash mainly protects against DB-dump replay. Do it in the same pass as URL encryption or not at all — half-measures here are theatre |
| D5 | Sync horizon: past 30 days + **24 months** | Keep **-30d/+90d** for departures, `-30d/+364d` for bookings | Our horizon is bounded by `DEFAULT_HORIZON_DAYS` in the materializer. Advertising 24 months of inventory that has not been projected would be a lie |
| D6 | Per-listing max 10 calendars, plan-gated | Per-tour cap, **not** plan-gated | We have commission tiers, not SaaS plans. Gating sync frequency behind a tier would be a new commercial concept — founder decision, not an engineering default |
| D7 | 60 s scheduler tick, `SELECT … FOR UPDATE SKIP LOCKED`, stuck-job reaper, jitter | **BullMQ repeatable, 15 min** | Already decided 2026-07-31. BullMQ gives claiming, retry and stall recovery natively. Keep the PRD's **jitter** and **per-host concurrency** ideas |
| D8 | Retry ladder 1m/5m/15m/1h/4h, then 6-hourly for 72 h, then auto-pause | Adopt the ladder and the 72 h auto-pause | Matches our `failureCount`/`nextPollAt` design. **Permanent errors skip the ladder** |
| D9 | `calendar_events` table as the diff baseline with `raw_event`, `recurrence_rule` | Adopt a **slimmer** version | We need a baseline for tombstoning anyway. Keep `externalUid`, dates, `lastSeenAt`, `removedAt`; skip `raw_event` unless debugging demands it (it is untrusted third-party text) |
| D10 | Account-level dashboard at Settings → Integrations | Per-tour first; account view **later** | Our operators do have many tours, so this earns its place — but after the pipeline works |

---

## 6. REJECT or not applicable

| Item | Why |
|---|---|
| **Plan gating / tiers** (§15, §11.5 `402 PLAN_LIMIT_REACHED`) | Island Tours has commission tiers for *ranking*, not feature entitlement. No SaaS plan concept exists |
| **SMS notifications** | No SMS channel exists on the platform |
| **`Cache-Control: public`** on our BOOKINGS feed | It carries traveller names. `private` is correct. The new `CHANNEL` feed may be `public` |
| **`calendar_export_fetches` per-IP + user-agent table at launch** | High write volume for a "last fetched by Airbnb" nicety. Our `fetchCount`/`lastFetchedAt` covers the operator's real question. Revisit with the `CHANNEL` feed, where "is Airbnb reading this?" genuinely matters |
| **Envelope encryption for the export token** | Ours is a capability URL that must be redisplayed; the row is already revocable. Encrypting the *inbound* URL (A1) is the one that matters |
| **Multi-year advance horizon** | See D5 |
| **Direct OTA APIs, pricing sync, channel managers, two-way write-back** (§19 phases 3–4) | Out of scope. Note the PRD is right that they are the structural fix for slot inventory |
| **`account_id` denormalization** | Our scoping is `operatorId` via `assertTourAccess`; there is no separate account entity |

---

## 7. DEFER — right idea, wrong time

| Item | Trigger to revisit |
|---|---|
| Circuit breaker per destination host (§10.6) | When more than a handful of operators share a channel. Meaningless at one tenant |
| Per-host token bucket across tenants | Same |
| Account-level sync-health dashboard | After the pipeline is live and an operator has >5 connections |
| Bulk connect / copy config between tours | Same trigger. Real pain at 40 listings, invisible at 4 |
| Weekly digest | After failure notifications prove noisy or missed |
| Full audit trail (§17.5) | We log mutating actions today. A dedicated immutable audit table is a platform-wide concern, not an iCal one |
| `manual_review` as a fifth import mode | If operators ask for staged review |
| Export "never fetched after 48 h" nudge | With the `CHANNEL` feed |

---

## 7a. What actually shipped, against §4's adopt list

| # | Item | Status |
|---|---|---|
| A1 | Encrypt the stored iCal URL at rest | ✅ AES-256-GCM via the existing `ENCRYPTION_KEY` |
| A2 | Mask the URL by permission | ✅ Masked in list responses, full only on the single read |
| A3 | Feedback-loop detection | ⚠️ `excludeFromExport` column + UI exists; **UID-prefix detection lands with the `CHANNEL` feed**, which is what would carry our own UIDs outbound |
| A4 | Dry-run validate before save | ✅ `POST /calendar-subscriptions/validate`, wired to the URL field |
| A5 | Disconnect = keep-or-release | ✅ Defaults to keep |
| A6 | `TRUNCATED_FEED` transient | ✅ |
| A7 | Reject whole payload on corruption | ✅ |
| A8 | `DTSTART == DTEND` is one day | ✅ |
| A9 | Synthesize a missing UID | ✅ Deterministic `sha256(start\|end\|summary)` |
| A10 | Skip `CANCELLED` / `TRANSPARENT` | ✅ |
| A11 | Per-event skip-and-count | ✅ |
| A12 | Conflict as a first-class record | ✅ `calendar_conflicts` + inbox event |
| A13 | Sync-log retention | ✅ Two windows — `UNCHANGED` 7 days, everything else 180 — pruned nightly. The PRD's flat 90 days would either bury the informative rows or throw them away |
| A14 | Property tests + fixture library | ✅ Parser spec is fixture-driven; the A→B→A property test is worth adding |
| A15 | Notification content rule | ✅ Copy asserts "existing blocks are retained" in tests |
| A16 | Manual sync on paused/errored | ✅ |
| A17 | Never trust `DTSTAMP` for ordering | ✅ Diff is on content |

Two departures from §5 worth recording, both decided while building:

- **D4 (token hashing)** — still plaintext-with-unique-index for the EXPORT token. The
  inbound URL got the encryption instead, which is where the real credential is.
- **BullMQ retry** — the queue gets **one attempt** per poll, not the platform default
  of five. The retry ladder lives in the database, and stacking both would hammer the
  channel and write five sync-log rows for one failure.

---

## 8. What this changes in the plan

The 11-step build order stands. Amendments:

- **New task — `CHANNEL` export feed** (per tour, zero PII, contiguous ranges). This is
  M1 work the PRD assumed and we do not have. It also unblocks the actual OTA use case, which
  is the whole point of the module.
- **Step 1 (schema)** gains: encrypted `url` + `urlHash` for duplicate detection, `platform`
  enum, `excludeFromExport`, a slim `CalendarEvent` baseline table, and `CalendarConflict`.
- **Step 2 (fetcher)** gains: **resolved-IP-pinned connections** to close the DNS-rebinding
  window (we had "resolve and check", which is checkable-then-swappable), explicit cloud
  metadata denial, and `TRUNCATED_FEED` as transient.
- **Step 3 (parser)** gains: UID synthesis, `DTSTART == DTEND` handling, per-event skip-and-count,
  reject-whole-payload-on-truncation, and the fixture library.
- **Step 6 (module)** gains: the validate/dry-run endpoint and the keep-or-release disconnect.
- **Step 9 (UI)** gains: the platform picker with per-OTA help, and the E28 slot-limitation
  notice shown **because every one of our tours has slots**.
- **Step 11 (history)** is confirmed by §9.6 — including the changed-vs-no-op delta column,
  which the PRD calls the most useful column in the table.

---

## 9. Open questions for the founder

The PRD leaves six; three of them land differently here.

1. **Do we ship the `CHANNEL` export feed?** Without it there is no safe way to connect an OTA,
   and the BOOKINGS feed carries traveller names. My recommendation: yes, and gate the BOOKINGS
   feed with an explicit "personal calendar apps only" warning.
2. **Slot limitation — how loud?** Every Island Tours tour is slotted and multi-capacity, so the
   PRD's E28 notice is not an edge case here, it is the default state. Recommendation: state it
   at connection time, and default new connections to `WARN_ONLY` rather than `CLOSE_DATES`
   whenever `maxPartySize > 1` — which is every tour we have.
3. **Permissions** — reuse `MANAGE_AVAILABILITY`, or introduce the PRD's finer keys? (D3)
4. **Sync-log retention** — PRD says 90 days. Double-booking disputes surface months later.
5. **Max connections per tour** — PRD's default is 10. Ours?
6. **Conflict default** — confirmed as `WARN_ONLY` per your 2026-07-31 call, which supersedes
   the PRD's `keep_local` framing but agrees with it in substance.
