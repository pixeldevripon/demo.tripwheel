---
name: pattern_ssrf_guard_calendar_sync
description: The SSRF guard for operator-supplied calendar URLs (ip-guard.util.ts + safe-http.util.ts) is a reference-quality implementation - reviewed 2026-08-02, no bypass found
metadata:
  type: project
---

`backend/src/common/net/ip-guard.util.ts` + `safe-http.util.ts` (feeding
`calendar-sync`'s inbound iCal fetch) is a hand-rolled SSRF guard reviewed in depth
on 2026-08-02. It correctly defeats every bypass tried:

- DNS rebinding: `resolvePinnedAddress` does ONE `dns.lookup(host,{all:true})`,
  checks ALL returned records (all-or-nothing), then `fetchOnce` pins the TCP
  connect to that exact address via a custom `lookup` override that ignores
  whatever hostname Node hands it. No second DNS query ever happens for that hop.
- Redirects: `safeFetchFeed`'s loop re-runs `validateFeedUrl` (scheme/host/creds)
  AND `resolvePinnedAddress` fresh on every hop - a redirect to
  `169.254.169.254` or to `http://` is caught, not just the first URL.
- IPv4 obfuscation (octal/hex/decimal/short-form `127.1`): verified empirically
  that Node's WHATWG `URL` class already canonicalizes all of these to dotted-
  decimal before `blockedHostnameReason` ever sees them - closed upstream, not
  by this code, but confirmed closed.
- `nip.io`-style DNS rebinding tricks (hostname string looks benign, resolves to
  169.254.169.254): safe, because the guard checks the RESOLVED IP, never the
  hostname string.
- IPv4-mapped IPv6 (`::ffff:169.254.169.254` in any encoding, hex or dotted)
  unwrapped and re-checked recursively.
- Credentials-in-URL rejected, scheme pinned to https, cert validation not
  bypassable (TLS errors are permanent-fail with no override).

**How to apply**: treat this file pair as the template for any FUTURE feature
that fetches an operator/user-supplied URL server-side (e.g. a future webhook-URL
field, an avatar-from-URL importer, etc.) - reuse `safeFetchFeed`/`validateFeedUrl`
rather than writing a new fetcher. Don't re-derive "is this vulnerable" from
scratch; it wasn't as of 2026-08-02, only verify no *new* fetch path bypasses it
(e.g. by using axios/`fetch()` directly instead of going through this module).
