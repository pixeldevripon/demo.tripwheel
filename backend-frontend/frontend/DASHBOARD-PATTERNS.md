# Dashboard Page & Component Patterns

Rules for every admin dashboard page and its components.

---

## 1. Server vs Client Component Boundary

**Default: Server Component.** Only add `"use client"` at the lowest possible leaf that actually needs it.

```text
dashboard/destinations/page.tsx                      ← Server Component (no "use client")
  └── components/dashboard/destinations/
        destinations-list-view.tsx                   ← "use client" (owns pagination/filter state)
          └── destinations-table.tsx                 ← "use client" (table + row interaction)
                └── destination-row-actions.tsx      ← "use client" (dropdown, dialogs)
```

Page files (`page.tsx`) must stay Server Components unless they directly call a hook. Static shells — page title, breadcrumb, layout structure — render on the server. Only interactive leaves carry `"use client"`.

**Never do this:**
```tsx
// ❌ page.tsx
'use client'  // pushed too high — kills RSC benefits for the whole subtree
export default function DestinationsPage() { ... }
```

**Do this instead:**
```tsx
// ✅ page.tsx — Server Component
import { DestinationsListView } from '@/components/destinations/destinations-list-view'

export default function DestinationsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold uppercase tracking-wider">
            Destinations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage Caribbean island destinations
          </p>
        </div>
      </div>
      <DestinationsListView />  {/* Client boundary starts here */}
    </div>
  )
}
```

---

## 2. Data Fetching: TanStack Query (not Server Actions)

Use **TanStack Query** for all admin dashboard data fetching and mutations. Do not use Server Actions for dashboard data.

### Why TanStack Query wins for admin pages

| Concern | TanStack Query | Server Actions |
| --- | --- | --- |
| Client-side filter/pagination state | Built-in | Manual |
| Shared cache across components | Automatic | Not applicable |
| Post-mutation list refresh | `invalidateQueries` | `revalidateTag` (full reload) |
| Loading/error/pending states | `isLoading`, `isPending` | Manual `useFormState` boilerplate |
| Background refetch | Built-in | Not applicable |

### Query key conventions

```typescript
export const destinationKeys = {
  all:        () => ['destinations'] as const,
  list:       (params: object) => ['destinations', 'list', params] as const,
  detail:     (id: string) => ['destinations', 'detail', id] as const,
  translations: (id: string) => ['destinations', 'translations', id] as const,
  pageContent:  (id: string, locale: string) => ['destinations', 'page-content', id, locale] as const,
  faqs:         (id: string) => ['destinations', 'faqs', id] as const,
}
```

### Mutation invalidation pattern

```typescript
const mutation = useMutation({
  mutationFn: (dto) => api.update(id, dto),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: destinationKeys.all() })
    queryClient.invalidateQueries({ queryKey: destinationKeys.detail(id) })
    toast.success('Saved')
  },
  onError: (err) => toast.error(err.message),
})
```

---

## 3. API Client Pattern (client-side)

All client-side API calls live in `lib/api/<module>.ts`. Always use `credentials: 'include'` (Better Auth cookie sessions).

```typescript
// lib/api/destinations.ts
const API_BASE = `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'}/api/v1/destinations`

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || `API error ${res.status}`)
  }
  return res.json()
}
```

Server-side fetches (Server Components, Server Actions) use `headers()` from `next/headers` to forward the cookie manually. See `app/_actions/userActions.ts` for the pattern.

---

## 4. Form Pattern

Every form uses React Hook Form + Zod. No `any`.

```typescript
const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  // For URL fields — z.string().url() is deprecated in Zod 4. Use refine:
  heroImage: z.string().refine(
    (v) => v === '' || (() => { try { new URL(v); return true } catch { return false } })(),
    'Must be a valid URL'
  ).optional(),
})

const form = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
  defaultValues: { name: '', heroImage: '' },
})
```

---

## 5. Module File Structure

Every new admin module follows this layout:

```text
types/<module>.ts                               ← all TypeScript interfaces
lib/api/<module>.ts                             ← client-side API client
hooks/<module>/use-<module>.ts                  ← all TanStack Query hooks + mutations

