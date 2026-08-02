# iCal Calendar Synchronization — PRD (markdown capture)

> **Source:** `technical-doc/ical-calendar-sync-prd.pdf`, 40 pages, dated **01 August 2026**,
> status "Ready for design and implementation".
>
> **This file is a faithful capture of the PRD's normative content** — every rule, table,
> schema, endpoint, edge case and threshold — so it is greppable and diffable alongside the
> rest of `technical-doc/`. The PDF remains the source for the ASCII screen mockups and the
> visual layout detail; those are summarised here rather than reproduced.
>
> **It is NOT yet an Island Tours decision record.** The PRD is written for a generic
> lodging/rental platform ("listings", day-level availability, overnight stays). What we
> adopt, adapt, reject and defer is worked out in
> [`ICAL-PRD-GAP-ANALYSIS.md`](./ICAL-PRD-GAP-ANALYSIS.md). **Read that before building
> anything from this file.** Where the two disagree, the gap analysis wins, because it is the
> one reconciled against our master doc and our shipped code.

---

## 1. Feature overview

**iCal (RFC 5545, `.ics`)** is a plain-text calendar format. A feed is a URL returning
`VEVENT` blocks, each describing an occupied range with start, end, UID and optional summary.

```
BEGIN:VEVENT
UID:booking-48219@ourplatform.com
DTSTART;VALUE=DATE:20260814
DTEND;VALUE=DATE:20260818
SUMMARY:Reserved
END:VEVENT
```

- **Export** = we publish a read-only, token-protected URL per listing. The operator pastes it
  into Airbnb, Booking.com etc. Direction: **platform → OTA**.
- **Import** = the operator pastes each OTA's iCal URL into us; our scheduler downloads,
  parses and writes occupied dates into our availability layer. Direction: **OTA → platform**.

Together they form a **hub-and-spoke topology** with our platform as the hub. Channels never
talk to each other; a date booked on Airbnb becomes unavailable on Booking.com *by passing
through us*.

### 1.5 Benefits

| Benefit | Detail |
|---|---|
| Universal support | Every major OTA supports iCal. No partnership, contract or API key |
| Zero integration cost | Operator connects a channel in under a minute by pasting a URL |
| No approval process | Direct OTA APIs need onboarding, certification, sometimes revenue minimums |
| Works with long-tail channels | Small regional OTAs and personal Google Calendars, same mechanism |
| Low maintenance | The format is frozen; feeds rarely break once working |

### 1.6 Limitations — "must be communicated inside the UI, not buried in documentation"

| Limitation | Impact |
|---|---|
| Polling, not push | Real-world latency **15 minutes to 3 hours in each direction** |
| No guaranteed inbound frequency | We don't control how often Airbnb pulls our export. Most refresh every 1–24h and **ignore cache headers** |
| Dates only, no times | Most OTA feeds publish all-day `VALUE=DATE` events. Fine for overnight stays, **unreliable for time-slotted tours where two departures share a date** |
| No pricing or inventory count | Cannot express rates, min stay, seat count or per-slot capacity. **A tour with 12 seats is either fully open or fully blocked** |
| No guest data | Feeds are anonymised by most OTAs |
| No acknowledgement | No confirmation a channel read our feed. **Failure is silent on the outbound side** |
| One-way per feed | Two-way sync requires two configured links per channel |

### 1.7 When APIs are better than iCal

| Situation | Recommended |
|---|---|
| **Time-slotted tours with multiple daily departures** | **Direct API or channel manager.** iCal cannot represent 09:00 being full while 14:00 is open |
| **Seat-level or capacity-based inventory** | **Direct API.** iCal is binary per date |
| Rate/pricing parity | Direct API or channel manager. Out of scope for iCal entirely |
| High-volume, low-margin where a double booking is costly | Direct API for the top two channels, iCal for the tail |
| Guest details needed for fulfilment (pickup, dietary, manifest) | Direct API. iCal never carries this |
| Channel already offers a certified partner API and we have volume | Direct API |

> **PRD's own positioning:** iCal is the default for every channel and the permanent solution
> for the long tail. Direct APIs come later for the two or three highest-volume channels. The
> two must coexist on the same listing — **which is why the data model records a `source_type`
> on every blocked date.**

---

## 2. User stories

### Export

| ID | Story | Acceptance |
|---|---|---|
| US-01 | Copy my listing's iCal URL to paste into an OTA | One-click copy, toast, URL visible in full and selectable |
| US-02 | Know when my feed was last fetched | "Last fetched" per requesting user agent, or generic if unknown |
| US-03 | Regenerate my export URL if it leaked | Confirmation dialog explaining every channel must be updated |
| US-04 | Export includes manual blocks, not just bookings | Manual blocks appear as `VEVENT` with a distinct summary |

### Import

| ID | Story | Acceptance |
|---|---|---|
| US-05 | Connect Airbnb by pasting a URL | Platform dropdown, URL field, live validation, save |
| US-06 | Connect multiple platforms to one listing | Up to the configured max (default 10). Duplicate URLs rejected |
| US-07 | Automatic sync without opening the page | Scheduler at the per-connection interval. Default 1 hour |
| US-08 | Know immediately if syncing failed | Error badge, page banner, email/in-app after the retry budget |
| US-09 | Sync right now | "Sync Now", rate limited, inline progress |
| US-10 | Disconnect a calendar | Confirmation offering **keep or release** the dates it blocked |
| US-11 | See what each sync actually did | History with imported count, blocked count, errors, duration |
| US-12 | Be warned when an imported event conflicts with an existing booking | Conflict notification listing affected dates and both sources |

### Team and administration

| ID | Story |
|---|---|
| US-13 | Property manager configures sync only for listings they manage |
| US-14 | Staff see sync status without changing it — **action buttons hidden, not just disabled** |
| US-15 | Platform admin sees failing connections across all accounts (channel-wide outage detection) |
| US-16 | Account owner gets an audit trail of who changed calendar configuration |

---

## 3. Information architecture

Calendar Sync appears in **two places**, one data model, two scopes.

