# Instagram Feed — Architecture & Operations

> The brand Instagram grid on every destination page. **First-party and
> auto-synced**: an admin connects one Instagram account, a daily job mirrors the
> recent feed into tiles we own, and the public site renders them from our own
> data (never an embedded third-party widget).
>
> Status: **shipped** (2026-07-28). Verified live against a real BUSINESS
> account. **Token-only** since 2026-07-28: the credential is a single long-lived
> access token entered in the dashboard (no OAuth, no App ID/Secret/Redirect, no
> demo provider).

---

## 1. What it is, in one breath

```
Instagram account ──(daily sync)──► mirror media into Cloudinary ──► InstagramPost rows ──► public grid
        ▲                                                                      │
        └────────── token stored encrypted, auto-refreshed ◄───────────────────┘
```

- **No manual tiles.** Every tile comes from the sync. The dashboard only holds
  the *access token* and *curates* (reorder / hide / alt text / island).
- **No hotlinking.** Instagram's `media_url` CDN links expire within days and
  hotlinking breaks their terms, so every asset is mirrored into **our**
  Cloudinary and the public grid renders that.
- **No third-party embed.** The section is server-rendered with the rest of the
  page (PPR / `'use cache'`), carries no consent-banner cookies, and is styled to
  the Figma grid.

---

## 2. How it connects — one access token

There is exactly **one** credential: a **long-lived Instagram access token**.

| You provide | Where | OAuth? | App Review? |
|---|---|---|---|
| A long-lived token | Dashboard field only (stored in the DB) | No | No |

**Why token-only:** OAuth's user-authorisation flow exists for apps that connect
*other people's* accounts. This feature syncs *our own* brand account, so a
long-lived token generated once from the Meta app's "API setup with Instagram
login" panel is all it needs — no Connect button, no App Review, no App
ID/Secret/Redirect to configure. The token is pasted in the dashboard and stored
**in the database (encrypted)** — **DB-only, there is no `INSTAGRAM_ACCESS_TOKEN`
env var**. The nightly refresh rotates the token in place, also in the DB.

Code: [`instagram-config.service.ts`](../../backend/src/instagram/instagram-config.service.ts) ·
[`instagram-graph.provider.ts`](../../backend/src/instagram/providers/instagram-graph.provider.ts)

---

## 3. Configuration & credential resolution

### 3.1 Resolution

The token comes **only from the database** (the InstagramAccount row), stored
**encrypted** (AES-256-GCM, `ENCRYPTION_KEY`). There is **no env fallback**.

```
InstagramConfigService.resolve():
  accessToken = dec(configAccessToken) (DB)   // DB-only, no env
  hasToken    = Boolean(accessToken)
  isConfigured = hasToken
```

- `resolve()` is **async** (it reads the DB) and runs **per call**, so a token
  change needs no restart of the running feature.
- **Saving a token re-seeds the connection.** `saveCredentials` clears the
  working connection (`igUserId`, stored token, expiry, last-sync) in the same
  write, so the next sync resolves the new account and handle. See §6.

Code: [`instagram-config.service.ts`](../../backend/src/instagram/instagram-config.service.ts) ·
[`crypto.util.ts`](../../backend/src/common/utils/crypto.util.ts)

### 3.2 Environment variables

| Var | Required? | Notes |
|---|---|---|
| `ENCRYPTION_KEY` | **required** | Reused to encrypt the token — **no separate Instagram secret**. |

There is **no `INSTAGRAM_ACCESS_TOKEN`** env var — the credential is DB-only,
entered in the dashboard. With no dashboard token the sync stays dormant and the
feed simply renders whatever tiles already exist.

### 3.3 Dashboard credential

Settings → Instagram → **Instagram Access Token** card. A single Access Token
field, **write-only** — the value is never returned by any GET. What the field
shows instead is `maskedAccessToken`: bullets + the last 4 characters
(`Current: ••••••••WQZD. Leave blank to keep it.`), produced by the shared
`maskSecret()` in [`common/utils/crypto.util.ts`](../../backend/src/common/utils/crypto.util.ts)
— the one masking rule every platform secret renders through (Stripe, Mollie,
Meta CAPI, the translation key, Trustpilot/Google), so an admin can tell WHICH
token is stored without it being usable. A null mask alongside `hasAccessToken: true` means the stored
ciphertext no longer decrypts (a rotated `ENCRYPTION_KEY`) and the field says so.

