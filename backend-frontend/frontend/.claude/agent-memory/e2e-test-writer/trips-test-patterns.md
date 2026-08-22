---
name: trips-test-patterns
description: Trip module E2E test patterns — select selectors, toast messages, formatDate output, tab routing, child-tab field names
metadata:
  type: project
---

## Test file location

`e2e/tests/trips/trips.spec.ts` — all flows in one file. Import from `../../fixtures/index`.

## Trips list page heading

Page `trips/page.tsx` renders `<h1>My Trips</h1>` — not "Trips":
```ts
page.getByRole('heading', { name: /my trips/i })
```

## "New Trip" button selector

The button in `TripsTable` toolbar is a `<Link>` inside `<Button asChild>` → use `getByRole('link')`:
```ts
page.getByRole('link', { name: /new trip/i })
```

## Create form — Select selectors (no htmlFor wiring)

`TripForm` has NO `htmlFor` or `aria-label` on any select. Radix Select trigger accessible name
comes from its visible placeholder text (the `SelectValue`). Use:
```ts
page.getByRole('combobox', { name: /select a destination/i })   // ← "Select a destination..."
page.getByRole('combobox', { name: /select a category/i })      // ← "Select a category..."
```
NOT `name: /destination/i` or `name: /category/i` — those will not match.

## Create form — slug 409 error toast

`TripForm.onError` maps 409/slug messages to:
`"A trip with this slug already exists in this destination."`
Test with: `page.getByText(/slug already exists in this destination/i)`
NOT `/slug already exists/i` alone (that text is in the API response, not the toast).

## formatDate output format

`lib/utils.ts formatDate` uses `Intl.DateTimeFormat('en-US', { year:'numeric', month:'short', day:'numeric' })`
which outputs `Dec 1, 2025` NOT `01 Dec 2025`.

The calendar DatePickerField in `trip-schedules-tab.tsx` uses date-fns `format(date, 'dd MMM yyyy')` for
the trigger button label only — that renders `01 Dec 2025`.

Schedule list rows use `formatDate(schedule.startDate)` → `Dec 1, 2025`.

## Slug field in edit/details tab

The details tab renders a `readOnly` input (React prop → `readonly` HTML attribute).
Locate with:
```ts
page.locator('input[readonly]').first()   // first readonly input in the details tab grid
```
NOT `page.locator('input[value="..."]')` — value attribute is not reliable after React hydration.

## Inclusions icon select — no aria label

`TripInclusionsTab` icon Select has no `htmlFor`/`id` wiring. The combobox accessible name is
its current value ("Check" by default), not "icon". Locate by scope:
```ts
const addInclusionSection = page.locator('form').last();
addInclusionSection.getByRole('combobox').first()
```

## API endpoint patterns for mocking

| Resource        | List endpoint               | Per-item endpoint                    |
|-----------------|-----------------------------|--------------------------------------|
| my-trips        | GET /api/v1/trips/my-trips  | —                                    |
| admin all trips | GET /api/v1/trips/admin/all | —                                    |
| trip detail     | —                           | GET/PATCH /api/v1/trips/:id          |
| highlights      | GET/POST /trips/:id/highlights | DELETE/PATCH /trips/:id/highlights/:hid |
| inclusions      | GET/POST /trips/:id/inclusions | DELETE/PATCH /trips/:id/inclusions/:iid |
| schedules       | GET/POST /trips/:id/schedules  | DELETE/PATCH /trips/:id/schedules/:sid |
| translations    | —                           | GET/PATCH/DELETE /trips/:id/translations/:locale |
| lifecycle       | —                           | POST /trips/:id/publish|pause|unpause|restore |

Always mock `/api/v1/trips/:id/languages` returning `[]` when loading the edit page to
prevent the LanguagesCard from making live requests.

## Toast messages for lifecycle actions

From `trip-edit-view.tsx` (header buttons — use these on edit page tests):
- Publish: `'Trip published successfully.'`
- Pause: `'Trip paused.'`
- Unpause: `'Trip resumed.'`

From `trip-row-actions.tsx` (list page row actions — use these on list page tests):
- Publish: `'"${trip.name}" published successfully.'`
- Pause: `'"${trip.name}" paused.'`
- Restore: `'"${trip.name}" restored to draft.'`

## Translation tab toast messages

- Save: `'${LOCALE_LABELS[locale]} translation saved.'` e.g. `'English translation saved.'`
- Clear (EN): `'English translation fields cleared.'`
- Delete (non-EN): `'${LOCALE_LABELS[locale]} translation deleted.'`

Test assertions use partial match `/translation saved/i`, `/fields cleared/i` — these work.

## Translations tab — English tab behaviour

- "Clear Fields" button shown (not "Delete Translation") because `isEnglish=true`
- Clicking Clear Fields shows an inline confirm: `"Yes, clear"` button
- `isEnglish` branch calls PATCH (upsert with nulls), never DELETE

## Tab routing

Edit page: `/dashboard/trips/[id]/edit?tab=<tabname>`
Valid tab names: `details | images | highlights | inclusions | pricing | schedules | translations`
Invalid tab → defaults to `details`.

## beforeEach pattern for tab-specific tests

When testing a non-details tab, always mock BOTH the trip detail AND the en-translation
(used by `TripEditView` for readiness check) plus the tab-specific endpoints:
```ts
await mockTripDetail(page);
await mockTranslationsEndpoints(page);
await mockHighlightsEndpoints(page);       // for highlights tab
await page.route(`**/api/v1/trips/${TRIP_ID}/languages**`, ...);  // always
await mockSupportingData(page);            // destinations/active, categories/active, hubs/match
```
