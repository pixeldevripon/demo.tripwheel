---
name: api-mock-patterns
description: page.route() patterns for intercepting list GET, PATCH toggle, DELETE, and active-destinations for HubForm
metadata:
  type: project
---

## List endpoint mock

Use glob pattern `**/api/v1/<module>**` to match all query params:

```ts
await page.route('**/api/v1/destinations**', (route) => {
  if (route.request().method() === 'GET') {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
  } else {
    route.continue();
  }
});
```

## Single-entity PATCH/DELETE mock

Use the exact entity ID in the pattern:

```ts
await page.route(`**/api/v1/destinations/${id}`, (route) => {
  if (['PATCH', 'DELETE'].includes(route.request().method())) {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(updated) });
  } else {
    route.continue();
  }
});
```

## HubForm active-destinations mock

HubForm calls `useActiveDestinations('en')` which hits `/api/v1/destinations?isActive=true&locale=en`.
Mock with `**/api/v1/destinations**` — the same glob as the list mock, so install it before `goto('/dashboard/hubs/new')`.

## Response shapes

- Destinations list item: `{ id, name, slug, isActive, isSeeded, heroImage, createdAt }`
- Categories list item: same shape
- Hubs list item: `{ id, name, slug, isActive, isSeeded, destinationId, destinationName, description, createdAt }`
- Paginated wrapper: `{ data: [...], total: N, page: 1, limit: 20 }`
- TripListItem: `{ id, name, slug, status, operatorId, destinationId, destinationName, categoryId, categoryName, hubId, pricingModel, basePrice, durationMinutes, pickupModel, minPartySize, bookingCutoffMinutes, cancellationHours, isActive, isSponsored, createdAt, updatedAt, heroImage, imageCount, highlightCount, scheduleCount, inclusionCount, ...}`
- Trip child endpoints all return arrays; create returns 201 + single item; delete returns `{ message: string }`.

## Trips-specific mocking notes

- Operator list: `**/api/v1/trips/my-trips**`
- Admin list: `**/api/v1/trips/admin/all**`
- Hub match (no hub): `**/api/v1/hubs/match**` → `null`
- Trip detail GET + PATCH both come to `**/api/v1/trips/:id`
- Translation PATCH response: `{ trip, warnings: [] }` (update returns TripUpdateResponse, not TripListItem)
- Lifecycle (publish/pause/unpause/archive/restore): POST to `**/api/v1/trips/:id/<action>`, returns TripListItem
- Calendar popover day buttons use selector `button[name="day"]`; filter `:not([disabled])` for future dates
- Highlights form: `input[name="text"]`; Add button text "Add Highlight"
- Inclusions form: `input[name="label"]`; icon select combobox labeled "Icon"
- Schedules form: start date button text "Select start date"; Add button text "Add Schedule"
- Translation tab: Save button text "Save Translation"; English "Clear Fields" (not "Delete Translation"); confirm with "Yes, clear"