The token is stored in the DB (encrypted). Saving a **different** token re-seeds
the connection; **re-submitting the token already stored is a no-op**, not a
reconnect (`InstagramConfigService.saveCredentials` compares against the decrypted
current value first). That guard matters because the field is write-only and can
re-send an unchanged value — a browser/password-manager fill, or a form whose
dirty state outlived the save — and treating that as a reconnect silently tore
down a working feed (`igUserId` + the refreshed token + expiry + last-sync state
all nulled, panel back to "Last sync: Never / Token expires: Unknown").

The dashboard side pairs with that: **Save Changes runs its writes in sequence**
(token → account → kill switch), stops on the first failure, and **always**
`reset()`s the form from server truth afterwards. Both halves are load-bearing —
fired in parallel a single rejected PATCH left the other two applied with no way
to tell which had landed, and without the unconditional reset the token field
stayed dirty forever (TanStack structural sharing hands back the SAME data
reference when a refetch is deep-equal, so the reset effect never re-ran) and
re-sent the token on every later save.

- API: `GET /instagram/credentials` (non-secret status + masked tail) ·
  `PUT /instagram/credentials`
- Code: dashboard `components/settings/instagram-form.tsx` → `CredentialsCard`
  (separate repo `tripwheel-x-islandtours-dashboard`), backend
  [`instagram.controller.ts`](../../backend/src/instagram/instagram.controller.ts)

---

## 4. The sync flow (fetch → mirror → upsert → reconcile)

The heart of the feature. One run does this, idempotently:

```
syncNow():
  1. readCredential()                       # token + igUserId (see §5)
       └─ none? → clean no-op (status OK), feed keeps its tiles
  2. refresh the token if near expiry        # see §6
  3. resolveAccount() → store the handle     # auto-derived, best-effort (see §7)
  4. fetchMedia(igUserId, token, limit)      # limit = configured posts-per-sync (default 24), newest first
  5. reconcile(media):
       for each fetched post (by igMediaId):
         • SEEN  → refresh metadata only (caption/permalink/type/postedAt).
                   Media already mirrored; displayOrder + isActive are ADMIN-owned,
                   never touched.
         • NEW   → mirror media into Cloudinary, create a tile appended to the grid.
         • GONE  → an API tile no longer in the recent set is deleted, its mirror cleaned.
  6. record lastSyncedAt / lastSyncStatus / lastSyncError
```

- **Fetch window:** dashboard-configurable **posts-per-sync**
  (`InstagramAccount.syncFetchLimit`, default **24**, bounded **1..50**). Instagram
  serves ~25 per page, so the Graph provider **paginates** (follows the
  `paging.next` cursor, `MAX_PAGES` guard) to reach counts above one page. Kept
  above the largest display cap (gallery = 15) so there are spares to
  reorder/hide, without walking the whole account history. Older API tiles beyond
  the fetched set drop out. The sync clamps the value defensively
  (`resolveFetchLimit`).
- **Upsert key:** `igMediaId` (unique). A re-sync updates, never duplicates.
- **Idempotent & self-healing.** Safe to run repeatedly; a per-item mirror
  failure yields `PARTIAL` (not a crash), a fetch failure `FAILED`, and every
  outcome is recorded rather than thrown so the worker never dies on a bad night.

Code: [`instagram-sync.service.ts`](../../backend/src/instagram/instagram-sync.service.ts)

### 4.1 Media mirroring

Per post, the mirror uploads the Instagram CDN asset **into our Cloudinary**
(folder `islandtours/instagram`) and stores the URL we own:

| Instagram post | We store |
|---|---|
| Image | `imageUrl` = mirrored image |
| Video / reel | `videoUrl` = mirrored video **+** `imageUrl` = mirrored poster (its `thumbnail_url`, or a Cloudinary-generated still) |
| Carousel | `imageUrl` = mirrored first image, badged `CAROUSEL_ALBUM` |

