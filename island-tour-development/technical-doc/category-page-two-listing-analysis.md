# Category Page - The "Two Listings" Question (master 5.4 breakdown)

> Analysis of `frontend/components/frontend/category-page.tsx` against the master doc
> (`technical-doc/island-tours-platform-master.html`) sections 5.4 (Category page) and 3.11 (locked
> trust matrix). Written July 5, 2026. The master is canonical; where the Figma design and the
> master disagree, the master wins.

---

## What the master 5.4 actually specifies

Section 5.4 defines the category page as **one single listing**, in this order:

1. **Hero** - category H1 + intro.
2. **Filter row** - the Filters modal (per 3.12), explicitly **"without the category chips"**.
3. **One ranked grid** - Section 7.2 ordering + the 3.8 diversity pass, with Sponsored / Most
   popular badges (3.6).
4. **Category description** content blocks (this vertical's About).
5. **Related categories.**
6. **No trust bar** - not incidental. The **3.11 locked trust matrix** has an explicit row:
   `Category, Activity Hub -> No trust bar`. The matrix is "the outcome of the cross-surface trust
   review and is intentional."

So per the master: **one listing, no trust strip.** The master never mentions a second "active
tours" block, and it never mentions sub-categories at all (grep of the master returns zero matches).

---

## What the code actually has

`category-page.tsx` renders **two** listing blocks:

| | Top block (lines 288-337) | Second block (lines 347-380) |
|---|---|---|
| Component | `ToursListingSection` | `ToursListing` (mock) |
| Data | **Real, dynamic** - `getCategoryFacets` + `getDestinationTours`, backend-paginated | `MOCK_TOURS` (6 hardcoded cards) |
| Filters | Real toolbar, URL-driven, locked to this category, sub-category pills | `CategoryFilterBar` - **local `useState` only**, hardcoded `SECONDARY_FILTER_CATEGORIES` pills |
| Pagination | Real (`pageCount` from backend) | Fake (`pageCount={1}`) |
| Trust strip | none | **`CategoryTrustStrip`** |
| Matches master? | **Yes** | **No, on two counts** |

The comment on line 347 cites **Figma node 47171:1499** - the second block is a design-file
artifact, not a master requirement.

---

## Why the second block is a conflict (not just a duplicate)

It contradicts the master in two locked ways:

1. **It is a second listing** - the master defines only one ranked grid for the category page.
2. **It has a trust strip** - the 3.11 matrix explicitly says category pages get **no trust bar**.

Structurally, the two filter bars **cannot coexist**: the top `ToursFilterBar` owns the URL query
params (`?sort=`, `?price=`, sub-category slugs). `CategoryFilterBar` is pure local state wired to
nothing. Two bars cannot both drive one listing.

---

## How each block is meant to work

- **Top block (correct):** destination-scoped, locked to this one category. Its filter pills are the
  category's **sub-categories** (a codebase feature, filter-only). Selecting sub-cat pills narrows
  the query; with none selected it shows the whole category tree (parent + subs). Sorted by
  tier/quality (7.2), paginated. Fully functional today.
- **Second block:** has no defined behavior. It is a visual mock. "Boat tours active" is hardcoded
  English; the pills (`Catamaran`, `Under EUR 100 (21)`) are placeholders. Nothing is wired.

---

## Is the backend capable?

- **For the master-compliant single listing: yes, completely - and it already works.** The top block
  proves it: the backend `/tours` endpoint already does category filtering (`categoryIds`),
  sub-category narrowing, attribute facets, price/rating/duration filters, 7.2 sort ordering, and
  pagination. That is the whole master 5.4 grid, live today.
- **For the second listing: there is nothing to be capable of** - the master does not define it, so
  there is no backend contract. It could be served if it were a real second filtered listing, but
  that would need a separate URL param namespace to avoid fighting the top bar, and would still
  violate the "one listing + no trust bar" master rules.

---

## Recommendation

Per the master, the second block should be **removed** - both the duplicate listing and the
`CategoryTrustStrip` (explicitly forbidden on category pages). That collapses the page to exactly
what 5.4 describes:

```
breadcrumb -> header -> the one dynamic listing -> related categories -> About -> FAQs
```

Code to remove if we proceed: the second `<section>` (lines 347-380) plus the now-unused
`CategoryFilterBar`, `CategoryTrustStrip`, `MOCK_TOURS`, and `SECONDARY_FILTER_CATEGORIES`.

If the Figma design genuinely wants that block for a reason the master does not capture, that is a
**master-vs-Figma decision for the founder** - the master wins unless it is amended. The master's
clear default is: **one listing, no trust strip.**
</content>