```
Primary (per listing):          Secondary (account-wide):
Listings                        Settings
  └── [Trip name]                 └── Integrations
        ├── Overview                    └── Calendar Sync
        ├── Availability & Pricing            ├── All connections (grouped by listing)
        ├── Calendar Sync  ← primary          ├── Global defaults
        ├── Photos                            └── Sync health
        └── Settings
```

**Rationale:** an iCal connection binds *one listing to one external calendar*; it is not an
account-level object. With 40 listings, an account-only design forces filtering a 200-row
table to touch one trip. The account view exists only for (1) a health overview and (2) global
defaults. **The account page is read-and-triage; every row links back to the per-listing page
for editing. Only global defaults are edited at account level.**

### Entry points

| From | To |
|---|---|
| Listing sidebar tab | Per-listing Calendar Sync |
| Availability calendar, "Blocked by Airbnb" chip | Per-listing page, scrolled to that connection |
| Settings → Integrations | Account-level dashboard |
| Sync failure notification | Per-listing page, error banner expanded |
| Onboarding checklist "Prevent double bookings" | Per-listing page, Add Calendar modal open |

---

## 4. Screen layout

Per-listing page = error banner (conditional) + four sections:
**A Export Calendar · B Imported Calendars · C Sync History · D Troubleshooting.**
Page header carries **Sync All**. The banner renders only when a connection is in `error` or
`invalid_url`; dismissible per session, returns on reload while the condition persists.

### Section A — Export

| Element | Behaviour |
|---|---|
| Export URL field | Read-only, monospace, full width, selectable, **middle-truncated** on narrow viewports, never wraps |
| Copy button | Clipboard, icon swaps to checkmark 2s, success toast, `document.execCommand` fallback |
| Privacy note | Static, always visible. States the link is unguessable but public if leaked, and that no PII is included |
| Last fetched | Relative + absolute on hover, from export access logs. "Never fetched" with help text that channels can take 24h for the first pull |
| Contains | Live counts of bookings and manual blocks in the feed — reassures the operator it is not empty |
| Fetch log disclosure | Collapsed accordion → last 20 fetches with timestamp, detected channel (from user agent), status |
| Regenerate URL | Destructive-secondary, confirmation dialog |

**Regenerate dialog** lists the channels currently using the link with their last fetch times.

> **Grace period (implementation note).** On regeneration keep the old token valid for a
> configurable **24 hours** in `revoked_pending`. Requests on the old token still serve the
> feed but are logged with a deprecation flag, so the UI can show "Airbnb is still using your
> old link". **This prevents an operator silently breaking every channel with one click.**
> After the window the old token returns **410 Gone**.

### Section B — Imported calendars

Table columns: **Platform · iCal URL · Last Sync · Status · Auto Sync Frequency · Actions**.
Platform shows a 16px channel logo. URL is middle-truncated monospace with copy-on-hover and
full URL in a tooltip. Last Sync shows relative time plus the result on a second line (event
count on success, error summary on failure). Frequency is an inline dropdown saving on change
with optimistic update. Actions is an overflow menu — Sync Now, Edit, View Logs, Pause, Delete
— with Sync Now promoted as an icon button on hover, and Delete destructive behind a divider.
Footer shows "4 of 10 calendars connected".

#### Status badges

| Badge | Token | Meaning | Trigger |
|---|---|---|---|
| ● Active | success | Last sync succeeded within the expected window | `last_success_at` within 2× the interval |
| ◐ Syncing | info, animated | A job is running now | Job claimed, not finished |
| ● Error | danger | Last sync failed, retries exhausted | `consecutive_failures >= retry_limit` |
| ● Invalid URL | danger | Failed validation or returns non-calendar content | Validation failure at save or on fetch |
| ○ Paused | neutral | Auto sync disabled by the user | `auto_sync_enabled = false` |
| ○ Disconnected | neutral | Soft-deleted, retained for history | `status = disconnected` |
| ◍ Stale | warning | Last success older than 2× interval, not yet hard-failing | Computed at read time |

**Row states:** loading = 4 skeleton rows matching final column widths; error row = danger left
border, inline error summary, **"Fix" replaces "Sync Now"**.

**Empty state** ends with links to per-channel help drawers (Airbnb · Booking.com · Expedia ·
Viator · GetYourGuide). The PRD calls this *"the single highest-leverage piece of UX in the
whole feature. Most support tickets on iCal sync are 'where do I get the link'."*

### Add / Edit Calendar modal

Fields: Platform (searchable select, six known channels pinned, then alphabetical, then
"Other") → conditional Platform name (required when Other) → Calendar URL → inline validation
line → contextual "Where do I find this on Airbnb?" → Sync frequency → Notes (0/500).

1. Selecting a known platform updates the URL placeholder and the help link.
2. Client validation on blur (format, HTTPS, length); **server validation on an 800 ms
   debounce (reachability, content type, parse) as a dry run that writes nothing.**
3. Validation line has four states: neutral, pending ("Checking feed…"), success (event
   count), failure (specific reason + fix hint).
4. Primary button **"Test & Connect"**, disabled until validation passes; **performs the first
   real sync immediately**, closes the modal with the row already `syncing`.
5. Zero events → button enabled with a warning, not an error.

**Edit mode** reuses the modal with **platform locked** (changing it means delete and re-add,
because attribution of existing blocked dates depends on it). URL change forces revalidation.

### Section C — Sync history

Columns: Date · Platform · Imported · Blocked (`+2 / -1`) · Errors · Duration. Filters:
platform, date range, outcome (all / success / failure / changed only). Row click opens a
detail drawer with the full error, HTTP status, response headers, **first 500 sanitized
characters of the body**, and the retry timeline. Rows with a conflict carry a warning icon
linking to the conflict detail. Retained 90 days. The account-level version adds a Listing
column.

> **Blocked** shows the net add/remove delta. A sync that changes nothing shows a greyed `0`.
> *"This is the column that tells the operator whether anything actually happened."*

### Section D — Troubleshooting

