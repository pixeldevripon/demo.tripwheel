# 07 - Trip Creation Journey: Wizard Redesign Spec

> **Scope: presentation layer only.** No API call, mutation, payload key, validation rule,
> permission, or database field changes. Every hook in `hooks/trips/use-trips.ts` is called with
> the exact same arguments it is called with today. This document reorganises *where* fields are
> rendered and *how* the operator walks through them.
>
> **No new fields.** Every input in this spec already exists in the current forms. Where the
> original brief named a field we do not have (Country, City, Taxes, Discounts, End Time,
> Drop-off, FAQs), it is called out in §2.3 with the closest real field or an explicit "does not
> exist".
>
> Supersedes the tab layout described in `04-UX-STRATEGY-SPEC.md` §2.2 B for the create/edit
> journey. The readiness contract (§2.2 C) is preserved verbatim.

---

## 1. The constraint that shapes everything

The trip module is **not** one form with one submit. It is:

| Layer | Endpoint shape | Consequence |
|---|---|---|
| Trip core | `POST /tours` then `PATCH /tours/:id` | ~40 fields, two mutations |
| Age bands, add-ons, images, highlights, inclusions, exclusions, features, locations, pickups, languages, schedules, exceptions | `POST/PATCH/DELETE /tours/:id/<child>` | **each needs the trip to already exist** |
| Translations | `PUT /tours/:id/translations/:locale` | needs the trip to exist |

So a classic "fill 8 steps, submit at the end" wizard is impossible without rewriting the API.
It is also unnecessary. The correct model is:

> **Step 1 creates the draft. Steps 2-9 edit it.**

This is what the code already does (`TripCreateForm` -> `router.push('/trips/:id/edit')`). The
redesign keeps that boundary and hides it: the operator sees one continuous journey, while under
the hood step 1 fires `useCreateTrip` and every later step fires the same mutation its current
tab fires.

Three things fall out of this for free, with zero new code paths:

1. **Autosave / draft resume is inherent.** Each step commits on Continue. Close the laptop at
   step 5, come back, the trip is a DRAFT sitting at step 5.
2. **No "lost work" class of bug.** There is never a giant in-memory payload to drop.
3. **Edit mode and create mode are the same screens.** See §6.

---

## 2. Deliverable 1 + 2: the redesigned step flow, and why each step exists

### 2.1 The nine steps

| # | Step | Why it exists | Blocking? |
|---|---|---|---|
| 1 | **Basics** | Creates the draft. The four answers the backend needs to mint a row and a slug-registry entry. | Yes (create payload) |
| 2 | **Pricing** | Money is the decision an operator has already made before they open the form. Asking it early feels fast. | Yes, only for UNIT tours |
| 3 | **Capacity & booking rules** | Sets `maxPartySize`, which the schedule step *depends on*. Must come before Schedule. | No |
| 4 | **Schedule & availability** | When it runs. Consumes `maxPartySize` from step 3. | No |
| 5 | **Location & route** | Where it starts, where it goes, who gets picked up. The only two places coordinates are entered. | No |
| 6 | **Media** | Carries 2 of the 5 publish gates (5 images, 1 hero). Isolated so the gate is unmissable. | No |
| 7 | **Description & content** | Carries 2 more publish gates (English overview, 3 highlights). All narrative in one place. | No |
| 8 | **Discovery & reach** *(optional)* | Hubs, attributes, SEO, commission tier, spotlight. Nothing here blocks publishing. | No, skippable |
| 9 | **Review & publish** | The readiness contract, the summary, the lifecycle action. | Terminal |

### 2.2 The two changes I am making to the proposed order, and why

**a) Capacity moves *before* Schedule.**

The proposed order was Schedule (3) then Capacity (4). The code has a hard dependency the other
way round: `TripSchedulesTab` reads `maxPartySize`, and when it is null every schedule row *must*
carry a `capacityOverride` or the availability engine materialises zero departures and the tour
silently never lists. Today that surfaces as a yellow warning banner on the Schedules tab -
a warning that only exists because the operator was asked in the wrong order.

Swapping the two removes the banner's reason to exist. The schedule step can then say
"capacity: 12 per departure (from step 3)" as a quiet fact, with an override field for
exceptions.

**b) Itinerary lives in Location (step 5), not Trip Details (step 7).**

The brief put Itinerary with Includes/Excludes/FAQs. But `TourLocation` rows carry
`latitude`, `longitude`, `streetAddress`, `locality`, `region`, `postalCode`, `country`,
`travelMinutes`, `minutesAtStop` - they are geography with a caption, not prose. Putting them
next to the meeting point means the operator enters coordinates once, in one mental mode, with
one map affordance. Step 7 then stays purely narrative, which makes it a much calmer screen.

Trade-off: the stop *title* and *short description* are English content, so a sliver of copywriting
lands in step 5. That is the lesser evil.

### 2.3 Fields in the brief that do not exist

| Brief field | Reality |
|---|---|
| Country, City (step 1) | Not tour-level. A tour belongs to a **Destination** (the island). `departureCity` exists on the trip (step 5). `locality`/`region`/`country` exist **per itinerary stop** only. |
| Short description (step 1) | Exists, but as a **translation** field (`shortDescription`), so it lives in step 7 with the other copy. Putting one translation field in step 1 would split the translation upsert across two steps. |
| Trip type (step 1) | Closest is `bookingType` (Private / Shared) - a booking rule, so step 3. Category is the real taxonomy and stays in step 1. |
| Discount (step 2) | No discount engine. The only "was" price is `priceOriginal` per age band, rendered struck through. |
| Taxes (step 2) | Does not exist. Prices are gross. Commission is a platform tier (step 8), not a tax. |
| End time (step 3) | Does not exist. Duration is `durationMinutesFrom` / `durationMinutesTo`. |
| Drop-off (step 5) | Does not exist. Pickup locations only. |
| **FAQs (step 7)** | **Deliberately absent platform-wide.** Tours answer those questions with structured fields (`whatToBring`, `knowBeforeYouGo`, `notSuitableFor`, features/Info & Terms). Not adding them. |
| Rich text editor (step 7) | Tour copy is plain text / newline-delimited lists in the API. A rich text editor would change the payload. Keeping auto-growing textareas. |
| Google Maps picker (step 5) | Optional additive UI - see §5.4. Writes the same `latitude`/`longitude` numbers. Zero payload change, but it is the one item here that needs a new dependency, so it is flagged as phase 2. |