components/dashboard/<module>/
  <module>-columns.tsx                          ← TanStack Table column defs
  <module>s-table.tsx                           ← data table (search, filter, pagination, bulk)
  <module>s-list-view.tsx                       ← "use client" wrapper owning list state
  <module>-row-actions.tsx                      ← dropdown with all row-level actions
  <module>-quick-edit-dialog.tsx                ← lightweight Dialog for inline edits
  <module>-delete-dialog.tsx                    ← AlertDialog confirmation
  <module>-form.tsx                             ← full create/edit form
  <module>-detail-shell.tsx                     ← "use client" shared breadcrumb/title/sub-nav
  <module>-sub-nav.tsx                          ← tabs nav for [id]/* pages
  <module>-edit-view.tsx                        ← "use client" view rendered by [id]/edit/page
  <module>-translation-form.tsx                 ← locale tab form (if multilingual)
  <module>-translations-view.tsx                ← "use client" view for [id]/translations/page
  <module>-page-content-form.tsx                ← editorial content form (if applicable)
  <module>-page-content-view.tsx                ← "use client" view for [id]/page-content/page
  <module>-faq-manager.tsx                      ← FAQ manager (if applicable)
  <module>-faqs-view.tsx                        ← "use client" view for [id]/faqs/page

app/(dashboard)/dashboard/<module>/
  page.tsx                                 ← Server Component, renders list view
  new/page.tsx                             ← Server Component, renders form
  [id]/page.tsx                            ← redirect to [id]/edit
  [id]/edit/page.tsx                       ← Client Component (needs useParams + query)
  [id]/translations/page.tsx               ← Client Component
  [id]/page-content/page.tsx               ← Client Component
  [id]/faqs/page.tsx                       ← Client Component
```

---

## 6. UI Conventions

### Layout padding

`lg:p-8` is applied by the dashboard layout wrapper — **never add it inside a page or component**. Page content starts directly without any padding wrapper:

```tsx
// ✅ correct — no padding wrapper
export default function DestinationsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">...
```

```tsx
// ❌ wrong — layout already handles this
export default function DestinationsPage() {
  return (
    <div className="lg:p-8">
```

### Page header (in server component page.tsx)

```tsx
<div className="flex items-center justify-between mb-6">
  <div>
    <h1 className="font-heading text-2xl font-semibold uppercase tracking-wider">
      Module Name
    </h1>
    <p className="text-sm text-muted-foreground mt-1">Short description</p>
  </div>
  <Button asChild size="sm">
    <Link href="..."><PlusIcon />Add Item</Link>
  </Button>
</div>
```

- Card titles: `font-heading text-lg font-semibold uppercase tracking-wider`
- Field labels: `text-xs font-semibold uppercase`
- Buttons: `text-xs font-semibold tracking-widest uppercase` (CVA enforces this)
- Tailwind v4 canonical classes: `max-w-50` not `max-w-[200px]`, `size-8` not `w-8 h-8`
- No `z.string().url()` — deprecated in Zod 4; use `z.string().refine(...)` (see Form Pattern above)

---

## 7. Seeded / Protected Entity Guard

Destinations with `isSeeded: true` cannot be deleted. Pattern for any protected entity:

```tsx
// In row actions / delete dialog
<Tooltip>
  <TooltipTrigger asChild>
    <span>
      <DropdownMenuItem
        variant="destructive"
        disabled={destination.isSeeded}
        onClick={() => !destination.isSeeded && setDeleteOpen(true)}
      >
        <Trash2Icon /> Delete
      </DropdownMenuItem>
    </span>
  </TooltipTrigger>
  {destination.isSeeded && (
    <TooltipContent>Seeded destinations cannot be deleted</TooltipContent>
  )}
</Tooltip>
```

---

## 8. Tabs — one design everywhere

All dashboard tabs use the shared `@/components/ui/tabs` **default variant** (the
`bg-muted` pill / segmented bar, active pill = `bg-background`). This is the Settings
look. Do **not** use `variant="line"` and do **not** hand-roll tab bars.

`TabsList` is responsive by default: a single row that scrolls horizontally on
overflow with the scrollbar hidden (triggers are `shrink-0`, so they never compress).
So **don't** add `flex-wrap`, `w-max`, or your own `overflow-x-auto` wrapper.

**In-page tabs** (switch panels without navigating — settings, statistics, the trip
edit view, locale translation/page-content forms): use the primitives directly.

```tsx
<Tabs defaultValue="general" className="w-full">
  <TabsList>                                 {/* no flex-wrap / w-max / variant="line" */}
    <TabsTrigger value="general">General</TabsTrigger>
    {/* … */}
  </TabsList>
  <TabsContent value="general" className="mt-6">{/* … */}</TabsContent>
</Tabs>
```

**Route-based sub-navs** (Details / Translations / Page Content / FAQs / …): use the
reusable `DashboardTabNav` (`@/components/dashboard/dashboard-tab-nav`). It renders the
same pill styling via `<Link>` triggers and derives the active tab from `usePathname()`.

```tsx
export function HubSubNav({ hubId }: { hubId: string }) {
  return (
    <DashboardTabNav
      tabs={[
        { label: 'Details', href: `/dashboard/hubs/${hubId}/edit` },
        { label: 'Translations', href: `/dashboard/hubs/${hubId}/translations` },
        // optional: badge?: ReactNode (count/dot), exact?: boolean
      ]}
    />
  );
}
```