Cloudinary public ids are stored (`imagePublicId`, `videoPublicId`) so a removed
tile's derivatives can be cleaned up. Both the sync's "gone" path **and** the
admin delete go through the same cleanup helper, so neither orphans an asset.

Code: [`cloudinary.service.ts`](../../backend/src/media-gallery/cloudinary.service.ts)
(`uploadFromUrl`, `videoPosterUrl`) ·
[`instagram-mirror.util.ts`](../../backend/src/instagram/instagram-mirror.util.ts)

---

## 5. How often it syncs

| Trigger | When | Code |
|---|---|---|
| **Auto cron** | **Dashboard-configurable cadence** (default daily 02:30 UTC) | [`instagram-sync.scheduler.ts`](../../backend/src/instagram/instagram-sync.scheduler.ts) |
| **Manual** | Admin clicks **Sync now** (Settings → Instagram) → `POST /instagram/sync` | [`instagram.controller.ts`](../../backend/src/instagram/instagram.controller.ts) |

- **Configurable cadence.** `InstagramAccount.syncIntervalMinutes` (default 1440)
  is set in the dashboard from a fixed menu — **every 3h / 6h / 12h / daily**
  (180 / 360 / 720 / 1440). The scheduler maps each to a cron kept at **:30 past
  the hour, UTC** (`30 */3 * * *`, `30 */6 * * *`, `30 */12 * * *`, `30 2 * * *`).
