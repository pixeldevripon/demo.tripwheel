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