An accordion, always present, never a separate page — *"because the operator who needs it is
already looking at the error."* Contains per-channel "where to find your iCal link" with
screenshots (Airbnb, Booking.com, Expedia, Vrbo, Viator, GetYourGuide, MakeMyTrip, Google
Calendar), a supported-formats table, a common-errors-and-fixes table, and an FAQ.

**Supported / not supported**

| Accepted | Not accepted |
|---|---|
| `https://` returning `text/calendar` | `http://` URLs |
| `.ics` served with any content type **if the body parses** | Google Calendar "secret address" in XML or HTML |
| `webcal://` (auto-rewritten to `https://` with a notice) | Feeds behind a login wall |
| `VEVENT` using `DATE` or `DATE-TIME` values | ZIP or compressed archives |
| Feeds up to 5 MB | |
| UTF-8 and Latin-1 | |

---

## 5. User flow and branch conditions

Happy path: open page → Add Calendar → select platform → paste URL → client validation →
800 ms debounce → server dry-run fetch/parse → "Valid calendar feed. Found 6 events." →
Test & Connect → persisted `syncing`, modal closes → **first sync runs immediately, not on the
next tick** → events parsed, deduped, written → availability updated, log written → row flips
Active, toast "Airbnb connected. 6 dates blocked." → enters the scheduler.

### Branch conditions

| # | Trigger | Behaviour |
|---|---|---|
| B1 | Invalid URL format | Reject **before any network call** |
| B2 | `webcal://` | Auto-rewrite to `https://`, continue, info note |
| B3 | Unreachable host | No connection created |
| B4 | Timeout (30 s) | On add, no connection. On scheduled sync, retry with backoff |
| B5 | 401 / 403 | No connection. "iCal links must be public" |
| B6 | 404 / 410 | On add reject; on existing, error after retries |
| B7 | 5xx | Retry per backoff. Not a user fault |
| B8 | Body is HTML/JSON/XML | Reject — "you may have copied the page address" |
| B9 | Malformed ICS | Reject on add; on existing, error state, **previous blocks retained** |
| B10 | Empty feed | **Allow.** Status active, 0 events. Warning, not an error |
| B11 | Duplicate URL on this listing | Block save, link to the existing row |
| B12 | Same URL on a different listing | **Allow, but warn** |
| B13 | Max calendars reached | Disable Add Calendar |
| B14 | Feed > 5 MB | Abort download |
| B15 | > 5,000 events | Import first 5,000 by start date ascending, flag partial |
| B16 | 404 for over 72 h | **Auto-pause, retain blocked dates, notify** |
| B17 | Manual sync | High-priority enqueue, bypass interval, 1 per connection per 60 s |
| B18 | Manual sync while running | Reject — "A sync is already in progress" |
| B19 | Scheduler tick | Claim, run, reschedule |
| B20 | Listing deleted | Cancel jobs, disconnect connections, revoke token after grace |
| B21 | Conflict with an existing booking | Apply conflict policy. **Default: keep our booking, record, do not block, notify** |
| B22 | Event removed upstream | Release its dates **unless a local booking now covers them** |
| B23 | Disconnect, keep dates | Blocked dates reassigned to `source_type = manual` |
| B24 | Disconnect, release dates | Blocked dates deleted, availability recalculated |

### Disconnect flow

Confirmation offers a radio choice — **"Keep these dates blocked" (default)** or "Make these
dates available again" — and states plainly *"This does not cancel any bookings."* Then: soft
delete, cancel scheduled jobs, retain history 90 days, write an audit entry.

---

## 6. Flowcharts (mermaid sources are in the PDF)

**Export:** booking change → `availability.changed` → invalidate cached feed → external GET →
token check (`404` unknown / serve-with-deprecation-flag if `revoked_pending` / valid) → cache
hit or build → one `VEVENT` per contiguous occupied range → cache 5 min → log the fetch.

> **What the export contains.** Bookings, manual blocks, **and by default the blocks imported
> from other channels** — that is what makes the hub topology work. Provide a per-connection
> setting to exclude one source so a loop can be broken if a channel echoes our own feed back.

**Import:** tick every 60 s → select due connections → claim with row lock → GET (30 s, 5 MB,
max 3 redirects) → parse → normalize (expand RRULE, convert tz, dedupe by UID) → **checksum
short-circuit** → diff against stored events → add / update / tombstone → conflict detector →
upsert blocked dates → release tombstoned → recalc availability → write log → active, reset
failures → reschedule with jitter.

**Error:** classify transient (timeout, 5xx, DNS, reset) vs permanent (401, 403, 404, 410,
malformed, wrong type). Transient → increment, retry ladder. Permanent → straight to
`error`/`invalid_url`. Notification deduped per 24 h. Over 72 h → auto-pause and escalate.

> **Availability is retained on failure, deliberately.** *"If a feed breaks, dates it
> previously blocked are not released. Releasing them would expose the operator to double
> bookings at exactly the moment they have least visibility."*

**Lifecycle:** Draft → Validating → Validated → Syncing → Active ⇄ {Syncing, Paused, Stale,
Error} → Disconnected → purged after 90 days.

---

## 7. UI components

A full inventory is in the PDF (layout, data, input, action, feedback, overlay, nav). Notable
requirements:

**Accessibility.** Status badges carry text, never colour alone, and screen-reader text
includes the reason ("Error, feed returned 404"). The import list is a **real table with
header scopes**, not a div grid. Copy announces through `aria-live="polite"`; failures
announce assertively. Modal focus trapped and returned. Every icon-only button has an
`aria-label`. WCAG 2.2 AA — 4.5:1 text, 3:1 boundaries. Keyboard reach including the row
overflow menu and inline frequency select.

**Responsive.** ≥1280 full table · 1024–1279 harder URL truncation, short frequency labels
("1h") · 768–1023 stacked cards · <768 single column, export URL wraps to two lines with the
copy button beneath, modal becomes a full-screen sheet.

---

## 8. Field specifications

### Export

| Field | Type | Validation | Limits |
|---|---|---|---|
| Export URL | Read-only text | System generated | 512 chars |
| Export token | System, hidden | **32-char URL-safe random from a cryptographic source** | exactly 32 |
| Last fetched | Read-only display | — | — |
| Include imported blocks | Toggle | Boolean, default **On** | — |