---

## 3. Deliverable 3 + 4: field grouping per step, and what is advanced

Legend: **[R]** required by an existing schema · *(adv)* inside a collapsed "Advanced" card ·
`conditional` renders only when a sibling value calls for it.

### Step 1 - Basics
> "Let's name your tour." Single card, no collapsibles. Fires `useCreateTrip`.

- Name **[R]**, Slug (auto from name, stops auto-generating once touched)
- Destination **[R]** - locked forever after this step, said out loud on the field
- Categories **[R]** multi-select, starred item = primary

That is the entire create payload. Nothing else is asked, because nothing else is accepted.

### Step 2 - Pricing
Cards: **How you charge** (open) · **Age bands** · **Add-ons**

- How you charge: `pricingModel`, `defaultCurrency` (switch is confirm-gated, prices are not
  converted - keep the existing AlertDialog verbatim), `basePrice`
  - `conditional` UNIT: `wholeUnitType` **[R for UNIT]**
  - `conditional` UNIT + GROUP: `unitIncludedGuests`, `extraPersonPrice`
- Age bands (`conditional`: PER_PERSON only): band type, participation, label, min/max age,
  price, *(adv)* original price, *(adv)* net price, default flag
- Add-ons: name, price, description, unit, max quantity

*Advanced:* `priceOriginal` and `priceNet` move behind a "More price options" disclosure inside
the band row. They are optional, internal-or-promotional, and today they double the height of
every band form.

### Step 3 - Capacity & booking rules
Cards: **Group size** (open) · **Booking window** · **Payment** · **Who it suits**

- Group size: `minPartySize`, `maxPartySize`, `bookingType`, `instantConfirmation`
- Booking window: `bookingCutoffMinutes`, `checkInMinutesBefore`, `cancellationHours`
  (disabled with the existing explanation once the tour leaves DRAFT and the user is not ADMIN)
- Payment: `paymentModel`, `conditional` ON_ARRIVAL: `onArrivalPayment`
- Who it suits: `minAgeYears`, `fitnessLevel`, `weatherDependent`, `wheelchairAccessible`,
  `familyFriendly`, `suitableForBeginners`

`maxPartySize` gets an inline consequence line: *"Used as the default seat count for every
departure. Leave empty and each schedule will need its own capacity."*

### Step 4 - Schedule & availability
Cards: **Duration** (open) · **Departure times** · **Weekly pattern** · **Calendar & exceptions**

