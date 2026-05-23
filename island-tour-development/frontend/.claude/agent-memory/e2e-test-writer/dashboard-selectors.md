---
name: dashboard-selectors
description: Reliable Playwright selectors for dashboard row-actions, dialogs, form inputs, and toast assertions
metadata:
  type: project
---

## Row-actions trigger button

The `MoreHorizontalIcon` button has `<span className="sr-only">Open menu</span>`:
```ts
page.getByRole('button', { name: /open menu/i }).first()
```

## Dropdown menu items

Row-actions are `DropdownMenuItem` elements — they render as `role="menuitem"`:
```ts
page.getByRole('menuitem', { name: /view/i })
page.getByRole('menuitem', { name: /edit/i })
page.getByRole('menuitem', { name: /quick edit/i })
page.getByRole('menuitem', { name: /manage translations/i })
page.getByRole('menuitem', { name: /page content/i })
page.getByRole('menuitem', { name: /manage faqs/i })
page.getByRole('menuitem', { name: /deactivate/i })   // or /activate/i
page.getByRole('menuitem', { name: /delete/i })
// Hubs only:
page.getByRole('menuitem', { name: /allowed categories/i })
```

## AlertDialog (DeactivateDialog)

```ts
page.getByRole('alertdialog')                               // the container
page.getByText(/deactivate destination/i)                   // title
page.getByRole('button', { name: /^deactivate$/i })         // confirm — exact match avoids matching "Deactivating..."
page.getByRole('button', { name: /cancel/i })               // cancel
```

## Quick Edit dialog

```ts
page.getByRole('dialog')                                    // the Dialog (not AlertDialog)
page.getByRole('button', { name: /save changes/i })
```

## Form inputs

```ts
page.locator('input[name="name"]')
page.locator('input[name="slug"]')
page.locator('textarea[name="description"]')   // hubs only
page.getByRole('combobox')                     // HubForm destination Select (shadcn)
```

## Submit buttons (create pages)

```ts
page.getByRole('button', { name: /create destination/i })
page.getByRole('button', { name: /create category/i })
page.getByRole('button', { name: /create hub/i })
```

## Toast assertions

Sonner toast renders in DOM — use `page.getByText(...)`:
```ts
await expect(page.getByText(/deactivated successfully/i)).toBeVisible({ timeout: 5_000 });
```

## Page headings

Each list page uses `<h1 className="... uppercase ...">` — matched with:
```ts
page.getByRole('heading', { name: /destinations/i })
page.getByRole('heading', { name: /categories/i })
page.getByRole('heading', { name: /hubs/i })
```

## Add buttons

The "Add X" button is a `<Link>` rendered inside a `<Button asChild>`, so it has `role="link"`:
```ts
page.getByRole('link', { name: /add destination/i })
page.getByRole('link', { name: /add category/i })
page.getByRole('link', { name: /add hub/i })
```