### Add / Edit modal

| Field | Validation | Limits |
|---|---|---|
| Platform | Must be in enum | `airbnb, booking_com, expedia, vrbo, viator, getyourguide, makemytrip, google_calendar, other` |
| Other platform name | Required when `other`. Letters, digits, spaces and `. - & '`. **No URLs.** Trimmed | 2–60 |
| Calendar URL | Absolute URL, scheme `https` after `webcal` rewrite, **no embedded credentials**, host public (no localhost, private ranges, `.local`), must pass a live fetch and parse, unique per listing after normalization | 12–2048 |
| Sync frequency | In enum; **sub-hourly gated by plan** | 15m, 30m, 1h, 3h, 6h, 12h, 24h |
| Notes | Plain text, HTML stripped | 0–500 |
| Auto sync enabled | Boolean, default On | — |

### URL normalization (before duplicate check and storage; store raw for display/fetch, normalized for comparison)

1. Trim whitespace, strip zero-width and control characters
2. Rewrite `webcal://` → `https://`
3. Lowercase scheme and host — **preserve path and query case, OTA tokens are case sensitive**
4. Remove default port `:443`
5. Remove a trailing slash **only when the path is empty**
6. **Preserve every query parameter and its order — never strip anything that could be a token**
7. Remove the fragment
8. Percent-encode consistently with uppercase hex

---

## 9. Database design (PRD's proposal — see the gap analysis before adopting)

Entities: `LISTINGS` → `CALENDAR_CONNECTIONS`, `CALENDAR_EXPORT_TOKENS`, `BLOCKED_DATES`,
`BOOKINGS`; `CALENDAR_CONNECTIONS` → `CALENDAR_EVENTS`, `CALENDAR_SYNC_LOGS`;
`CALENDAR_EVENTS` + `BOOKINGS` → `BLOCKED_DATES` and `CALENDAR_CONFLICTS`;
`CALENDAR_EXPORT_TOKENS` → `CALENDAR_EXPORT_FETCHES`.

### `calendar_connections`

`id · account_id · listing_id · platform · platform_label · ical_url (encrypted at rest) ·
ical_url_normalized · url_hash (SHA-256, indexed) · status · auto_sync_enabled ·
sync_interval_minutes (default 60) · next_sync_at · last_synced_at · last_success_at ·
last_error_code · last_error_message · consecutive_failures · last_checksum ·
last_event_count · exclude_from_export · notes · created_by · created_at · updated_at ·
deleted_at`

Indexes: `UNIQUE (listing_id, url_hash) WHERE deleted_at IS NULL` ·
`(next_sync_at) WHERE auto_sync_enabled AND deleted_at IS NULL` · `(account_id, status)` ·
`(listing_id) WHERE deleted_at IS NULL`

### `calendar_export_tokens`

Separated from `listings` **so rotation keeps history and the grace period is representable**.
`token CHAR(32) UNIQUE · token_hash CHAR(64) UNIQUE indexed (lookup is on the hash) · status
(active | revoked_pending | revoked) · include_imported_blocks · revoked_at · expires_at`.
Constraint: at most one `active` row per listing.

### `calendar_events` — the parsed state of the last successful sync; the diff baseline

`connection_id · listing_id · external_uid · summary · description_hash · start_date ·
end_date (exclusive) · start_time · end_time · is_all_day · source_timezone ·
recurrence_rule · is_recurrence_instance · parent_event_id · raw_event (truncated 4 KB) ·
first_seen_at · last_seen_at · removed_at`

`UNIQUE (connection_id, external_uid, start_date) WHERE removed_at IS NULL` — **start_date is
in the key because some channels reuse a UID across recurring or amended reservations.**

### `blocked_dates` — "the single availability layer read by search, the booking engine and the export builder"

`listing_id · blocked_date (one row per calendar day) · source_type (booking | ical_import |
manual | api_channel | maintenance) · source_connection_id · source_event_id ·
source_booking_id · slot_id (**for time-slotted tours; null blocks the whole day**)`

> **Design note.** One row per day rather than a range makes availability a simple range scan
> and lets several sources block the same day independently, so releasing one source never
> accidentally opens a day another source still holds.

### `calendar_sync_logs`

`connection_id · listing_id · trigger (scheduled | manual | on_connect | retry | admin) ·
triggered_by · status (success | partial | failed | skipped_unchanged) · http_status ·
events_found/added/updated/removed · dates_blocked · dates_released · conflicts_detected ·
error_code · error_message · response_size_bytes · duration_ms · started_at · finished_at`
**Partition by month. Retain 90 days standard, 12 months on higher tiers.**

### `calendar_conflicts`

`listing_id · connection_id · event_id · booking_id · conflict_start · conflict_end ·
resolution (kept_local | blocked_anyway | manual_review) · resolved_at · resolved_by ·
acknowledged_at`

### `calendar_export_fetches`

`token_id · listing_id · fetched_at · user_agent · detected_platform · ip_hash ·
http_status · used_revoked_token`. High write volume — **roll up daily, retain raw 30 days.**

### `calendar_settings`

Account-level and listing-level defaults; listing overrides account, nulls fall through.
`default_sync_interval_minutes · timezone · retry_attempts · conflict_policy · notify_on_*
· failure_alert_threshold · notification_recipients`

---

## 10. Backend architecture

### Export endpoint

