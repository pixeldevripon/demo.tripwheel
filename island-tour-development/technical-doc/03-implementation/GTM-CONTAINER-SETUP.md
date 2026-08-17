# GTM container setup - the 4-tag booking_complete fan-out (A5)

> Companion to `technical-doc/02-architecture/TRACKING-AND-ANALYTICS.md`. The CODE side of A5 is
> complete: the TYP pushes ONE `booking_complete` dataLayer event (mark-first, server-guarded),
> the GTM loader + Consent Mode v2 regional defaults ship with the frontend, Cookiebot handles
> the banner, and the server CAPI fires in parallel deduped by `event_id`. What remains is
> CONFIGURATION inside your Google Tag Manager account - this guide is the exact recipe.

## 0. Prerequisites (ids to collect)

| Credential | Where it goes |
|---|---|
| GTM Web container ID (`GTM-XXXXXXX`) | Dashboard -> Settings -> SEO & Tracking |
| Cookiebot Domain Group ID (CBID) | Dashboard -> Settings -> SEO & Tracking |
| Meta Pixel ID | Dashboard -> Settings -> SEO & Tracking (`facebookPixelId`) |
| Meta CAPI access token (+ optional test code) | Dashboard -> Settings -> Integrations |
| GA4 Measurement ID (`G-XXXXXXX`) | GTM container (GA4 tag), below |
| Google Ads Conversion ID + Label | GTM container (Ads tag), below |

Production also needs `NEXT_PUBLIC_ENABLE_TRACKING=true` on the frontend deploy (the explicit
prod-only guard - staging builds must NOT set it).

## 1. The event the container receives

Fired once per confirmed booking on the Thank-You page:

```js
{
  event: 'booking_complete',
  event_id: '<publicRef>',        // SHARED with the server CAPI -> Meta dedup key
  booking_ref: 'IT-2026-00042',   // human display ref (cross-platform reporting)
  booking_value: 41.99,           // EUR COMMISSION - never GMV (master rule #22)
  booking_currency: 'EUR',
  tour_id: '<tourId>',
  tour_name: '<name>',
  operator_id: '<operatorId>',
  operator_name: '<company>',
  island: 'curacao',              // destination slug
  items: [{ item_id, item_name, item_brand, item_category, price, quantity: 1 }],
  user_id: '<sha256(email)>',     // GA4 cross-device key; OMITTED when no email
  click_ids: { gclid, fbclid },   // only the ids captured at landing; OMITTED when organic
  user_data: {                    // SHA-256 hashed SERVER-side (Enhanced Conversions)
    sha256_email_address, sha256_phone_number,
    sha256_first_name, sha256_last_name,
    address: { sha256_city, sha256_postal_code, sha256_country },
  },
}
```

## 2. Variables (Data Layer Variables, version 2)

Create: `dlv - event_id`, `dlv - booking_value`, `dlv - booking_currency`, `dlv - tour_id`,
`dlv - tour_name`, `dlv - items`, `dlv - user_data`.

## 3. Trigger

One Custom Event trigger: **`booking_complete`** (event name, exact match). All four tags use it.

## 4. The four tags (master 8.1 item 2 - no per-tour or per-campaign tags)

1. **Conversion Linker** - tag type "Conversion Linker", trigger All Pages (Initialization).
   Nothing to configure.
2. **Google Ads Conversion** - tag type "Google Ads Conversion Tracking".
   Conversion ID/Label from your Ads account; Value `{{dlv - booking_value}}`, Currency
   `{{dlv - booking_currency}}`, Transaction ID `{{dlv - event_id}}` (Ads-side dedup).
   Enable **Enhanced Conversions** -> "Data Layer" -> variable `{{dlv - user_data}}`
   (the fields are already SHA-256 hashed server-side; Google accepts pre-hashed values).
   Trigger: `booking_complete`.
3. **GA4 purchase** - tag type "Google Analytics: GA4 Event", event name `purchase`.
   Parameters: `transaction_id = {{dlv - event_id}}`, `value = {{dlv - booking_value}}`,
   `currency = {{dlv - booking_currency}}`, `items = {{dlv - items}}`.
   (Needs one "Google tag" (GA4 config) with your `G-XXXXXXX` on All Pages first.)
   Trigger: `booking_complete`.
4. **Meta Pixel** - Custom HTML tag (or the Meta template from the gallery):
   ```html
   <script>
     !function(f,b,e,v,n,t,s){...standard pixel bootstrap...}
     fbq('init', 'YOUR_PIXEL_ID');
     fbq('track', 'Purchase',
       { value: {{dlv - booking_value}}, currency: {{dlv - booking_currency}},
         content_ids: [{{dlv - tour_id}}], content_type: 'product' },
       { eventID: {{dlv - event_id}} });   // <- REQUIRED: dedupes against the server CAPI
   </script>
   ```
   The `eventID` third argument is the whole dedup contract - the server CAPI sends the same
   `publicRef`; without it every booking double-counts in Meta. Trigger: `booking_complete`.

## 5. Consent (already emitted by the app - configure the container to respect it)

The frontend sets Consent Mode v2 defaults BEFORE gtm.js loads: **EEA (EU27+IS/LI/NO) + UK
denied on all four signals; everywhere else granted** (`wait_for_update: 500`,
`ads_data_redaction` on). Cookiebot pushes the visitor's choice as consent updates.
In GTM: Admin -> Container Settings -> **Enable consent overview**, then verify each tag's
built-in consent checks (Ads tags require `ad_storage`; GA4 requires `analytics_storage`).
No "Additional consent" entries are needed.

## 6. Verify (master §4 acceptance)

- **GTM Preview**: one `booking_complete` per test booking; all four tags fire once.
- **GA4 DebugView**: exactly ONE `purchase` per booking (refresh the TYP - no second event;
  the server mark-first guard returns null after the first claim).
- **Meta Events Manager**: ONE deduplicated `Purchase` (browser + server rows merged by
  `event_id`). Use the Integrations test code first, then CLEAR it.
- **Enhanced Conversions diagnostic** (Ads, after ~48h): match rate above 60%.
- EEA check: with a EU VPN + no consent given, tags hold (consent default denied) and Ads
  click ids are redacted; after accepting the Cookiebot banner, tags fire.