- **Live reschedule.** Rather than a static `@Cron` decorator, the job is
  registered via `SchedulerRegistry` in `onModuleInit`, and
  `InstagramService.updateAccount` calls `applySchedule()` whenever the cadence
  changes — so a new frequency takes effect with **no restart**
  (`cron` package's `CronJob`, tear-down + re-register).
- In-process `@nestjs/schedule` (not BullMQ) — the sync is an idempotent
  recompute, so it needs no retry/concurrency harness. `ScheduleModule.forRoot()`
  is registered once in `AppModule`.
- The :30 offset keeps runs off the hour (no thundering herd) and the daily one
  sits just before the 03:00 commercial nightly.
- After a run that actually changed tiles (created/removed > 0), the scheduler
  busts the public `instagram` cache tag so the grid repaints without waiting out
  the `'use cache'` timer. A no-op sync does not thrash the cache.

---

## 6. Token lifecycle & auto-refresh

Instagram issues a **60-day long-lived token**. The system keeps it alive
automatically.

### 6.1 The seed-then-refresh model

```
dashboard access token (DB) ──(seeds once)──► DB (encrypted) ──(nightly refresh)──► DB (encrypted) ──► ...
```

1. **Seed (once).** On the first sync, if there is no live working token, the
   configured dashboard token (from the DB) is used to:
   - resolve the account (`/me` → `user_id` + `username`),
   - refresh immediately to capture a real expiry (and a fresh 60-day token); if
     the token is <24h old and not yet refreshable, it is stored as-is with an
     assumed 60-day expiry,
   - store the token **encrypted** + `igUserId` + `tokenExpiresAt`.
2. **Refresh (nightly).** From then on the DB token is authoritative. Each sync,
   if `tokenExpiresAt` is within **`REFRESH_WINDOW_MS = 10 days`**, it calls
   `refresh_access_token` (`grant_type=ig_refresh_token`) and stores the new
   token + expiry. Instagram requires the token be **≥24h old and unexpired** —
   always true inside the window.
3. **Never re-seeds over a live token.** The configured value only seeds when the
   DB has no usable token, so a refreshed token is never clobbered by the
   original. (Changing the token in the dashboard explicitly clears the DB copy,
   which forces a fresh seed — see §3.1.)

### 6.2 What you do (and don't do)

- **You don't** manually regenerate the token every 60 days — it self-renews.
- **You only** re-enter a token if you switch accounts, or if the connection sat
  dead past its expiry (a `FAILED`/`EXPIRING` status flags this).
- A refresh that fails inside the window records **`EXPIRING`** (surfaced in the
  dashboard) and never gets overwritten by that same run's successful sync — so
  the warning actually reaches the admin before the token dies.

Constants: `REFRESH_WINDOW_MS` = 10 days, `ASSUMED_LIFETIME_SECONDS` = 60 days.
Code: [`instagram-token.service.ts`](../../backend/src/instagram/instagram-token.service.ts)

---

## 7. Handle & profile link — fully automatic

The section handle and "View on Instagram" link are **derived from the connected
account**, never typed in:

- Resolved via `GET /me?fields=user_id,username` on connect/seed **and refreshed
  on every sync** (best-effort — a hiccup never fails the sync).
- The profile URL is built from the handle (`instagram.com/{username}`).
- The dashboard shows the handle **read-only**; there are no Handle / Profile
  Link inputs.

Code: [`instagram-token.service.ts`](../../backend/src/instagram/instagram-token.service.ts)
(`storeUsername`) · [`instagram-graph.provider.ts`](../../backend/src/instagram/providers/instagram-graph.provider.ts)
(`resolveAccount`)

---

## 8. Public rendering

`GET /instagram/public/feed` (public, no auth) returns only rendered-tile fields.
`enabled` folds together the admin kill switch (`SiteInfo.enableInstagram`) and
"nothing to show" — either way the frontend renders no section.

- **Two layouts**, chosen in the dashboard (default **`GALLERY`**):
  - `GRID` — curated band, rounded cards, **6 tiles**.
  - `GALLERY` — Instagram-profile look, 4:5 portraits, hairline gaps, **15 tiles**.
  - Defaults: `DEFAULT_LIMIT_BY_LAYOUT = { GRID: 6, GALLERY: 15 }`. Tiles past the
    cap stay saved but are greyed-out "not shown" in the dashboard.
- **Video tiles** paint the poster first, then a muted looped reel; reduced-motion
  visitors see the poster alone.
- Cached with `'use cache'` + `cacheTag('instagram')`; dashboard writes bust that
  tag through the cache-revalidation bridge, and the cron busts it directly.

Code (public frontend repo `island-tour-development/frontend`):
[`lib/api/public/instagram.ts`](../../frontend/lib/api/public/instagram.ts) ·
[`components/frontend/instagram/`](../../frontend/components/frontend/instagram/)
(`instagram-section.tsx`, `instagram-grid.tsx`, `instagram-gallery.tsx`,
`instagram-tile.tsx`, `instagram-tile-video.tsx`) ·
backend [`instagram.service.ts`](../../backend/src/instagram/instagram.service.ts)
(`getPublicFeed`)

---

## 9. Curation (the only per-tile controls)

Since tiles come only from the sync, the dashboard leaves exactly:

| Action | Effect | Survives re-sync? |
|---|---|---|
| **Reorder** (arrows) | Sets `displayOrder` — which tiles fill the cap | Yes (admin-owned) |
| **Hide/show** (eye) | Toggles `isActive` — off the grid without deleting | Yes (admin-owned) |
| **Alt text / island** | `altText`, `destinationId` (pin to one island) | Yes |
| **Delete** | Removes the tile + cleans its Cloudinary mirror | Comes back if the post is still in the recent set — **hide** to keep it out for good |

The sync never touches `displayOrder` or `isActive` on an existing tile, so
curation is preserved across runs.

Code: backend [`instagram.service.ts`](../../backend/src/instagram/instagram.service.ts)
(`updatePost`, `reorderPosts`, `removePost`)

---

## 10. Security

- **Token encrypted** with AES-256-GCM (`ENCRYPTION_KEY`, `crypto.util`). Never
  logged, never returned by any HTTP surface, never on the public feed.
- **Admin-gated**: reads need `VIEW_SETTINGS`, writes `MANAGE_SETTINGS`; only
  `GET public/feed` is public and its select never touches the token.
- **Error paths** log status + host only, never the response body (which can echo
  a token).

Code: [`crypto.util.ts`](../../backend/src/common/utils/crypto.util.ts) ·
[`instagram.controller.ts`](../../backend/src/instagram/instagram.controller.ts)

---

## 11. API endpoints

Base: `http://localhost:5050/api/v1/instagram`

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `public/feed` | public | Rendered tiles + handle + layout |
| GET | `credentials` | VIEW_SETTINGS | Non-secret token status + masked tail (`••••••••WQZD`) |
| PUT | `credentials` | MANAGE_SETTINGS | Save the access token (a DIFFERENT value re-seeds the connection; the same value is a no-op) |
| GET | `connection` | VIEW_SETTINGS | Token configured? expiry? last sync? |
| POST | `sync` | MANAGE_SETTINGS | Run a sync now |
| GET/PUT | `account` | VIEW/MANAGE_SETTINGS | Layout + sync tuning (posts-per-sync, cadence); handle/link are auto |
| GET | `posts` | VIEW_SETTINGS | All tiles for curation |
| PATCH | `posts/reorder` | MANAGE_SETTINGS | Persist a reorder |
| PATCH | `posts/:id` | MANAGE_SETTINGS | Hide / alt text / island |
| DELETE | `posts/:id` | MANAGE_SETTINGS | Remove a tile + mirror |

Code: [`instagram.controller.ts`](../../backend/src/instagram/instagram.controller.ts) ·
[`instagram.swagger.ts`](../../backend/src/instagram/instagram.swagger.ts)

---

## 12. Data model

Singleton `InstagramAccount` (id `'default'`) + `InstagramPost` rows.

**`InstagramAccount`** — credential + connection + display:
- Credential (dashboard, DB-only): `configAccessToken` (enc)
- Live connection (seeded from the token): `igUserId`, `accessToken` (enc,
  refreshed), `tokenExpiresAt`, `lastSyncedAt`, `lastSyncStatus`, `lastSyncError`
- Display + sync tuning: `username` (auto), `profileUrl`, `layout`,
  `syncFetchLimit` (posts-per-sync, default 24), `syncIntervalMinutes`
  (auto-sync cadence, default 1440)

**`InstagramPost`** — one tile:
- `source` (`API`), `igMediaId` (unique upsert key), `mediaType`
- `imageUrl` (poster/still, always ours), `imagePublicId`, `videoUrl`,
  `videoPublicId`, `width`, `height`
- `permalink`, `caption`, `altText`, `postedAt`, `syncedAt`
- Curation: `displayOrder`, `isActive`, `destinationId`
- `isPinned` — reserved, currently always false (the `instagram_business_basic`
  scope exposes no pinned state)

Enums: `InstagramSource`, `InstagramMediaType`, `InstagramLayout`,
`InstagramSyncStatus (OK / PARTIAL / FAILED / EXPIRING)`.

Code: [`instagram.prisma`](../../backend/prisma/instagram.prisma) ·
[`enums.prisma`](../../backend/prisma/enums.prisma)
Migrations: `20260728060000_instagram_oauth_columns`,
`20260728061500_instagram_video_public_id`,
`20260728120000_instagram_dashboard_credentials`,
`20260728130000_instagram_token_only` (drops the App ID/Secret/Redirect columns),
`20260728140000_instagram_sync_tuning` (adds syncFetchLimit + syncIntervalMinutes),
`20260728150000_instagram_gallery_default` (layout default → GALLERY, section
default → on),
`20260728160000_site_info_enable_instagram_not_null` (`SiteInfo.enableInstagram`
nullable → NOT NULL, backfilled to true: as a nullable column the read sites
disagreed on what NULL meant — dashboard `?? true`, public projection `?? false`
— and the form only PATCHes on a difference, so the split never healed)
(in [`backend/prisma/migrations/`](../../backend/prisma/migrations/))

---

## 13. Code reference map

### Backend — `island-tour-development/backend/`

| File | Responsibility |
|---|---|
| [`src/instagram/providers/instagram-api.provider.ts`](../../backend/src/instagram/providers/instagram-api.provider.ts) | Provider interface (refresh/resolve/fetch), types, DI token |
| [`src/instagram/providers/instagram-graph.provider.ts`](../../backend/src/instagram/providers/instagram-graph.provider.ts) | Live "Instagram API with Instagram Login" HTTP client |
| [`src/instagram/instagram-config.service.ts`](../../backend/src/instagram/instagram-config.service.ts) | Token resolution (DB-only), save (re-seeds), status |
| [`src/instagram/instagram-token.service.ts`](../../backend/src/instagram/instagram-token.service.ts) | Encrypted token store, seed, refresh, status, username |
| [`src/instagram/instagram-sync.service.ts`](../../backend/src/instagram/instagram-sync.service.ts) | The sync engine (fetch/mirror/upsert/reconcile) |
| [`src/instagram/instagram-sync.scheduler.ts`](../../backend/src/instagram/instagram-sync.scheduler.ts) | Daily cron (02:30 UTC) |
| [`src/instagram/instagram-mirror.util.ts`](../../backend/src/instagram/instagram-mirror.util.ts) | Shared Cloudinary cleanup |
| [`src/instagram/instagram.service.ts`](../../backend/src/instagram/instagram.service.ts) | Public feed + tile curation |
| [`src/instagram/instagram.controller.ts`](../../backend/src/instagram/instagram.controller.ts) | HTTP endpoints |
| [`src/instagram/instagram.module.ts`](../../backend/src/instagram/instagram.module.ts) | DI wiring (Graph provider bound to the DI token) |
| [`src/instagram/dto/instagram.dto.ts`](../../backend/src/instagram/dto/instagram.dto.ts) | Request/response DTOs |
| [`src/media-gallery/cloudinary.service.ts`](../../backend/src/media-gallery/cloudinary.service.ts) | `uploadFromUrl`, `videoPosterUrl` |
| [`prisma/instagram.prisma`](../../backend/prisma/instagram.prisma) · [`prisma/enums.prisma`](../../backend/prisma/enums.prisma) | Schema |

### Public frontend — `island-tour-development/frontend/`

| File | Responsibility |
|---|---|
| [`lib/api/public/instagram.ts`](../../frontend/lib/api/public/instagram.ts) | `getInstagramFeed` (`'use cache'`) |
| [`components/frontend/instagram/`](../../frontend/components/frontend/instagram/) | Section, grid, gallery, tile, tile-video |
| [`lib/cache-tags.ts`](../../frontend/lib/cache-tags.ts) | `instagram` cache tag |

### Dashboard — separate repo `tripwheel-x-islandtours-dashboard/`

| File | Responsibility |
|---|---|
| `components/settings/instagram-form.tsx` | InstagramSettingsCard (token + connection status + Sync now + section on/off/handle/layout) · TilesCard |
| `types/instagram.ts` · `lib/api/instagram.ts` · `hooks/instagram/use-instagram.ts` | Types, API client, TanStack Query hooks |
| `lib/api/cache-revalidation.ts` | Maps `/instagram/*` writes → `instagram` tag |

---

## 14. Runbook

### First-time setup

1. Instagram account is **Business/Creator**.
2. In the Meta app's **API setup with Instagram login**, generate a **long-lived
   access token**.
3. Paste it into **Settings → Instagram → Access Token** and Save (stored in the
   DB, encrypted; no restart needed — there is no env token).
4. Click **Sync now**. Tiles appear; the handle auto-fills.

### Rotate / change account

- Enter a new Access Token in the dashboard and Sync now. Saving the token clears
  the old connection, so the new token seeds a fresh account and handle on the
  next sync.

### Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `lastSyncStatus = FAILED` | Token expired/revoked, or account private | Re-enter a fresh long-lived token |
| `EXPIRING` badge | Nightly refresh failing near expiry | Re-enter a fresh token before it lapses |
| Feed empty after saving the token | No sync run yet | Sync now |
| Tile keeps reappearing after delete | Still in the recent-24 set | **Hide** it instead |

---

## 15. Master alignment

Implements master §3.9 ("Instagram grid: brand handle row per review"). Phase 1
(admin-curated tiles) is superseded by phase 2 (auto-sync); the manual picker is
retired. See the EXECUTED blocks in
[`APPLICATION-FEATURES-AND-TASKS.md`](../APPLICATION-FEATURES-AND-TASKS.md)
(search "Instagram grid").