Public, authorised by an opaque token in the path. **Resolves the token by hash. Rejects
unknown or fully revoked tokens with 404, never 401, so the endpoint reveals nothing about
which listings exist.** Feed cache keyed by listing + token settings, TTL 5 min, invalidated
eagerly on any availability change. **One `VEVENT` per contiguous occupied range, not per
day.** Deterministic, stable `UID` derived from source type + source id. Honours `ETag` /
`Last-Modified` (*"many channels ignore this, so it is an optimization rather than a
guarantee"*). Fetch logged asynchronously off the response path. Horizon: **past 30 days plus
next 24 months**, configurable.

### Import pipeline — small, individually testable stages

| Stage | Responsibility | Failure |
|---|---|---|
| Fetcher | GET, 30 s total / 10 s connect, max 3 redirects, 5 MB streamed cap, **SSRF guard on every hop**, custom UA, `Accept: text/calendar` | Classify transient vs permanent |
| Parser | Unfold per RFC 5545, tolerate CRLF and LF, tolerate missing `VERSION`, extract `VEVENT`, transcode non-UTF-8 | Permanent `MALFORMED_ICS` |
| Normalizer | Resolve timezones, **expand `RRULE` within the horizon capped at 200 instances per rule**, convert `DATE-TIME` to listing tz, dedupe by UID, drop past-beyond-horizon, drop `STATUS:CANCELLED`, drop zero-length | Skip the event, count, continue |
| Diff engine | Compare against `calendar_events`; add/update/tombstone. **Short-circuit on unchanged checksum** | — |
| Conflict detector | Per candidate date, check confirmed local booking or another source's block, apply policy | Records a conflict, never blocks the pipeline |
| Availability updater | Transactional upsert, release tombstoned, refresh cache | **Rolls back the whole sync** |
| Logger | Write the log, update denormalized connection state | Best effort, never fails the sync |
| Notifier | Evaluate rules, dedupe, dispatch | Best effort, retried separately |

### Scheduler

Leader ticks every 60 s selecting `next_sync_at <= now()`, `auto_sync_enabled`, not deleted,
status in (active, error, pending). Jobs claimed with **`SELECT … FOR UPDATE SKIP LOCKED`**.
Every scheduled time carries **±10 % jitter** — *"prevents thousands of connections created in
one migration from stampeding the same OTA at the same second."* **Per-destination-host
concurrency limits and a token bucket per host** (Airbnb feeds across all tenants share one
bucket). Manual syncs go to a **separate high-priority queue**. A **stuck-job reaper** resets
anything left `syncing` over 10 minutes. Idempotent because the pipeline is a full-state diff.

### Conflict detector

| Policy | Behaviour | Suitable for |
|---|---|---|
| **`keep_local` (default)** | Do not create the block. Record a conflict. Notify. Our booking stands | Almost all operators — our platform is the source of truth |
| `block_anyway` | Create the block alongside the booking. Record. Notify loudly | Operators wanting maximum caution |
| `manual_review` | Stage the block pending, do not apply, require an explicit decision | High-value inventory |

**Blocks from two different import sources covering the same date are not a conflict.**

### Retry ladder

1 min → 5 min → 15 min → 1 h → 4 h, all jittered. After 5 → `error`, then slow retry every 6 h
for 72 h. After 72 h → auto-pause + escalation. **Permanent errors skip the ladder entirely** —
*"retrying a 404 sixteen times helps nobody."*

**Circuit breaker per destination host:** >50 % failures to a host across all tenants within
5 minutes opens the breaker for 10 minutes, flags connections with a platform-outage marker,
and the UI says "Airbnb appears to be having an outage" **rather than blaming the operator's URL**.

### Observability

Metrics: sync duration histogram by platform, success ratio by platform, queue depth, feed
size distribution, parse failure counts by reason, export fetch rate by platform, conflicts
per day. Alerts: platform success ratio <90 % over 30 min, queue depth, export p99 latency,
breaker opened. **Every sync carries a trace id surfaced in the log detail drawer.**

---

## 11. API specification

| Endpoint | Auth | Permission | Notes |
|---|---|---|---|
| `GET /ical/{listing_slug}/{token}.ics` | **None — the token is the credential** | — | 60/h per token, 600/h per IP. 200 `text/calendar` + `ETag`, `Last-Modified`, `Cache-Control: public, max-age=300`. 304 · 404 unknown/revoked/deleted · **410 grace ended** · 429 with `Retry-After` |
| `GET /api/v1/listings/{id}/calendar-connections` | Yes | `calendar.view` | **URL masked by default**; full URL only to `calendar.manage` |
| `POST /api/v1/calendar-connections/validate` | Yes | `calendar.manage` | Dry run, writes nothing. 20/min per user. Returns `event_count`, `calendar_name`, `first_event`, `last_event`, `feed_size_bytes`, `warnings` |
| `POST /api/v1/calendar-connections` | Yes | `calendar.manage` | Accepts `Idempotency-Key`. 201 with `status: syncing`. 409 `DUPLICATE_CALENDAR`, 422 `INVALID_FEED`, 402 `PLAN_LIMIT_REACHED` |
| `PATCH /api/v1/calendar-connections/{id}` | Yes | `calendar.manage` | **`platform` immutable.** URL change forces revalidation and resets checksum, failures, error state |
| `DELETE /api/v1/calendar-connections/{id}` | Yes | `calendar.manage` | `?release_dates`. Returns `dates_released`, `dates_converted_to_manual`. **409 if a sync is running** |
| `POST /api/v1/calendar-connections/{id}/sync` | Yes | `calendar.sync` | 1/60 s per connection, 10/h per listing. 202 with `job_id`. 409 `SYNC_IN_PROGRESS` |
| `POST …/sync-all` | Yes | `calendar.sync` | 1 per listing per 5 min |
| `GET /api/v1/calendar-sync-logs` | Yes | `calendar.view` | Cursor paginated, max 100 |
| `GET /api/v1/calendar-sync-logs/{id}` | Yes | **`calendar.manage`** | Full detail — *"because the excerpt can contain the feed URL"* |
| `GET /api/v1/listings/{id}/calendar-export` | Yes | `calendar.view` metadata, `calendar.manage` for the full token URL | |
| `POST …/calendar-export/regenerate` | Yes | `calendar.manage` | `{ grace_period_hours: 24 }`. Audit entry + owner notification. 5 per listing per day |
| `GET /api/v1/calendar-conflicts`, `POST …/{id}/acknowledge` | Yes | view / manage | |
| `GET`, `PUT /api/v1/calendar-settings` | Yes | `calendar.settings` | |

**Uniform error shape:** `{ error: { code, message, hint, field, trace_id } }` — `code` drives
UI logic, `message` is displayed, `hint` is secondary text. **Never surface raw parser
exceptions or upstream response bodies.**

---

## 12. Validation rules

### Feed validation

| Rule | Threshold | Code | Class |
|---|---|---|---|
| Response status | 2xx required | `HTTP_{status}` | 401/403/404/410 permanent, 5xx transient |
| Redirects | Max 3, **each re-checked against the SSRF guard** | `TOO_MANY_REDIRECTS` | Permanent |
| Connect timeout | 10 s | `CONNECT_TIMEOUT` | Transient |
| Total timeout | 30 s | `FEED_TIMEOUT` | Transient |
| Feed size | 5 MB on `Content-Length` **and again while streaming** | `FEED_TOO_LARGE` | Permanent, abort |
| Content type | `text/calendar` preferred; others only if body starts `BEGIN:VCALENDAR` | `NOT_A_CALENDAR` | Permanent |
| Body starts `BEGIN:VCALENDAR` after BOM/whitespace strip | required | `MALFORMED_ICS` | Permanent |
| Body ends `END:VCALENDAR` | required | `TRUNCATED_FEED` | **Transient — likely a partial download** |
| Event count | max 5,000 after expansion | `TOO_MANY_EVENTS` | Partial import, warn |
| Recurrence expansion | max 200 per rule, capped at horizon | `RECURRENCE_TRUNCATED` | Warn only |
| Zero events | allowed | `EMPTY_FEED` | **Warning, not an error** |
| Encoding | UTF-8 with Latin-1 fallback | `ENCODING_ERROR` | Permanent |

### Per-event validation — failures skip the event and are counted, never fail the sync

`DTSTART` present and parseable (else skip) · `DTEND` present, or derived from `DURATION`, or
default one day · `DTEND` after `DTSTART` (else skip) · range within horizon (skip silently,
not an error) · **range shorter than 730 days** (skip and warn — a multi-year event usually
signals a broken feed) · `UID` present or **synthesised deterministically from a hash of
start, end and summary** · `STATUS` not `CANCELLED` · `TRANSP` not `TRANSPARENT`.

### Token validation

Length exactly 32 and URL-safe charset → **reject with 404 before any database lookup**.
Hash must exist, else 404. `revoked_pending` serves with a deprecation log entry; `revoked`
returns 410. `expires_at` future or null, else 410. Parent listing must exist and not be
deleted, else 404.

---

## 13. Permissions

| Key | Grants |
|---|---|
| `calendar.view` | See the page, statuses, masked URLs, sync history |
| `calendar.sync` | Trigger a manual sync or Sync All |
| `calendar.manage` | Add/edit/delete connections, see full URLs, regenerate the export token |
| `calendar.settings` | Change account-level or listing-level settings |
| `calendar.audit` | View the audit trail and full sync log detail |
| `calendar.admin` | Platform-wide visibility, force sync, override the circuit breaker |

Role matrix (Owner · Manager · Staff · Read-only · Platform admin) is in the PDF. Key rules:

- **Listing scope is enforced first. A manager without an assignment gets 404, not 403, so
  listing existence is not leaked.**
- **Staff can trigger a manual sync but cannot change configuration** — *"front-desk staff need
  to force a refresh before confirming a walk-in but must not be able to detach a channel."*
- Read-only roles see masked URLs, **masked server-side; the full value never reaches a client
  that lacks the permission.**
- Platform admin access to a customer's full iCal URL **requires a justification field** and
  writes an audit record visible to the account owner.
- Every mutation records actor, timestamp, IP, before and after values.

---

## 14. Notifications

| Event | Channels | Default | Priority | Dedup |
|---|---|---|---|---|
| Sync successful (scheduled) | none | Off | — | **Never notify — fires hundreds of times a day** |
| Manual sync complete | in-app toast | On | Low | Initiating user only, no email |
| Sync failed, first | in-app | On | Low | Suppressed until threshold |
| Sync failed, threshold | in-app + email | On | High | One per connection per 24 h |
| Auto-paused after 72 h | in-app + email | On, **cannot disable** | Critical | One per pause |
| Invalid URL | in-app + email | On | High | One per connection per URL value |
| **Duplicate booking / conflict** | in-app, email, optional SMS | On, **cannot disable** | **Critical** | One per conflict, **never batched away** |
| Export token regenerated | in-app + email | On, cannot disable | High | Immediate |
| Old export token still in use | in-app | On | Medium | Once per day during grace |
| **Export feed never fetched after 48 h** | in-app | On | Medium | Once per setup |
| Platform-wide outage | in-app banner | On | Medium | One per outage window |
| Partial sync (size/event caps) | in-app | On | Medium | One per connection per 7 days |

**Content principles.** Every failure notification answers, in order: *what broke, what it
means for the business, what to do next.*

> Weak: "Sync failed for connection a4f9e2."
>
> Correct: **"Booking.com calendar stopped syncing — Bali Sunrise Trek.** We have not been able
> to read your Booking.com calendar since 30 July. The feed returns 'not found', which usually
> means the link was regenerated on Booking.com. **The 6 dates it previously blocked are still
> blocked, so you are not at risk of a double booking right now.** New Booking.com reservations
> will not appear here until this is fixed. [Fix this calendar]"

Rules: name the listing and platform in the subject · **always state whether existing blocks
are retained** · link directly to the affected connection · never blame the user for a
channel-side outage · **batch across listings** (12 failures from one Airbnb outage = one
email) · respect quiet hours except for conflicts and auto-pause.

Weekly digest for accounts with >5 connections, opt-out available.

---

## 15. Settings

Account level: default sync frequency (**sub-hourly plan-gated**) · timezone (for all-day
events with no tz) · retry attempts (1–10, default 5) · **conflict policy** · email
notification toggles (conflicts cannot be turned off) · recipients · quiet hours (critical
alerts override).

Per listing: include imported blocks in export (default On). Per connection: auto sync,
frequency, `exclude_from_export`. Admin-only: sync horizon (past 30 days, next 24 months).
Plan: max calendars per listing (default 10).

**Frequency guidance shown inline** — 15/30 min for high-turnover (risk of rate limiting);
1 h default; 3–6 h low volume; 12/24 h seasonal. *"The UI should state honestly that reducing
our interval only shortens half the loop. How quickly Airbnb sees our changes is controlled by
Airbnb."*

---

## 16. Edge cases

The full 36-row table is in the PDF. The ones that change the design:

| # | Case | Handling |
|---|---|---|
| E3 | Booking cancelled here | Release dates, invalidate cache. **Log it — an operator who cancels and sees no change on Airbnb will open a ticket** |
| E4 | Imported event disappears upstream | Tombstone, release **unless another source or a local booking still holds them** |
| E5 | `RRULE` | Expand within horizon, cap 200/rule, store instances with a parent link, honour `EXDATE`, truncate infinite rules and flag |
| E6 | `RECURRENCE-ID` overrides | Exception instance replaces the generated occurrence |
| E7 | Timezone mismatch | **All-day events are literal calendar dates with no conversion — that is what every OTA means by them.** Timed events convert from `TZID` → `X-WR-TIMEZONE` → listing tz |
| E8 | DST inside a range | Date arithmetic in the listing timezone, **never fixed second counts** |
| E9 | Half-open interval | `DTEND` is exclusive: 14–18 Aug blocks 14, 15, 16, 17. **Some feeds get this wrong. Detect `DTSTART == DTEND` and treat as one blocked day rather than zero** |
| E10 | Duplicate events in one feed | Dedupe by UID; if missing, by hash of start+end+summary |
| E11 | Same booking from two channels | Both create blocks. **Not a conflict.** Retained and released independently |
| E12 | **Feedback loop — a channel republishing our own events** | **Detect our own deterministic UID prefix in an inbound feed and skip those events.** Plus the manual `exclude_from_export` control |
| E15 | Network failure mid-download | Transient. **Partial bodies discarded, never parsed** |
| E16 | We are rate limited (429) | Honour `Retry-After`, raise the effective interval for that host **across all tenants**, never retry immediately |
| E18 | Corrupted or truncated ICS | **Reject the whole payload** — a truncated feed looks identical to one where all later bookings were cancelled |
| E19 | Very large calendars | Stream-parse, never buffer. Import earliest 5,000 by start date — near-term matters most |
| E20 | Imported booking overlaps an existing booking | Conflict policy. Default keep local, record, do not block, notify **critical** |
| E24 | Redirect chain to a different host | Up to 3 hops, SSRF guard on **every** hop, final host used for rate limiting |
| E25 | Self-signed/expired TLS | **Rejected, no bypass option** |
| E26 | Feed requiring a specific user agent | Send a stable identifying UA with a contact URL |
| **E28** | **Time-slotted tour with per-slot inventory** | **iCal blocks the whole day, since the format cannot express slot-level availability. Must be stated in the UI when a listing has slots configured, with a recommendation to use a direct API** |
| **E29** | **Multi-day tour with shared departures** | Same limitation. **Blocking is per date, not per departure** |
| E30 | Two members editing one connection | Optimistic concurrency on `updated_at`, 409 + reload prompt |
| E31 | Sync running while deleting | 409, UI retries once the job settles |
| E32 | Clock skew | **Never trust `DTSTAMP` for ordering. Diff on content, not timestamps** |
| E36 | Account downgraded below its limit | Existing connections keep working. **Never silently disconnect a paying customer's channels** |

---

## 17. Security

### Export token

**32 URL-safe characters from a CSPRNG (~190 bits).** Stored as a **SHA-256 hash; lookups
compare hashes.** Raw token only where it must be redisplayed, **encrypted at rest with
envelope encryption**. Scoped to a single listing. Rotatable with a 24 h grace window.
**Never logged in plain text** — access logs and traces mask the token segment. Response sets
`Referrer-Policy: no-referrer`.

### Export endpoint hardening

Enumeration resistance via **404 with constant-time comparison and uniform response time** ·
**no PII — dates, a stable UID and a generic summary; never guest names, emails, phones,
prices or booking references** · 60/h per token, 600/h per IP · abuse alerts when one token is
fetched by >20 distinct IPs in an hour or volume jumps 10× week over week · `nosniff`, no CORS
headers (browsers are not the intended consumer) · deleted listings 404 regardless of token.

### Import security — *"this is where the real risk is"*

| Control | Implementation |
|---|---|
| **SSRF guard** | Resolve the hostname; reject loopback, private (10/8, 172.16/12, 192.168/16), link-local (169.254/16, fe80::/10), unique-local (fc00::/7), multicast, reserved. **Re-check after every redirect. Use a resolved-IP-pinned connection to close the DNS-rebinding window between check and connect** |
| Metadata endpoints | Explicitly deny `169.254.169.254` and cloud provider metadata hostnames |
| Scheme | **Only `https`.** No `file`, `gopher`, `ftp`, `data` |
| Redirects | Max 3, each re-validated |
| **Egress isolation** | Fetches run from a dedicated worker pool with a network policy permitting outbound 443 only, **no access to internal services** |
| Response size | Streamed 5 MB cap enforced **before parsing** |
| Parser hardening | No external entity resolution, no recursion on nested structures, bounded recurrence expansion, timeouts on the parse stage itself. **Fuzz the parser in CI** |
| Timeouts | 10 s connect, 30 s total, **enforced at the socket level** |
| Content isolation | Feed content is untrusted. `SUMMARY`/`DESCRIPTION` escaped on display, **never rendered as HTML** |
| **URL storage** | **Encrypted at rest — OTA iCal URLs contain bearer tokens for the operator's account on that platform** |
| URL masking | Full URLs only to `calendar.manage`. Masked in logs, errors, support tooling and analytics |
| Error leakage | Upstream bodies never returned verbatim. Log drawer shows a sanitized 500-char excerpt with token-shaped strings redacted |

### Audit trail

Immutable records with actor, timestamp, IP, user agent, before and after for: connection
created / updated (field-level diff) / URL changed (values masked, only a change flag) /
deleted (with the release decision), manual sync, frequency change, token regeneration,
settings change, conflict acknowledged, **admin viewed a full iCal URL with justification**.
Retained 24 months, visible to the account owner, exportable.

### Data protection

**Guest personal data never enters an iCal feed in either direction.** If an inbound feed
carries a guest name in `SUMMARY`, store it for debugging but **never display it in the
availability calendar and never re-export it**. `raw_event` capped at 4 KB and purged with the
connection. IPs hashed with a rotating salt.

---

## 18. UX principles

1. **Make the invisible visible.** *"Sync is a background process. The operator's trust depends
   entirely on being able to see that it ran, when it ran and what it changed."*
2. **Be honest about latency.** *"The single largest source of support load on iCal features is
   an operator expecting instant propagation."*
3. **Fail loudly, degrade safely.** *"A broken feed must be impossible to miss, and a broken
   feed must never silently open dates for sale."*

Notable specifics: show what *changed*, not just that it ran (the blocked-dates delta is the
most useful column) · errors that name the fix, every code paired with a hint · manual sync
always available, **even on a paused or errored connection — it is how users verify a fix** ·
onboarding that explains **both directions are needed** · per-platform help with screenshots
(*"the highest-value content in the feature"*) · **show the export as connected, not just
published** — "last fetched by Airbnb, 22 minutes ago" is the only proof outbound works ·
cross-link from the availability calendar via a source chip · do not hide limitations.

### Microcopy reference

| Context | Copy |
|---|---|
| Export description | Share this link with the channels you sell on so they can block dates that are already booked here. |
| Export privacy | Anyone with this link can see which dates are blocked. It contains no guest names or contact details. |
| Never fetched | No channel has read this feed yet. It can take up to 24 hours after you paste the link. |
| Import description | Dates booked on these channels will be blocked here automatically. |
| Zero events | This feed is valid but currently empty. That is normal if you have no upcoming bookings on this channel. |
| Conflict alert | A booking on Airbnb overlaps dates already booked here on 14 to 16 August. We kept your booking and did not block those dates. |
| Delete confirmation | This does not cancel any bookings. It only stops future updates from this channel. |
| Latency expectation | We publish your changes immediately. Each channel decides how often to read them, usually every 1 to 24 hours. |

---

## 19. Future enhancements

**Fast follow:** Google/Outlook/Apple Calendar as first-class import platforms · bulk connect
across listings · copy sync config between listings.
**Phase 2:** outbound webhooks · conflict resolution workspace · sync health scoring.
**Phase 3:** direct OTA APIs for top channels · real-time inbound push · **seat and capacity
inventory sync — "the structural fix for time-slotted tours"**.
**Phase 4:** availability rules engine · pricing sync · channel-manager integrations ·
two-way write-back.

### Architectural decisions to protect

1. `blocked_dates.source_type` lets iCal, direct API and manual coexist per date — **adding a
   direct API is a new source type, not a migration**.
2. The import pipeline is a **full-state diff, not an incremental apply**, so a channel can be
   switched from iCal to API and back without corrupting availability.
3. Export token settings live separately from the listing, so per-channel export variants can
   be added without a schema change.

---

## 20. Implementation notes

### Build sequence

| Milestone | Scope | Ships as |
|---|---|---|
| **M1** | Export only — token model, feed builder, cache, public endpoint, export UI, fetch logging | Operators can push availability out. **Immediately useful on its own** |
| **M2** | Import, manual only — modal, validation endpoint, fetcher, parser, normalizer, diff, blocked-dates writer, Sync Now | Operators can pull when they choose |
| **M3** | Automation — scheduler, workers, retry ladder, circuit breaker, status model, history | **The feature becomes real** |
| **M4** | Reliability and communication — conflict detector, notifications, banners, troubleshooting, help articles | Support load drops |
| **M5** | Scale — account dashboard, settings, permission matrix, audit trail, bulk ops | Ready for multi-listing operators |

> **M1 and M2 are independently shippable and independently valuable. Do not hold export
> behind import.**

### Testing requirements

- **Parser fixture library.** Capture real feeds from every supported channel and commit them.
  *"Include the ugly ones: missing `VERSION`, LF-only line endings, Latin-1 encoding, inclusive
  `DTEND`, reused `UID`, cancelled events, 3,000-event feeds, feeds with guest names in the
  summary. Every fixture is a regression test."*
- **Property tests.** Syncing the same feed twice produces no changes on the second run. Feed A
  → B → A returns to state A. Removing all events releases exactly the dates that were added.
- **Failure injection.** Timeouts, slow-loris, 5xx storms, redirect loops, mid-stream drops,
  oversized bodies, TLS errors — each must produce the right status, retry behaviour and **no
  partial writes**.
- **Security tests.** SSRF against loopback, private ranges, cloud metadata, **DNS rebinding**.
  Token enumeration. Rate limits. **Verification that no guest PII appears in an export feed
  under any configuration.**
- **Concurrency tests.** Two workers claiming one connection. Delete during an active sync.
  Booking created during a sync covering the same dates.
- **Timezone tests.** DST both directions, all-day events across tz boundaries, half-hour
  offset zones, feeds with no timezone information.

### Non-functional targets

| Metric | Target |
|---|---|
| Export p95, cache hit | < 50 ms |
| Export p95, cache miss | < 300 ms |
| Sync job p95, feed < 100 KB | < 3 s |
| Scheduler lag (due → claimed) | < 60 s at p95 |
| Sync success rate excluding user-side URL errors | > 99 % |
| Page time to interactive | < 1.5 s |
| Sustained throughput | 10,000 connections/hour/worker pool, horizontally scalable |

### Open questions the PRD leaves to the product owner

1. **Plan gating** — which intervals behind which tier, calendar cap per tier?
2. **Time-slotted tours** — ship iCal for slot-based listings with a warning, or block it until
   API-based slot sync exists? *PRD recommendation: ship with a warning, since day-level
   blocking is still better than nothing.*
3. **Export horizon** — is past 30 days + 24 months right?
4. **Conflict default** — confirm `keep_local` is correct.
5. **Retention** — 90 days of history enough, given double-booking disputes surface months later?
6. **Which channels get first-class help content at launch?**