- Duration: `durationMinutesFrom`, `durationMinutesTo` (keeps the live "shows on cards as Full
  day" hint)
- Departure times: the declared `startTimes` set
- Weekly pattern: weekday chips x start-time chips, `capacityOverride`, *(adv)* `validFrom`,
  `validUntil`
- Calendar & exceptions: **the existing month grid, unchanged in behaviour** - same
  `useManageCalendar(tripId, month)` query, same one-tap CLOSE_DATE / CLOSE_SLOT / OPEN
  exception writes, same island-timezone "today", same popover listing every exception on a day.
  Restyled only: see §5.5.

### Step 5 - Location & route
Cards: **Meeting point** (open) · **Itinerary** · **Pickup**

- Meeting point: `departureCity`, `meetingPointLat`, `meetingPointLng`, `meetingPointText`
  (translation field, English)
- Itinerary: ordered stop list - types, title, short description, lat/lng, *(adv)* street
  address, locality, region, postal code, country, travel minutes, minutes at stop
- Pickup: `pickupModel`, `pickupRequired`, and `conditional` on model != NONE the pickup
  location list (name, directions, address, price per person, lat/lng, minutes prior, window
  start/end)

The pickup card *disappears entirely* when `pickupModel` is NONE - preserving today's behaviour
of hiding the Pickups tab, but now as a layout animation inside the step rather than a tab
vanishing from a rail.

### Step 6 - Media
Single card, no collapsibles. Images via the media library selector (unchanged), hero star,
reorder, alt text + focal point in the edit dialog.

The two publish gates render as a live counter at the top of the step:
`Images 3 / 5` and `Hero image - not set`. Not a warning box. A progress meter.

### Step 7 - Description & content
Cards: **Overview & description** (open) · **Highlights** · **What's included** ·
**What's not included** · **Good to know** · **Info & terms** · **Guide languages**

- Overview & description: `title`, `overview` **(publish gate)**, `description`,
  `shortDescription`, `whatToExpectIntro`
- Highlights: the ordered list **(publish gate: 3)**
- Included / Not included: inclusions (label, icon) and exclusions (label, icon, handling,
  price text) - split into two cards, they are two different mental acts
- Good to know: `whatToBring`, `knowBeforeYouGo`, `notSuitableFor`, `localTipTitle`,
  `localTipBody`, `operatorNote`
- Info & terms: the features list (type + text)
- Guide languages: the badge strip + add control

*(adv)* `categoryDisplay`, `h1Override`, `breadcrumbLabel`, `reference`, and the whole
**OCTO & delivery** block (`availabilityType`, `redemptionMethod`, `instantDelivery`,
`availabilityRequired`, `allowFreesale`, `deliveryFormats`, `deliveryMethods`, read-only
`timeZone`) collapse into a single "Advanced & integrations" card at the bottom of step 7 -
exactly the treatment they already have today, just relocated out of the first screen an
operator ever sees.

### Step 8 - Discovery & reach *(optional)*
Cards: **Activity hubs** · **Attributes** · **Search appearance** · **Promotion**

- Hubs multi-select; category-driven attributes (dynamic, unchanged); `metaTitle`,
  `metaDescription`, OG image; commission tier + spotlight request + admin demand-badge override
  (all permission-gated exactly as today)

Header says it plainly: *"Optional. You can publish without any of this and come back later."*
The footer's primary action reads **Skip for now**, secondary **Save and continue**.

### Step 9 - Review & publish
No inputs. See §8.

---

## 4. Deliverable 5: friction reducers

1. **Per-step commit, never a global submit.** Continue = save this step + advance. The word
   "Save" disappears from the journey; saving becomes a side effect of moving forward.
2. **Skip does not mean lose.** Every non-blocking step has a text "Skip" affordance in the
   footer. Skipping still saves whatever was typed.
3. **The step rail is a map, not a menu.** Numbered steps across the top with state
   (done / current / incomplete / skipped). Clicking a *visited* step jumps to it. Clicking an
   unvisited step is disabled during create, enabled during edit (§6).
4. **Consequence text, not help text.** Replace "How long before departure bookings close" with
   "Bookings close 2 hours before each departure." Computed from the live value. Every number
   field that drives visible behaviour gets one.
5. **Smart defaults that already exist stay invisible.** `minPartySize=1`,
   `cancellationHours=48`, `paymentModel`, the OCTO booleans - all backend defaults today. The
   wizard shows them pre-filled and never asks the operator to confirm a default.
6. **One question per row on mobile, two per row from `sm`.** The current 3-column meeting-point
   grid becomes 1 / 3 responsive.
7. **Cross-step consequences are stated where they are caused**, not where they bite. Step 3's
   `maxPartySize` explains what step 4 will do with it. This is the single highest-value change
   in the whole redesign.
8. **Unsaved-changes guard on Back and on route leave.** `useUnsavedGuard` already exists; it is
   currently wired only to the details form. Extend the same hook to the wizard shell.
9. **Keyboard.** `Cmd/Ctrl + Enter` = Continue. `Esc` closes any open dialog. Arrow-key
   navigation across the step rail. Every collapsible card header is a real focus target already.
10. **Deep links survive.** `?tab=pricing` etc. keep working via a `TAB_TO_STEP` map (§7).

---

## 5. Deliverable 6 + 7: layout, states, and per-step anatomy

### 5.1 Shell layout

```
┌──────────────────────────────────────────────────────────────┐
│  Breadcrumb                                        [ status ] │
│  Sunset Catamaran Cruise                                      │
│                                                               │
│  ①──②──③──④──⑤──⑥──⑦──⑧──⑨      progress rail (sticky)      │
│  ▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░  Step 4 of 9 · 45%                  │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│   Schedule & availability            ← 28px/600, tight        │
│   When does this tour run?           ← 14px, content-muted    │
│                                                               │
│   ┌ Duration ──────────────────────────────────── ▲ ┐        │
│   │  [ fields ]                                       │        │
│   └───────────────────────────────────────────────────┘        │
│   ┌ Departure times ─────────────────────────────── ▼ ┐        │
│   ┌ Weekly pattern ──────────────────────────────── ▼ ┐        │
│   ┌ Calendar & exceptions ───────────────────────── ▼ ┐        │
│                                                               │
├──────────────────────────────────────────────────────────────┤
│  ← Back              Skip           Save and continue →       │ sticky footer
└──────────────────────────────────────────────────────────────┘
```

- Content column: `max-w-4xl` (896px) centred, which lands inside the requested 900-1000px.
  Step 4's calendar and step 6's image grid opt into `max-w-5xl` via a per-step `wide` flag.
- Vertical rhythm: 32px between cards, 24px between fields inside a card, 8px label-to-input.
- The step title block is the only place a large type size appears. Card titles stay 16px/600.

### 5.2 Progress rail

Numbered pills, connected by a 2px line. States:

| State | Treatment |
|---|---|
| Done | `bg-primary` filled, white check |
| Current | `ring-2 ring-primary`, `bg-primary-subtle`, number in `primary` |
| Incomplete (visited, skipped) | `border-line`, `text-content-subtle`, hollow |
| Locked (unvisited, create mode) | 40% opacity, `cursor-not-allowed`, `aria-disabled` |
| Has error | `border-danger-border`, `text-danger-fg`, small dot |

Below it, a `<Progress>` bar (the component exists) animating `width` on step change, plus
`Step 4 of 9`. On viewports under `md` the pills collapse to `● ● ● ◉ ○ ○ ○ ○ ○` dots with the
label underneath, so the rail never wraps to two lines.

### 5.3 Collapsible cards inside a step

Reuses `components/common/collapsible-card.tsx` as-is. It already: keeps content mounted,
animates height, respects `useReducedMotion`, marks closed content `inert`, and avoids the
nested-button bug. Do not fork it.

Rules per the brief:
- First card `defaultOpen`.
- A card containing a validation error force-opens. Implementation: lift `open` into the wizard
  step's state (`Record<cardId, boolean>`), pass `open` / `onOpenChange` as optional controlled
  props added to `CollapsibleCard` (additive, existing uncontrolled callers unaffected).
- Open/closed state persists per step in the wizard store for the session, so Back then Continue
  returns you to the same shape.
- Each header carries a right-aligned summary chip when collapsed: `3 add-ons`,
  `Mon, Wed, Fri · 2 times`, `5 images`. Collapsed must never mean invisible.

### 5.4 Validation states

**The wizard never invents a requirement.** Continue is blocked only by rules that already exist
in that step's zod schema today:

| Step | Blocking rule (existing) |
|---|---|
| 1 | `name` >= 3, `slug` pattern, `destinationId`, >= 1 category |
| 2 | UNIT tours: `basePrice` present, `wholeUnitType` selected (existing `superRefine`) |
| 3-8 | none - the backend accepts every field as optional |
| 9 | the 5 publish checks, unchanged |

Everything not blocking is surfaced as **incomplete**, never as an error: a neutral chip on the
step pill and a line in the Review summary. This is the difference between a wizard that guides
and a wizard that nags, and it is also what keeps us honest about "no validation changes".

Error presentation:
- Inline, under the field, `text-danger-fg`, 12px, fading in with a 4px rise over 150ms.
- On a blocked Continue: force-open the offending card, scroll the first invalid field into view
  with `block: 'center'`, focus it, and shake the footer's primary button once
  (`x: [0, -4, 4, -3, 3, 0]`, 300ms) - not the whole form.
- Server errors (409 slug collision, etc.) keep their current copy and land in the same inline
  slot as client errors, plus the existing toast.

### 5.5 Loading and async states

| Situation | Treatment |
|---|---|
| Trip detail loading (edit entry) | Full-step skeleton: title bar, 3 card headers, 6 field rows. Not a spinner. |
| Child list loading (bands, images, schedules) | Skeleton rows matching the real row height, inside an already-rendered card. |
| Async selects (categories, hubs, attributes) | Field renders disabled with a shimmer inside the trigger. Never an empty dropdown. |
| Saving a step | Footer button -> spinner + "Saving...", footer stays interactive for Back. Step content does not dim. |
| Media upload | Per-item determinate bar over the thumbnail; the tile is present from byte zero at 40% opacity, animating to 100% on completion. |
| Calendar month change | Existing `placeholderData: prev` keeps the old grid on screen; overlay a 60% veil, never a skeleton flash. |
| Step commit succeeded | Step pill fills with a spring-popped check; the toast that fires today still fires. |

### 5.6 Empty states

Every repeatable list (bands, add-ons, images, highlights, inclusions, exclusions, stops,
pickups, features) gets the same three-part empty state: a muted icon tile, one sentence saying
what the list does for a traveller, and the add control. Today several of them render a bare
"No X defined yet." centred paragraph.

---

## 6. Deliverable 9: how the operator moves through it

### Create mode - `/trips/new`
Linear. Step 1 is the only screen until the draft exists. Forward-only into unvisited steps;
freely backward. Continue on step 1 fires `useCreateTrip` and then `router.replace`s to
`/trips/{id}/edit?step=pricing` - so a refresh at step 2 lands on the real draft, and the
browser Back button behaves.

### Edit mode - `/trips/:id/edit`
**Step 9 (Review) is the landing screen**, not step 1. An operator editing a live tour wants to
change one thing; the summary hub gets them one click from any of it. Every summary card has an
Edit control that deep-links to its step; the step rail is fully unlocked; the footer's primary
action becomes "Done" (returns to Review) instead of "Continue".

Same components, same state machine, one flag. This is what lets us delete the tab rail
without making editing worse - it is the reason the wizard can be the only navigation.

### Route contract
- `?step=<id>` is the single source of truth, mirrored with `router.replace(..., {scroll:false})`.
- `TAB_TO_STEP` maps every legacy `?tab=` value onto its new step, so readiness chips, row
  actions, bookmarks, and the `e2e` specs that navigate to `?tab=attributes` /
  `?tab=exclusions` keep resolving. The existing `TAB_TO_GROUP` map is the template.
- Visited steps stay mounted and hidden, exactly like the current editor does with sections. It
  is why switching is instant today and it must not regress.

---

## 7. Deliverable 10: proof that business logic is untouched

| Concern | Guarantee |
|---|---|
| API calls | Only via existing `hooks/trips/use-trips.ts` exports. No new hook, no changed argument shape. |
| Payloads | Each step's `onSubmit` builds the identical object its current tab builds. The per-tab `useForm` + zod resolver moves file, not content. |
| Validation | Schemas are lifted verbatim into `lib/trips/wizard-steps.ts`. Diffable, line for line. |
| Publish gate | `getPublishChecks` / `getListingChecks` unchanged; `ReadinessRail`'s logic is re-skinned into the Review step, keeping the "Publish Readiness" heading string (e2e text contract). |
| Permissions | `useRole().can(...)` guards move with the fields they guard. Step 8 is hidden, not disabled, when the operator holds none of its permissions. |
| Lifecycle | Submit / approve / reject / publish / pause / unpause / archive keep their current handlers and toast strings. |
| Cancellation lock | `trip.status !== 'DRAFT' && role !== 'ADMIN'` stays exactly where it is. |
| Currency | Every money label keeps `({currency})` from `trip.defaultCurrency`; `formatPriceFrom` for display. No literal symbol anywhere. |
| Timezone | `trip.timeZone` stays read-only and destination-derived. |
| e2e | `?tab=` redirects preserved. Two specs assert `/trips/new` copy ("Create Trip" button, "Name must be at least 3 characters") - those strings move to step 1's footer/field and stay identical. |

---

## 8. Step 9 in detail: Review & publish

```
   Ready to publish                                    ✓ 5 of 5
   Everything required is in place.

   ┌ Basics ─────────────────────────── Edit ┐  ┌ Pricing ──────── Edit ┐
   │ Sunset Catamaran Cruise                 │  │ Per person · EUR      │
   │ Curacao · Boat Tours, Snorkelling       │  │ From 79.00 · 3 bands  │
   └─────────────────────────────────────────┘  └───────────────────────┘
   ┌ Capacity & rules ──── Edit ┐  ┌ Schedule ─────────────────── Edit ┐
   │ 1-12 guests · Shared       │  │ Mon Wed Fri · 09:00, 14:00        │
   │ Free cancel 48h            │  │ Next 30 days: 26 departures       │
   └────────────────────────────┘  └───────────────────────────────────┘
   … Location · Media · Content · Reach

   To appear in listings
   ✓ Bookable departures in the next 30 days   ✓ Capacity set

                                   [ Submit for review ]   ← role-aware
```

- Summary cards are read-only projections of data already in the query cache. No new fetch.
- Unmet publish checks render as an amber card at the top listing exactly the unmet ones, each a
  button that jumps to the owning step. Same `check.tab` value, mapped through `TAB_TO_STEP`.
- Listing checks render separately under "To appear in listings" and never block the CTA -
  preserving today's warn-don't-block rule.
- CTA by role/state, unchanged from `ReadinessRail`: operator on a ready draft -> "Submit for
  review"; rejected -> "Resubmit for review" with the admin's note shown above; admin ->
  "Approve" / "Request changes" / "Publish"; live -> "Pause" / "Archive".
- On publish success: a spring-popped check, the heading swaps to "This tour is live", and a
  "View on site" link appears. 500ms total, no confetti, no modal.

---

## 9. Deliverable 8: motion

All values from `lib/motion.ts`. Nothing new is declared. Every one of these is wrapped in
`useReducedMotion` -> duration 0.

| Interaction | Spec |
|---|---|
| Step change | `AnimatePresence mode='wait'`, key = step id. Exit `opacity 0, x -12` 150ms; enter `opacity 0->1, x 12->0` with `dashboardPageEnter` (320ms). Direction flips on Back. |
| Progress bar | `width` animated with `crossFade` (200ms). Never a jump. |
| Step pill completion | Check icon `scale 0 -> 1` with `springPop`, inside `AnimatePresence`. |
| Card expand/collapse | Already correct in `CollapsibleCard`: height 400ms `[0.4,0,0.2,1]`, opacity 220ms. Do not touch. |
| Conditional fields appearing (unit pricing, on-arrival payment, pickup list) | Wrap the group in `motion.div` with `layout` + `crossFade`, `height: 0 -> auto`. |
| Field error | `opacity 0->1, y -4 -> 0`, 150ms. |
| Blocked Continue | Button shake `x: [0,-4,4,-3,3,0]`, 300ms, once. |
| Button press | `whileTap` scale 0.98 with `springPop`. **No `whileHover` scale** - hover is colour/opacity only (house rule). |
| Image upload | Tile mounts at `opacity 0.4, scale 0.96`, settles to 1 with `springPop` on completion; determinate bar animates width. |
| Sticky footer | `box-shadow` fades in over 150ms once the content column scrolls past 8px. |
| Skeleton -> content | `contentSettle` (220ms, fade only, no y travel - the skeleton already holds the layout). |
| List row add/remove | `layout` on the list + `springPop` scale-in for the new row; removal fades out over 150ms then collapses. |

Guardrails: nothing over 400ms; no motion on anything that blocks input; no `layout` animation
on the image grid or the calendar grid (too many nodes - use opacity only there).

---

## 10. Responsive

| Breakpoint | Behaviour |
|---|---|
| < 640 | Single column. Progress rail -> dots + label. Footer `fixed bottom-0` with `env(safe-area-inset-bottom)`, full-width primary. Card padding 16px. Touch targets >= 44px. |
| 640 - 1024 | Two-column field grids. Rail shows numbers, hides labels. Footer sticky, not fixed. |
| 1024 - 1440 | Full rail with labels. Content `max-w-4xl` centred. |
| > 1440 | Unchanged - the column stays 896px, the gutter grows. Verify at 1600x900. |

The calendar grid keeps its own `overflow-x-auto` container so it can never push the page wide.

---

## 10b. EXECUTED - what shipped, and where the build corrected the spec

Steps 1-9 are built, routed, typechecking, linting and building clean. Six decisions changed
during implementation; each is recorded here because each one contradicts something above.

1. **Mode is derived from `firstPublishedAt`, not from the route.** Creating a tour spans
   `/trips/new` *and* `/trips/:id/edit` (step 1 mints the draft and redirects), so a
   route-derived mode flipped personality mid-creation. A never-published `DRAFT` walks
   forward; anything published before gets the review hub.

2. **A step may register more than one commit.** §5.1 assumed one form per step. The content
   step owns two independent writers (the English copy upsert and the advanced trip PATCH), so
   `registerCommit` is keyed and the footer runs every form on the active step in mount order,
   stopping at the first refusal. Standing rule: **at most one trip-core PATCH per step**,
   because two forms both spreading `tripToUpdatePayload` would race on stale values.

3. **`meetingPointText` stays in step 7, not step 5.** §3 put it with the meeting point. It is a
   translation field, and the tour translation upsert writes every field it knows about - a
   second writer on that record would clobber the first. Grouping in step 7 is presentation
   only: four collapsible groups, one form, one save (`lib/trips/tour-copy.ts`).

4. **`isActive` lives in the step 7 advanced card**, where the old form had it, rather than
   moving to Review. It is an advanced visibility switch, not a lifecycle action.

5. **`TAB_TO_SECTION` was added.** A legacy `?tab=` value used to name a whole screen; most are
   now a *section* inside a step. Resolving only the step left deep links (readiness chips, row
   actions, bookmarks) landing on a page with the thing to fix folded away. The map opens the
   right section on arrival.

6. **Sections carry `data-wizard-section`.** Consolidating six tabs into one step means two
   sections can hold a field with the same `name` - the content step has an `input[name="label"]`
   in both Inclusions and Exclusions. Anything targeting a field must scope by section, and the
   e2e specs now do.

7. **The map picker shipped** (§2.3 had it flagged as phase 2). `components/common/map-picker-field.tsx`
   binds a Leaflet map to the two coordinate inputs wherever they appear: the meeting
   point, and the itinerary route. (It shipped bound to pickup zones too; item 8 removed that
   when their coordinates turned out to have no reader.) Binding is two-way
   and string-based, because that is what the forms hold - typing moves the pin, dragging the pin
   rewrites the inputs, and an unparseable or out-of-range value shows no pin rather than
   confidently landing in the Atlantic. It writes the same `latitude` / `longitude` numbers, so
   nothing about the payload changed.

   Four implementation notes that are not obvious:
   - Leaflet touches `window` at module scope, so the map is loaded through `next/dynamic` with
     `ssr: false`. It lands in its own 152KB chunk that only downloads when the location step
     opens - it is not in the app entry.
   - The default marker is a bundled PNG whose path breaks under every bundler. Rather than
     patching `L.Icon.Default`, the marker is a `divIcon` with plain markup, so there is no image
     asset to resolve at all.
   - A map created inside a collapsed or animating container renders grey tiles until told to
     re-measure. `ResizeObserver` -> `invalidateSize`, coalesced through `requestAnimationFrame`
     because a height animation fires it every frame.
   - Maps open on the tour's **destination** coordinates (`Destination.latitude/longitude`) when
     no pin exists yet, so an operator on Curacao does not start over open water. One shared
     `useDestination` fetch serves every picker on the step.
   - The map wrapper carries `isolate`. Leaflet stacks panes at z-index 400 and controls at 800,
     and the view toggle sits at 1000. `relative` alone leaves the wrapper at `z-index: auto`,
     which opens no stacking context - so those numbers competed in the ROOT context and beat
     every overlay in the app, which top out at `z-50`. The symptom was both maps painting
     through the backdrop *and over the dialog itself* when leaving the step with unsaved
     changes. `isolation: isolate` contains them. `map-picker.tsx` is the only Leaflet renderer
     in the dashboard, so the one class covers every map.

   No geocoding search: that would mean a second external service and Nominatim's usage policy,
   for a field an operator fills once per tour. OSM attribution renders per their tile policy.

8. **The stop address block and the pickup pin were retired** (2026-07-29), after tracing every
   reader of `TourLocation` and `PickupLocation` through the public site, the booking widget, the
   confirmation email and the JSON-LD.

   *Itinerary stop* - `streetAddress`, `addressLocality`, `addressRegion`, `postalCode`,
   `addressCountry`, `minutesTo`, `minutesAt` are no longer asked. Nothing renders them. Their
   sole consumer is `octo/serializers/octo-tour.serializer.ts`, and OCTO is pipeline, so seven
   inputs per stop were a data-entry tax for a channel with no partners. (`streetAddress` also
   backs a fallback at `bookings.service.ts:1727` - the email meeting label when the START stop
   has no title - but the form requires a title, so the fallback cannot fire.) A stop now asks
   for types, title, description, coordinates and order. The `TouristTrip` JSON-LD was checked
   too: its `itinerary` key is the destination name, never the stops.

   *Pickup zone* - `latitude` / `longitude` and their map are gone. No surface reads a zone's
   coordinates: the tour page prints title, window and directions as text, and the confirmation
   email's map link is built from the snapshotted address string
   (`mapsUrl(null, null, booking.pickupAddress)`). `address` and `minutesPrior` moved **up**
   instead - both reach the traveller (the pickup line and its map link; "be ready N minutes
   before", and the pickup time itself when no window is set) and both sat below the coordinates.

   **Nothing is deleted or nulled.** The columns stay, both update endpoints key off
   `'field' in dto`, and the forms now omit those keys rather than sending `null` - so values
   entered before today survive untouched, and re-adding the block when OCTO goes live is a UI
   change only.

   The zone list also now says that the tour page previews only `pickupLocations[0]`; the rest
   appear in the checkout dropdown. Without it, an operator who adds five zones and checks their
   live page concludes four failed to save.

   *Why dropping the zone pin cannot break "open in maps":* it never used one. `Booking` has no
   pickup latitude/longitude column, so there is nothing to snapshot a pin into, and both link
   builders pass coordinates as literal null - `mapsUrl(null, null, booking.pickupAddress)` in
   `booking-email.context.ts:347`, and `pickupMapQuery: typ.pickupAddress` in
   `lib/thank-you/thank-you.ts:357`. Both are address-string searches. (The *meeting point* link
   is the one that uses coordinates, and its pin stayed.)

   That makes the zone address load-bearing in a way the old form never said. The snapshot is
   `pickup.address ?? pickup.name` (`bookings.service.ts:4297`), so a blank address silently
   promotes the zone NAME to the map query - harmless for "Marriott Beach Resort", useless for
   "Zone A" or an operator who typed a person's name. The field description now says exactly
   that. Not made required: that would be a validation change, and some zones legitimately have
   no street address.

9. **The itinerary edit form gained Title and Short Description** (2026-07-29). They live on the
   stop's `en` `TourLocationTranslation` row rather than the base record, and only the *add*
   form ever wrote them - so a stop created with a typo in its title could not be corrected on
   this screen at all, and the field that decides whether a stop appears at ALL (the tour page
   filters out any stop without a title) was write-once. Same contract as the pickup editor's
   Directions field: read from the `en` row, written back to it, and only when it actually
   changed, so saving a coordinate does not churn the translation row or whatever the AI
   translation job derived from it.

10. **The photos step was rebuilt around the two decisions it actually makes** (2026-07-29). The
    old screen was one uniform grid, six hover-only buttons per tile, a row of scolding badges,
    and a focal point typed as two numbers between 0 and 1. It treated the cover and the gallery
    order as the same thing. The backend never has:

    - `isHero` picks the ONE image used on the listing card, in search results and on social
      shares. A flag, not a position.
    - `displayOrder` is the swipe sequence on the tour page. The public query is
      `orderBy: { displayOrder: 'asc' }` over ALL images, hero included - the cover is **not**
      implicitly first.

    So the step is now two regions. A **cover panel** (21:9, focal-point-cropped, with its own
    alt-text warning) and a **gallery** grid showing the real sequence, drag to reorder, with an
    inline "Add photos" tile instead of a top-right button. Position number and Cover chip are
    always visible - they are what the grid is FOR, and hiding them behind hover made it say
    nothing at rest.

    Drag is not the only path: every tile keeps move-earlier/move-later buttons, because drag is
    a mouse gesture with no keyboard equivalent. Both call the same code. The arrows are now
    left/right, not up/down - in a wrapping grid "up" meant "one place earlier", which is usually
    left.

    **Focal point is now a pointer target.** Click or drag a ring on the image, with live crop
    previews in the two shapes the public site actually uses (listing card, thumbnail). It writes
    the same two floats; what it adds is the answer the number inputs could not give - what 0.3 /
    0.7 looks like once cropped.

    Payloads unchanged. Cover still PATCHes `{ isHero: true }`; a drag PATCHes `{ displayOrder }`
    on the rows that actually shifted. There is no bulk-reorder endpoint, so a move normalises to
    0..n-1 and skips every row already on its number - a one-place drag costs the same two writes
    the old arrows cost. An optimistic `draftOrder` holds the sequence while those PATCHes land,
    so tiles move under the cursor instead of snapping as each response arrives.

    Two things removed as duplicates: the `count/24`, "Need at least 5 to publish" and "No hero
    image set" badges (the step header already carries a live meter and a hero chip - §3 says the
    meter exists so the operator is not told off for a step they just started), and the `bare`
    prop with its Card branch, which no caller ever used.

    The drag source id is held in React state, not read back from `dataTransfer`: browsers
    deliberately blank that during `dragenter`, which is the exact moment the drop target needs it.

11. **The description step stopped hiding a data type behind a caption** (2026-07-29).
    `whatToBring`, `knowBeforeYouGo` and `notSuitableFor` are `kind: 'lines'` - stored as string
    ARRAYS. The form held each as one newline-joined blob in a textarea, and the only clue was
    "One item per line." underneath. An operator who typed a normal paragraph got one enormous
    bullet on their live page and no feedback explaining why.

    They are now real list editors: a row per item, Enter adds the next row, Backspace on an empty
    row removes it, and a remove button per row. Presentation only - the value handed back is
    still newline-joined and `buildTourCopyPayload` still splits and filters it, so the request
    body is byte-identical to what the textarea produced. The ONE-form-ONE-save constraint holds:
    the list writes through `setValue(..., { shouldDirty: true })` into the same
    `react-hook-form` instance, so the footer's dirty tracking is unaffected.

    Two smaller things in the same pass:
    - **`TOUR_COPY_HINTS`** - a per-field line, on the SIX fields whose label does not already
      answer the question. The bar is deliberately high: a hint under every field is the same as
      no hints at all, because the operator learns the grey line never says anything and stops
      reading it, including on the two where it matters ("Short description" is never shown on
      the page; "Note to travellers" goes to an email, not the page). A field earns one only when
      it is surprising or has a fallback that stays invisible until you hit it. Kept in
      `tour-copy.ts`, NOT on `TOUR_FIELDS`: that schema is shared with the Translation Console,
      and these are wizard voice. The schema's own descriptions are no longer rendered here at
      all - its "One item per line." is now simply untrue.
    - **Every group and section description deleted bar one.** Each was its own heading restated
      at greater length ("Good to know" / "What to pack, what to expect, and who this is not
      for"), spending a line of attention to teach nothing. Guide languages keeps its one, because
      that is the only place the wrong answer is plausible - an operator can read it as the
      website's languages.
    - `overview` carries a required marker plus a soft character count. It is the only body field
      behind a publish gate and previously looked exactly like the eleven that are not.

12. **Validation audit across all nine steps** (2026-07-29), prompted by an empty Overview saving
    on a LIVE tour and reporting "All changes saved".

    The wizard's validation contract is five parts, and a step is only correct with all five:
    a rule in the schema · an `onInvalid` branch on `handleSubmit` calling `focusFirstInvalid()` ·
    `aria-invalid` on the input (that is what `focusFirstInvalid` queries for) · a `FieldError`
    to render the message · `invalid` on the containing `WizardSection` so a collapsed group is
    forced open. Miss the rule and bad data saves; miss any of the other four and the footer
    refuses to advance while saying nothing.

    Three defects found and fixed:

    - **Overview (content step) had only the asterisk.** No rule, no invalid branch, no
      `aria-invalid`, no `FieldError`. Clearing it wrote `overview: null` and reported success.
      Now driven by `TOUR_COPY_REQUIRED`, so a future gated field is one entry away.
    - **`durationMinutesTo < durationMinutesFrom` saved cleanly.** Each field was valid alone and
      nothing compared them - on either side of the wire. The backend DTO documents
      "≥ durationMinutesFrom" in its Swagger description, but that is prose: no validator backs
      it, and class-validator cannot express a cross-field rule without a custom constraint
      (`common/validators` has two, neither for this). Now a `superRefine`.
    - **`maxPartySize < minPartySize` saved cleanly**, same shape, same absent backend check. The
      capacity summary would read "8 to 2 guests" and the departure materializer would carry a
      party range nothing can satisfy. Now a `superRefine`.

    One latent gap closed: **`step-reach` had a resolver but no invalid branch**, the exact shape
    the content step shipped. `reachSchema` is an unconstrained `hubIds` array so it cannot fail
    today - it was one `.min(1)` away from the same silent refusal.

    Verified sound, no change needed: basics (name/destination/categories all ruled and marked;
    `primaryCategoryId` cannot go empty - an effect keeps it inside `categoryIds` and submit falls
    back to `categoryIds[0]`), pricing (markers are conditional on `isUnit` and match the
    `superRefine` exactly), location, advanced, and the child collections - highlights,
    inclusions, exclusions, features, add-ons, age bands, locations, pickups. Schedules validates
    by hand with local error state rather than zod, which is a different pattern but a complete
    one.

    **The publish gates are deliberately NOT all step-blocking.** Of the six in
    `getPublishChecks`, only Overview is a form field, and it is the only one enforced on save.
    The other five count child collections (5 images, hero, 3 highlights, a price, bookable
    departures) - blocking a step save on "you need 5 photos" would stop an operator saving
    everything else on that step. Form fields get form validation; collection gates get the
    review-step CTA.

13. **The inclusion/exclusion icon picker was removed, and one-field lists now add inline**
    (2026-07-29).

    Sixteen icon choices across the two lists - Check, Drink, Food, Transport, Gear, Guide, Photo,
    Ticket / Cross, Not allowed, Money … - and not one reached a traveller. The public tour page
    renders a hardcoded `/icons/check-green.svg` beside EVERY inclusion and
    `/icons/exclude-cross.svg` beside EVERY exclusion (`tour-detail-content.tsx:581`, `:601`), and
    the mappings above them keep `label` (plus `type`/`priceText` for exclusions). The value has no
    other reader: absent from the JSON-LD and the confirmation email, and the OCTO serializer does
    not even SELECT it - its `include:` takes `translations.label` alone, which is a stronger
    result than the stop address block, where OCTO was the sole consumer. The only thing that ever
    displayed it was the dashboard's own row badge, printing the raw string "check" / "x".

    Columns stay - `@default("check")` / `@default("x")`, and the create path already writes
    `dto.icon ?? 'check'` - so omitting the key costs nothing and needs no migration.

    That leaves **inclusions a one-field list**, which is the point: `EditableListSection` gained a
    `quickAdd` mode where a single-text-field list composes its row inline as a bullet, in the same
    borderless style as the tour-copy lists, Enter to commit. Highlights and inclusions use it;
    `addForm` and its bordered panel remain for the lists that genuinely ask more than one question
    (exclusions: type + price; features: category; stops and zones). Validation did not move - each
    caller still owns its zod schema and calls `safeParse` directly, returning a message to reject
    or `null` to accept.

14. **The OCTO and delivery block left the advanced section** (2026-07-29). Seven controls -
    availability type, redemption method, instant delivery, availability required, allow
    freesale, delivery formats, delivery methods - each with exactly ONE reader in the entire
    platform: `octo/serializers/octo-tour.serializer.ts`. Every other hit is select / write / DTO
    plumbing. OCTO is still pipeline.

    What makes this clearer than the stop address block is that all seven already carry a Prisma
    default that IS the value the form was collecting: `START_TIME`, `DIGITAL`, `true`, `true`,
    `false`, `[PDF_URL, QRCODE]`, `[VOUCHER]`. The screenshot that prompted this shows exactly
    those defaults, untouched. The block existed so an operator could retype them, in vocabulary
    ("PKPASS URL", "Code 128", "freesale") that means nothing to someone selling boat trips.
    `OPENING_HOURS`, the one alternative that would have been a real choice, appears nowhere in
    the backend outside its own enum declaration.

    Columns stay; the form omits the keys. `tours.service.ts` guards each with
    `dto.x !== undefined`, so stored values survive and new tours take the schema default. No
    migration; restoring the block when OCTO goes live is a UI change only.

    The two read-only echoes went with it - time zone (derived from the destination) and start
    times (declared on the Schedule step). A disabled input restating a value another screen owns
    is furniture, not information.

    Advanced is now four fields: H1 override, breadcrumb label, external reference, Active.

15. **The reach step's tier control stopped being a dropdown** (2026-07-29).

    The tier is the most consequential control in the product - it sets ranking, commission
    (20-30%), the deposit travellers pay, and it locks for 30 days - and it was a `<Select>`
    listing "Premium - 30%" beside a four-column strip of unlabelled numbers. Two problems, both
    fatal to the decision: a dropdown shows one option at a time, so the trade could not be
    compared; and 30% read as the WORST option next to 20%, when it is the one that ranks first.

    It is now a radiogroup, one row per tier, each stating the whole trade in a line:
    *"Ranks first · 30% commission · travellers pay 30% up front"*. The deposit figure is not new
    information - master LD24 fixes `deposit_pct` to the tier rate - it was simply never shown
    where the choice is made.

    Two smaller corrections in the same card:
    - `eligibilityState` rendered as a raw enum badge. "GRACE" tells an operator nothing and
      "DEMOTED" reads as an accusation with no explanation. Each state now has a sentence.
    - "Rank 1" became "ranks first". The number is a database column; the word is the answer.
    - Legacy `text-muted-foreground` / `bg-muted` replaced with the content/surface tokens the
      rest of the wizard uses.

    **Section order changed.** This step's own doc says it exists to stop a tour shipping without
    its operator ever seeing which terms it runs on - and Commercial terms was FIFTH, under two
    sections most operators never open. Commercial terms and Spotlight now lead; hubs, attributes,
    search appearance and social follow.

16. **Collapsed sections started answering for themselves** (2026-07-29). `WizardSection` has
    always had a `summary` slot documented as "collapsed must never mean invisible" - and eight of
    ten callers passed nothing. A step opened as nine identical bars, so the only way to learn
    which drawers were done, empty or waiting was to open all nine: exactly the cost collapsing
    was meant to remove. Every section now reports itself through `lib/trips/section-summary.ts`
    (`Set` / `2 of 3` / `4 items` / `Empty`), so the wording cannot drift per caller. `Empty`
    rather than `0 items`, because the operator is scanning for gaps and a word finds the eye
    faster than a digit. A new `muted` prop drops "Advanced and integrations" - whose own
    description says "safe to ignore" - out of the same weight as the sections that are not.

17. **The review step stopped repeating the checklist and started showing the tour**
    (2026-07-29). Publish readiness untouched; four changes around it.

    - **A live tour now links to its live page.** The subtitle claims "everything below is what
      travellers see" and the screen gave no way to look - there was no `target="_blank"` anywhere
      in the wizard. `tourUrl()` joins `lib/public-site.ts` beside the existing helpers, building
      the one canonical flat form `/{locale}/{destination}/{tour-slug}/`. The destination SLUG is
      not on the tour payload (`destinationName` and `destinationId` only), so it comes from the
      destination query the location step already caches. LIVE only - a draft has no page, and a
      dead link is worse than none.
    - **Half the summary lines were the readiness list again.** "Overview written", "Meeting point
      set", "Hero set" are the same booleans the checks two blocks up already report. They now
      show the actual overview, the actual meeting-point text, and "Cover photo chosen". A review
      screen should show what you wrote, not confirm that you wrote something.
    - **The cards became rows.** Eight `rounded-lg border bg-card` boxes were the last card
      surface in a wizard that had shed them everywhere else, and only the 28px "Edit" text was
      clickable - eight small targets where eight full-width ones were free, with the word
      repeated down the column. Now hairline-separated rows, whole row clickable, one chevron.
    - `0 hubs` → `No hubs (optional)`. A zero for something optional reads as a gap.

    Pause and Archive stay where they were, bottom-right as outline buttons. Moving them left and
    quieting them was proposed and reverted on the founder's call.

    One layout bug fixed in the same pass: the row had `w-full` alongside `-mx-3`. With an
    explicit 100% width a negative margin can only SHIFT a box, not widen it, so each row sat 12px
    left of its column and `px-3` pulled the chevron a further 12px in - landing it 24px short of
    the readiness ticks above, which carry no horizontal padding at all. Dropping `w-full` lets
    the grid stretch the row to auto width, so `-mx-3` bleeds both edges and `px-3` returns the
    content to exactly the column edges. The block also lost its wrapping border: a `border-t`
    plus a `border-b` on every child boxed the group into a hard-cornered panel, which is the card
    look this step had just shed.

Retired: `trip-editor-view.tsx` (the two-level tab rail), `trip-create-form.tsx`,
`readiness-rail.tsx`, `trip-details-tab.tsx`, and the `TripSchedulesTab` / `TripSeoTab` /
`TripPromotionTab` wrappers. Their still-used internals were extracted rather than copied:
`LanguagesCard` → `trip-languages-card.tsx`; `StartTimesSection` + `RecurringSchedulesSection`,
`SeoListingSection` + `SocialCard`, `TierCard` + `SpotlightCard` + `DemandBadgeCard` stay in
their files as named exports with a `bare` prop.

**Substantive behaviour change (one, deliberate):** the spotlight request form no longer renders
when a tour is ineligible. It needs 10 reviews at a 4.5 average, so a new tour can never
qualify - the old card drew a date picker, a duration field and a Request button beside a warning
saying the request would be rejected. It now shows the criteria as live counters and no form. The
endpoint, the constants and the blocking-status rule are untouched.

**Two pre-existing e2e failures found, not caused by this work:** two tests asserted an Activity
Hubs multi-select on `/trips/new`. `trip-create-form.tsx` has had zero references to hubs since
it was cut down to the four answers `POST /tours` accepts (verified against git history), so they
were already failing. Replaced with a test that asserts step 1 asks only what creating a draft
needs; hubs are covered on the reach step.

---

## 11. Build order (proposed)

1. Wizard shell: route, step registry, progress rail, sticky footer, step state store, motion.
   Renders the *existing* tab components inside steps, untouched. Ship-able and reversible.
2. Step 1 (create) - the only step with a genuinely different mutation shape.
3. Split Details into steps 3, 5, and the step 7 advanced card. Highest risk: one 40-field form
   becomes three, all still PATCHing the same endpoint. Needs a partial-payload decision:
   **send the full `UpdateTripPayload` from each step with untouched values passed through from
   `trip`**, so the request body is byte-identical to today's.
4. Steps 2, 4, 6 - already card-shaped, mostly re-skin.
5. Step 7 content consolidation.
6. Step 8 + step 9 Review, retire `ReadinessRail`'s standalone placement.
7. `TAB_TO_STEP` redirects, e2e spec updates, delete the two-level tab rail.

Step 3's pass-through rule is the one thing that can silently break data. It gets its own
review pass.
