# Phase 3 - Design System Specification

> Target: `globals.css` in the standalone dashboard repo. Tailwind v4 conventions, verified against
> current Tailwind docs (`@theme` vs `@theme inline`, `--spacing-*`/`--radius-*` namespaces,
> `@custom-variant dark`).
>
> Every value below is a **proposal with rationale**. Contrast ratios are **design targets that must
> be measured before merge** (§9), not claims of compliance.

---

## 1. Design principles for this product

The dashboard is an **operational tool**, not a brand surface. Operators live in it for hours. Four principles follow, and each one is a direct response to an audit finding:

| # | Principle | Answers |
|---|---|---|
| 1 | **The neutral ramp is the design.** Color is reserved for state and action. If a screen is 90% neutral, the 10% that is not carries real meaning. | D-1 (149 hand-rolled colors) |
| 2 | **Density comes from spacing and line-height, never from type size.** Shrinking text is not a density strategy; it is the absence of one. | C-11, E-1 (`text-xs` at 64%) |
| 3 | **Every semantic state is a token triplet, never a palette class.** If a developer must choose `amber-100` vs `amber-50`, the system has already failed. | D-1, E-2 |
| 4 | **Light and dark are one ramp at two lightnesses.** Not two unrelated ramps sharing token names. | D-4, D-5 |

---

## 2. Palette

### 2.1 Decision: deep ocean teal primary on a cool-neutral ramp

| Decision | Value | Rationale |
|---|---|---|
| Primary | **Teal, hue 220** | Four reasons, in order of weight. **(a) It is not the storefront.** The public site's primary is coral `#e8611a`. An admin tool that looks like the customer-facing site invites the single worst class of operator error: acting on production thinking you are looking at a preview. Admin chrome should be visibly, deliberately a different product. **(b) It leaves the warm half of the wheel free for semantics.** Amber warnings and red destructives cannot compete with a warm primary. Today's violet primary technically satisfies this too, but see (c). **(c) It carries domain meaning** - maritime/Caribbean - without being decorative. **(d) It survives at both ends of the lightness range**, which the current violet does not (see 2.2). |
| Neutrals | **Cool, hue 250, one ramp** | Replaces the current warm-80-light / cool-260-dark split (D-5), which meant no color reasoning transferred between modes. |
| Semantics | **4 states x 4 roles** | Kills D-1 at the root. |
| Charts | **6 hues spread across the wheel** | Replaces 5 purple-family tokens that cannot encode categorical data (D-4). |

### 2.2 What is wrong with the current primary, specifically

`--primary: oklch(0.5417 0.179 288.0332)` is stock shadcn violet, and:
- It is **identical in light and dark** (D-4). A primary tuned for a white canvas is unchanged on an `oklch(14%)` canvas.
- **All five chart tokens are variants of it.** `--chart-1` through `--chart-5` are hues 276-289. That is one color, five times. Any multi-series chart is unreadable by design, which is likely why `statistics.tsx` forces mock branches on (B-2) - the charts were never usable with real data.
- It is generic. It is the colour of "we did not choose".

### 2.3 Neutral ramp (hue 250)

One ramp. Light mode reads it ascending, dark mode descending. **This is the fix for D-5.**

| Token | Value |
|---|---|
| `--n-0` | `oklch(1 0 0)` |
| `--n-25` | `oklch(0.985 0.002 250)` |
| `--n-50` | `oklch(0.97 0.003 250)` |
| `--n-100` | `oklch(0.94 0.005 250)` |
| `--n-200` | `oklch(0.90 0.007 250)` |
| `--n-300` | `oklch(0.84 0.009 250)` |
| `--n-400` | `oklch(0.70 0.012 250)` |
| **`--n-450`** | **`oklch(0.65 0.012 250)`** - ADDED 2026-07-17, light `--line-control` (§9) |
| `--n-500` | `oklch(0.58 0.014 250)` |
| **`--n-550`** | **`oklch(0.55 0.014 250)`** - ADDED 2026-07-17, light `--content-subtle`; `n-500` measured 4.10:1 and no single value serves both modes (§9) |
| `--n-600` | `oklch(0.48 0.014 250)` |
| `--n-700` | `oklch(0.38 0.013 250)` |
| `--n-800` | `oklch(0.28 0.012 250)` |
| `--n-900` | `oklch(0.21 0.010 250)` |
| `--n-950` | `oklch(0.16 0.008 250)` |
| `--n-1000` | `oklch(0.12 0.006 250)` |

Chroma rises toward the middle and falls at both ends: a pure-grey extreme reads dead, a saturated extreme reads tinted.

### 2.4 Brand ramp (hue 220)

| Token | Value | Use |
|---|---|---|
| `--brand-50` | `oklch(0.97 0.015 220)` | tint background |
| `--brand-100` | `oklch(0.93 0.032 220)` | subtle fill |
| `--brand-200` | `oklch(0.87 0.055 220)` | border |
| `--brand-300` | `oklch(0.78 0.082 220)` | |
| `--brand-400` | `oklch(0.68 0.104 220)` | **dark-mode primary** |
| `--brand-500` | `oklch(0.60 0.118 220)` | |
| `--brand-600` | `oklch(0.52 0.122 220)` | **light-mode primary** |
| `--brand-700` | `oklch(0.44 0.104 220)` | hover |
| `--brand-800` | `oklch(0.36 0.082 220)` | |
| `--brand-900` | `oklch(0.28 0.060 220)` | |

Primary is `brand-600` in light and `brand-400` in dark. **A primary must move between modes.** That is the point of D-4.

### 2.5 Semantic ramps

Four states. Four roles each. **This table is the single highest-leverage artifact in this document** - it is what makes 149 hand-rolled palette classes unnecessary.

| State | Hue | `-subtle` (bg) | `-border` | `-fg` (text on subtle) | `-solid` (fill) |
|---|---|---|---|---|---|
| **success** | 150 | L 0.95 / **dark** 0.26 | L 0.85 / 0.36 | L 0.42 / 0.80 | L 0.55 / 0.62 |
| **warning** | 75 | L 0.96 / **dark** 0.27 | L 0.86 / 0.37 | L 0.44 / 0.82 | L 0.70 / 0.75 |
| **danger** | 25 | L 0.95 / **dark** 0.26 | L 0.85 / 0.36 | L 0.45 / 0.80 | L 0.55 / 0.62 |
| **info** | 250 | L 0.96 / **dark** 0.27 | L 0.86 / 0.37 | L 0.45 / 0.82 | L 0.55 / 0.62 |

Chroma: `-subtle` ~0.02, `-border` ~0.05, `-fg` ~0.12, `-solid` ~0.15.

**Every role flips between modes.** The current tokens flip only `-foreground` and keep the base identical (D-4) - which is why `bg-amber-100 text-amber-800` survives into dark mode as near-white on near-white.

The rule this enables, stated once and enforced by lint (§8):

> **A status surface is `bg-{state}-subtle border-{state}-border text-{state}-fg`. There is no other
> way to color a status.** No `amber-100`. No `emerald-700`. If a state does not exist in this table,
> add it to the table.

### 2.6 Chart ramp

Six hues spread across the wheel so categorical series are distinguishable, with dark-mode lightness compensation.

| Token | Light | Dark | Hue family |
|---|---|---|---|
| `--chart-1` | `oklch(0.55 0.12 220)` | `oklch(0.70 0.12 220)` | brand teal |
| `--chart-2` | `oklch(0.62 0.15 25)` | `oklch(0.72 0.15 25)` | coral |
| `--chart-3` | `oklch(0.58 0.13 150)` | `oklch(0.72 0.13 150)` | green |
| `--chart-4` | `oklch(0.70 0.14 75)` | `oklch(0.80 0.14 75)` | amber |
| `--chart-5` | `oklch(0.55 0.14 300)` | `oklch(0.70 0.14 300)` | violet |
| `--chart-6` | `oklch(0.60 0.11 190)` | `oklch(0.74 0.11 190)` | cyan |

> **ADDED 2026-07-17 (Phase 12): `--rating`** - star-rating gold, light `oklch(0.77 0.16 75)` / dark
> `oklch(0.80 0.15 78)`. Ratings are **not a status**: mapping star fills onto the warning quartet
> would make a 4.8-star tour render like a warning. Decorative (icon fill beside a numeric label),
> so it carries no contrast target.

**Ordering constraint:** chart-1 and chart-2 must be distinguishable under deuteranopia, since a 2-series chart is the common case. Teal/coral is chosen for that reason and **must be verified with a simulator** (§9), not assumed.

---

## 3. The full token set

Tailwind v4 semantics, per current docs:
- **`@theme`** defines tokens and *generates utilities* from them.
- **`@theme inline`** maps a utility name to a `var()` that resolves at use time - required when the value must switch by mode.
- Mode-switching values live in `:root` / `.dark`; `@theme inline` points at them.

```css
@import 'tailwindcss';
@import 'tw-animate-css';

@custom-variant dark (&:where(.dark, .dark *));

/* ─── Primitives: mode-independent ─────────────────────────────── */
@theme {
  /* Spacing base. Tailwind v4 derives the scale multiplicatively:
     p-4 = calc(var(--spacing) * 4) = 16px. Do not restrict here; see §8. */
  --spacing: 0.25rem;

  /* Radius - a real scale, unlike today's 5px ladder (D-3).
     NOTE: radius is NOT a function of theme. It must never appear in .dark. */
  --radius-none: 0;
  --radius-sm:   0.25rem;   /* 4px  - inputs, chips */
  --radius-md:   0.375rem;  /* 6px  - buttons, cells */
  --radius-lg:   0.5rem;    /* 8px  - cards, popovers */
  --radius-xl:   0.75rem;   /* 12px - dialogs, sheets */
  --radius-full: 9999px;

  /* Type scale - 6 steps. Body default is 14px, NOT 12px (principle 2). */
  --text-2xs:     0.6875rem; /* 11px - uppercase micro-labels ONLY */
  --text-2xs--line-height: 1rem;
  --text-xs:      0.75rem;   /* 12px - dense table meta */
  --text-xs--line-height:  1.125rem;
  --text-sm:      0.875rem;  /* 14px - DEFAULT body + table cells */
  --text-sm--line-height:  1.25rem;
  --text-base:    1rem;      /* 16px - form inputs (see §5.2) */
  --text-base--line-height: 1.5rem;
  --text-lg:      1.25rem;   /* 20px - card + section titles */
  --text-lg--line-height:  1.75rem;
  --text-xl:      1.5rem;    /* 24px - page titles */
  --text-xl--line-height:  2rem;
  --text-2xl:     1.875rem;  /* 30px - metrics */
  --text-2xl--line-height: 2.25rem;

  --font-sans: 'Inter Variable', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;

  --tracking-tight:  -0.011em;
  --tracking-normal: 0em;
  --tracking-caps:   0.06em;   /* for --text-2xs uppercase only */

  /* Motion */
  --ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
  --ease-in-out:    cubic-bezier(0.4, 0, 0.2, 1);
  --duration-fast:   120ms;
  --duration-normal: 180ms;
  --duration-slow:   260ms;
}

/* ─── Neutral + brand ramps ────────────────────────────────────── */
@theme {
  --color-n-0:    oklch(1 0 0);
  --color-n-25:   oklch(0.985 0.002 250);
  --color-n-50:   oklch(0.97 0.003 250);
  --color-n-100:  oklch(0.94 0.005 250);
  --color-n-200:  oklch(0.90 0.007 250);
  --color-n-300:  oklch(0.84 0.009 250);
  --color-n-400:  oklch(0.70 0.012 250);
  --color-n-450:  oklch(0.65 0.012 250);  /* ADDED 2026-07-17 - light --line-control (3.09:1) */
  --color-n-500:  oklch(0.58 0.014 250);
  --color-n-550:  oklch(0.55 0.014 250);  /* ADDED 2026-07-17 - light --content-subtle (4.64:1);
                                             n-500 cannot serve both modes. See §9. */
  --color-n-600:  oklch(0.48 0.014 250);
  --color-n-700:  oklch(0.38 0.013 250);
  --color-n-800:  oklch(0.28 0.012 250);
  --color-n-900:  oklch(0.21 0.010 250);
  --color-n-950:  oklch(0.16 0.008 250);
  --color-n-1000: oklch(0.12 0.006 250);

  --color-brand-50:  oklch(0.97 0.015 220);
  --color-brand-100: oklch(0.93 0.032 220);
  --color-brand-200: oklch(0.87 0.055 220);
  --color-brand-300: oklch(0.78 0.082 220);
  --color-brand-400: oklch(0.68 0.104 220);
  --color-brand-500: oklch(0.60 0.118 220);
  --color-brand-600: oklch(0.52 0.122 220);
  --color-brand-700: oklch(0.44 0.104 220);
  --color-brand-800: oklch(0.36 0.082 220);
  --color-brand-900: oklch(0.28 0.060 220);
}

/* ─── Semantic layer: mode-switching ───────────────────────────── */
:root {
  --surface:          var(--color-n-25);
  --surface-raised:   var(--color-n-0);
  --surface-sunken:   var(--color-n-50);
  --surface-overlay:  var(--color-n-0);
  --surface-inset:    var(--color-n-100);

  --content:          var(--color-n-900);   /* primary text */
  --content-muted:    var(--color-n-600);   /* secondary */
  --content-subtle:   var(--color-n-550);   /* tertiary - lowest allowed. n-500 measured 4.10:1; see §9 */
  --content-inverse:  var(--color-n-0);

  --line:             var(--color-n-200);   /* default border - DECORATIVE, no contrast target */
  --line-strong:      var(--color-n-300);   /* DECORATIVE, no contrast target */
  --line-subtle:      var(--color-n-100);
  --line-control:     var(--color-n-450);   /* 3.09:1 - WCAG 1.4.11. Inputs/checkboxes. See §9 */

  --primary:            var(--color-brand-600);
  --primary-hover:      var(--color-brand-700);
  --primary-content:    var(--color-n-0);
  --primary-subtle:     var(--color-brand-50);
  --primary-subtle-content: var(--color-brand-700);

  --focus-ring:       var(--color-brand-500);

  --success-subtle: oklch(0.95 0.02 150);
  --success-border: oklch(0.85 0.05 150);
  --success-fg:     oklch(0.42 0.12 150);
  --success-solid:  oklch(0.55 0.15 150);

  --warning-subtle: oklch(0.96 0.02 75);
  --warning-border: oklch(0.86 0.05 75);
  --warning-fg:     oklch(0.44 0.12 75);
  --warning-solid:  oklch(0.70 0.15 75);

  --danger-subtle:  oklch(0.95 0.02 25);
  --danger-border:  oklch(0.85 0.05 25);
  --danger-fg:      oklch(0.45 0.12 25);
  --danger-solid:   oklch(0.55 0.15 25);

  --info-subtle:    oklch(0.96 0.02 250);
  --info-border:    oklch(0.86 0.05 250);
  --info-fg:        oklch(0.45 0.12 250);
  --info-solid:     oklch(0.55 0.15 250);

  --chart-1: oklch(0.55 0.12 220);
  --chart-2: oklch(0.62 0.15 25);
  --chart-3: oklch(0.58 0.13 150);
  --chart-4: oklch(0.70 0.14 75);
  --chart-5: oklch(0.55 0.14 300);
  --chart-6: oklch(0.60 0.11 190);

  --shadow-xs: 0 1px 2px 0 oklch(0.21 0.01 250 / 0.05);
  --shadow-sm: 0 1px 3px 0 oklch(0.21 0.01 250 / 0.08), 0 1px 2px -1px oklch(0.21 0.01 250 / 0.06);
  --shadow-md: 0 4px 8px -2px oklch(0.21 0.01 250 / 0.10), 0 2px 4px -2px oklch(0.21 0.01 250 / 0.06);
  --shadow-lg: 0 12px 20px -4px oklch(0.21 0.01 250 / 0.12), 0 4px 8px -4px oklch(0.21 0.01 250 / 0.08);

  --sidebar:            var(--color-n-50);
  --sidebar-content:    var(--color-n-700);
  --sidebar-active:     var(--color-brand-50);
  --sidebar-active-content: var(--color-brand-700);
  --sidebar-line:       var(--color-n-200);
}

.dark {
  --surface:          var(--color-n-1000);
  --surface-raised:   var(--color-n-950);
  --surface-sunken:   var(--color-n-1000);
  --surface-overlay:  var(--color-n-900);
  --surface-inset:    var(--color-n-900);

  --content:          var(--color-n-50);
  --content-muted:    var(--color-n-400);
  --content-subtle:   var(--color-n-500);
  --content-inverse:  var(--color-n-1000);

  --line:             var(--color-n-800);
  --line-strong:      var(--color-n-700);
  --line-subtle:      var(--color-n-900);
  --line-control:     oklch(0.50 0.014 250);  /* 3.39:1 - no ramp step clears 3:1 on n-1000 */

  --primary:            var(--color-brand-400);
  --primary-hover:      var(--color-brand-300);
  --primary-content:    var(--color-n-1000);
  --primary-subtle:     var(--color-brand-900);
  --primary-subtle-content: var(--color-brand-200);

  --focus-ring:       var(--color-brand-400);

  --success-subtle: oklch(0.26 0.02 150);
  --success-border: oklch(0.36 0.05 150);
  --success-fg:     oklch(0.80 0.12 150);
  --success-solid:  oklch(0.62 0.15 150);

  --warning-subtle: oklch(0.27 0.02 75);
  --warning-border: oklch(0.37 0.05 75);
  --warning-fg:     oklch(0.82 0.12 75);
  --warning-solid:  oklch(0.75 0.15 75);

  --danger-subtle:  oklch(0.26 0.02 25);
  --danger-border:  oklch(0.36 0.05 25);
  --danger-fg:      oklch(0.80 0.12 25);
  --danger-solid:   oklch(0.62 0.15 25);

  --info-subtle:    oklch(0.27 0.02 250);
  --info-border:    oklch(0.37 0.05 250);
  --info-fg:        oklch(0.82 0.12 250);
  --info-solid:     oklch(0.62 0.15 250);

  --chart-1: oklch(0.70 0.12 220);
  --chart-2: oklch(0.72 0.15 25);
  --chart-3: oklch(0.72 0.13 150);
  --chart-4: oklch(0.80 0.14 75);
  --chart-5: oklch(0.70 0.14 300);
  --chart-6: oklch(0.74 0.11 190);

  --shadow-xs: 0 1px 2px 0 oklch(0 0 0 / 0.30);
  --shadow-sm: 0 1px 3px 0 oklch(0 0 0 / 0.40), 0 1px 2px -1px oklch(0 0 0 / 0.30);
  --shadow-md: 0 4px 8px -2px oklch(0 0 0 / 0.45), 0 2px 4px -2px oklch(0 0 0 / 0.30);
  --shadow-lg: 0 12px 20px -4px oklch(0 0 0 / 0.55), 0 4px 8px -4px oklch(0 0 0 / 0.40);

  --sidebar:            var(--color-n-950);
  --sidebar-content:    var(--color-n-400);
  --sidebar-active:     var(--color-brand-900);
  --sidebar-active-content: var(--color-brand-200);
  --sidebar-line:       var(--color-n-800);
}

/* ─── Utility mapping ──────────────────────────────────────────── */
@theme inline {
  --color-surface:         var(--surface);
  --color-surface-raised:  var(--surface-raised);
  --color-surface-sunken:  var(--surface-sunken);
  --color-surface-overlay: var(--surface-overlay);
  --color-surface-inset:   var(--surface-inset);

  --color-content:         var(--content);
  --color-content-muted:   var(--content-muted);
  --color-content-subtle:  var(--content-subtle);
  --color-content-inverse: var(--content-inverse);

  --color-line:            var(--line);
  --color-line-strong:     var(--line-strong);
  --color-line-subtle:     var(--line-subtle);

  --color-primary:              var(--primary);
  --color-primary-hover:        var(--primary-hover);
  --color-primary-content:      var(--primary-content);
  --color-primary-subtle:       var(--primary-subtle);
  --color-primary-subtle-content: var(--primary-subtle-content);

  --color-success-subtle: var(--success-subtle);
  --color-success-border: var(--success-border);
  --color-success-fg:     var(--success-fg);
  --color-success-solid:  var(--success-solid);
  /* ...identical quartet for warning / danger / info... */

  --color-chart-1: var(--chart-1);
  /* ...through --color-chart-6... */

  --color-sidebar:                 var(--sidebar);
  --color-sidebar-content:         var(--sidebar-content);
  --color-sidebar-active:          var(--sidebar-active);
  --color-sidebar-active-content:  var(--sidebar-active-content);
  --color-sidebar-line:            var(--sidebar-line);

  --shadow-xs: var(--shadow-xs);
  --shadow-sm: var(--shadow-sm);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
}

@layer base {
  * { border-color: var(--color-line); }
  body {
    @apply bg-surface text-content font-sans antialiased;
    font-size: var(--text-sm);           /* 14px default, not 12px */
    letter-spacing: var(--tracking-normal);
  }
  :focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  button { cursor: pointer; }
}
```

### 3.1 Defects this closes for free

| Defect | How |
|---|---|
| B-3 `--destructive-foreground` mapped, never defined | The state quartet defines all four roles explicitly. |
| B-5 `--shadow-2xl: var(--shadow-2xl)` self-referential | Shadows are defined, not aliased to themselves. |
| B-5 `--tracking-normal` undefined but applied to `body` | Defined in `@theme`. |
| D-3 `--radius` changes with theme | Radius is in `@theme` only. It is structurally impossible to put it in `.dark`. |
| D-5 hue split between modes | One ramp, hue 250. |
| F-3 149 leaked `--it-*` tokens | The import line does not exist in the new repo. |

---

## 4. Density strategy

### 4.1 The core reframe

Today's density is **type-driven**: `text-xs` is 64% of all font-size classes, `text-[10px]` appears 23 times. That is not density, it is an accessibility problem wearing density's clothes (E-1).

**Density is spacing and line-height. Type size is information hierarchy.** They are different axes and must stop being conflated.

### 4.2 Row density

Two modes on data tables only. Persisted per user in `localStorage`. **Comfortable is the default**, because the default should be readable and dense should be a choice.

| Mode | Row height | Cell padding | Font |
|---|---|---|---|
| Comfortable (default) | 44px | `py-2.5 px-3` | `text-sm` (14px) |
| Compact | 32px | `py-1 px-3` | `text-sm` (14px) |

**Font size does not change between modes.** Only vertical rhythm. Compact fits ~37% more rows without making anything less readable, which is the entire point.

### 4.3 Type roles

| Role | Token | Rule |
|---|---|---|
| Page title | `--text-xl` (24px) | one per page |
| Section / card title | `--text-lg` (20px) | |
| Body, table cells, labels, buttons | `--text-sm` (14px) | **the default; ~80% of the UI** |
| Form inputs | `--text-base` (16px) | see §5.2 |
| Dense meta (timestamps, counts, helper) | `--text-xs` (12px) | never for primary content |
| Uppercase micro-labels (table headers) | `--text-2xs` (11px) + `--tracking-caps` | **the only permitted uppercase in the product** |
| Metrics | `--text-2xl` (30px) | overview cards only |

**Hard rules:**
- `text-[10px]` and every arbitrary `text-[...]` value are **banned** (§8). Today: 55 occurrences, 8 distinct values, 3 units.
- Uppercase is permitted **only** at `--text-2xs` on table headers. This retires the `button.tsx` rule that forces `uppercase tracking-widest` on every button in the product (D-8, E-4).

### 4.4 Spacing

Tailwind v4 derives the spacing scale multiplicatively from a single `--spacing` base, so the scale cannot be pruned in CSS. **Restriction is enforced by lint, not by tokens** (§8).

Permitted steps: **`0.5, 1, 2, 3, 4, 6, 8, 12, 16`** (2px through 64px). Everything else is an error.

This takes 59 distinct values (D-2) down to 9. The banned long tail is exactly what the audit found: `gap-5`, `gap-10`, `p-12`, `py-5`, `py-10`, `space-y-0`, and the 143 half-step uses beyond `0.5`.

| Context | Value |
|---|---|
| Icon to label | `gap-2` (8px) |
| Form field stack | `space-y-4` (16px) |
| Related controls | `gap-3` (12px) |
| Card padding | `p-4` (16px) / `p-6` (24px) for primary cards |
| Section stack | `space-y-6` (24px) |
| Page gutter | `p-6` (24px) |

---

## 5. Component standards

### 5.1 `StatusBadge` - the keystone

> **Build this first.** It is the highest impact-to-effort item in the entire document (D-1: Impact 4,
> Effort 2). One missing primitive caused 149 hardcoded palette classes, 4 incompatible conventions,
> and the majority of the dark-mode gap.

Replaces: `badge.tsx`'s de-chromed base, plus the four independent conventions in `booking-columns.tsx`, `payment-columns.tsx`, `spotlight-columns.tsx` and `destination-columns.tsx`.

| Property | Spec |
|---|---|
| Variants | `neutral \| success \| warning \| danger \| info` |
| Anatomy | `inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs font-medium` |
| Color | `bg-{v}-subtle border-{v}-border text-{v}-fg` - **always this triplet** |
| **Non-color cue** | **A leading 8px dot AND the text label. Mandatory.** |
| Icon | optional leading icon, `size-3` |

The mandatory dot + label is a **WCAG 1.4.1 (Level A)** requirement, not a decoration: color must never be the sole carrier of meaning (E-2). Today a red/green deficit reader cannot tell a confirmed booking from a cancelled one.

Every status must be declared in one map:

```
BookingStatus  -> ON_HOLD: warning · PENDING: warning · CONFIRMED: success
                  · CANCELLED: danger · COMPLETED: neutral
PaymentStatus  -> ...
TourStatus     -> DRAFT: neutral · LIVE: success · PAUSED: warning · ARCHIVED: neutral
SpotlightState -> ...
```

**Acceptance: after this lands, `grep -E "(bg|text|border)-(amber|emerald|green|red|rose|sky|violet|blue)-[0-9]" components/` returns zero.** That is the test. Adding `StatusBadge` without deleting the 149 call sites reproduces the codebase's central failure (see 01 §Summary).

### 5.2 Forms

| Property | Spec |
|---|---|
| Input height | 36px default, 32px compact |
| Input font | **`--text-base` (16px)** |
| Radius | `--radius-sm` |
| Border | `--color-line`; focus -> 2px `--focus-ring` outline, offset 2 |
| Label | `--text-sm`, `font-medium`, `--content` |
| Helper | `--text-xs`, `--content-muted` |
| Error | `--text-xs`, `--danger-fg`, **with an icon** (not color alone) |
| Required | explicit `*` **and** `aria-required` |
| Disabled | `opacity-60` + `cursor-not-allowed` |

> **Why 16px inputs when the body is 14px:** iOS Safari force-zooms the viewport on focus of any input
> below 16px. Every operator on an iPad hits this today at 12px. This is the one place where a larger
> size is a functional requirement, not a preference.

### 5.3 Tables

**One `DataTable`.** Ten tables currently hand-roll `useReactTable` + `flexRender` + toolbar + pagination (G-3), while an 813-line generic `data-table.tsx` sits unused with zero importers (F-2). The abstraction existed; nobody adopted it. The replacement must be adopted **by deleting the forks in the same change** (05).

| Property | Spec |
|---|---|
| Header | `--text-2xs`, uppercase, `--tracking-caps`, `--content-muted`, sticky, 36px |
| Row | 44px comfortable / 32px compact; `hover:bg-surface-sunken`; `--line-subtle` divider |
| Zebra | none - dividers only. Zebra plus hover plus selection is three competing signals. |
| Numeric | right-aligned, `--font-mono`, tabular-nums |
| Selection | checkbox column, header select-all, bulk bar on `count > 0` |
| Pagination | **server-side only.** The three client-paginated tables (collections, attributes, spotlight) are inconsistent and also the three with **no loading skeleton at all**. |
| Loading | skeleton rows matching the real row height and column count |
| Empty | icon + one-line title + one-line explanation + primary action |
| Error | inline, with retry |
| Page sizes | `[10, 25, 50, 100]`, declared **once** (currently redeclared per table) |

### 5.4 Disclosure - adopt the sheet

`ui/sheet.tsx` and `ui/drawer.tsx` are both installed and **neither is used anywhere** (C-7). All 21 disclosure sites are centered modals. This is why `media-selector.tsx` is a `Dialog` styled `inset-0 w-screen h-screen` borderless - a dialog impersonating a route because the right primitive was never adopted.

| Pattern | Use for | Examples |
|---|---|---|
| **Sheet** (right, 480/640/800px) | inspect or edit a record without losing list context | booking details, payment details, quick-edit, media inspector |
| **Dialog** (centered, <=560px) | a focused decision that must interrupt | destructive confirm, password change |
| **AlertDialog** | destructive confirm **only** | delete, archive, cancel booking |
| **Popover** | lightweight pickers | date, column visibility |
| **Full route** | sustained multi-section work | tour editor, entity editors |
| **Inline expand** | a row's own detail | schedule rows |

**Rule:** `Dialog` and `AlertDialog` must stop being interchangeable for destructive confirms. Destructive -> `AlertDialog`, always.

### 5.5 Buttons

Retire the forced `uppercase tracking-widest text-xs` base (D-8, E-4).

| Variant | Spec |
|---|---|
| `primary` | `bg-primary text-primary-content`, hover `bg-primary-hover` |
| `secondary` | `bg-surface-raised border-line text-content` |
| `ghost` | transparent, hover `bg-surface-sunken` |
| `destructive` | **`bg-danger-solid text-n-0`** - a solid fill |
| `link` | `text-primary underline-offset-4` |

| Size | Height | Font |
|---|---|---|
| `sm` | 32px | `--text-sm` |
| `md` (default) | 36px | `--text-sm` |
| `lg` | 40px | `--text-sm` |
| `icon-sm` / `icon` | 32 / 36px square | |

Eight sizes collapse to five. Text is sentence case at 14px.

> **`destructive` becomes a solid fill again.** Today it is a tinted `bg-destructive/10 text-destructive`,
> which reads as a *secondary* action. "Delete tour" should not look quieter than "Save".

### 5.6 Cards, navigation, feedback

**Card:** `bg-surface-raised border border-line rounded-lg shadow-xs`, `p-4`/`p-6`. Header = `--text-lg` title + optional `--text-sm` `--content-muted` description. **No nested cards** - a card inside a card is a section; use a `--line-subtle` divider.

**Sidebar:** `--sidebar` bg, 240px expanded / 56px collapsed, groups by `--text-2xs` uppercase labels, active item = `bg-sidebar-active text-sidebar-active-content` **plus a 2px leading indicator** (not color alone). Persisted collapse.

**Toasts (sonner):** success 3s, error **sticky until dismissed** (an operator must not miss a failed save), position bottom-right, max 3 stacked. Every toast carries an icon.

**Empty states:** icon (`size-8`, `--content-subtle`) + `--text-sm font-medium` title + `--text-xs --content-muted` explanation + primary action. Currently each of the 10 tables hand-writes its own (G-3).

**Loading:** skeletons must mirror the real layout's dimensions. Never a spinner for page-level loads.

### 5.7 Icons

**lucide-react only.** Remove `@hugeicons/react` and `@hugeicons/core-free-icons` (D-7: 14 files, 7 of them the media module).

| Context | Size |
|---|---|
| Inline with `--text-sm` | `size-4` (16px) |
| Buttons | `size-4` |
| Micro / badge dots | `size-3` |
| Empty states | `size-8` |

Decorative icons: `aria-hidden="true"`. Icon-only buttons: `aria-label` **required**.

---

## 6. shadcn inventory

| Component | Action | Note |
|---|---|---|
| `badge.tsx` | **REPLACE** | -> `StatusBadge` (§5.1). The de-chromed base is the root of D-1. |
| `button.tsx` | **EXTEND** | Drop forced uppercase/tracking; 8 sizes -> 5; solid `destructive`. |
| `table.tsx` | **EXTEND** | Keep; retarget header to `--text-2xs` + `--tracking-caps`. Already token-clean. |
| `sidebar.tsx` | **EXTEND** | **Fix the `hsl(var(--sidebar-border))` bug at `:478`** (B-4) - it wraps oklch tokens in `hsl()` and renders nothing. |
| `chart.tsx` | **EXTEND** | Replace the `#ccc`/`#fff` THEMES literals with tokens; wire the 6-hue ramp. |
| `sheet.tsx` | **ADOPT** | Installed, unused. Becomes the standard secondary-disclosure primitive (§5.4). |
| `input`, `label`, `field`, `textarea`, `checkbox`, `select`, `card`, `tabs`, `dialog`, `alert-dialog`, `dropdown-menu`, `popover`, `tooltip`, `skeleton`, `separator`, `collapsible`, `command`, `calendar`, `avatar`, `sonner` | **AS-IS** | Re-token only. |
| `multi-select.tsx` | **STANDARDIZE** | Custom, not a shadcn primitive. Keep (9 consumers), align to the token system. |
| `progress.tsx` | **KEEP** | 0 importers today, but the translation console (04) needs completeness bars. |
| `breadcrumb.tsx` | **RESOLVE** | Two implementations: `ui/breadcrumb.tsx` (0 importers) and `dashboard/breadcrumb.tsx` (live). Pick one. |
| `drawer.tsx` | **DROP** | Vaul. Only consumer was the dead `data-table.tsx`. `sheet` covers the need. |
| `toggle.tsx`, `toggle-group.tsx` | **DROP** | Transitive-only to dead files. |
| `input-otp.tsx` | **DROP** | Public site only. |
| `input-group.tsx` | **REVIEW** | Transitive via `command`. Keep if `command` needs it. |

### Dependencies removed

`@hugeicons/react`, `@hugeicons/core-free-icons`, `vaul` (drawer), `@dnd-kit/*` **only if** drag-drop reorder is not adopted - but 04 recommends adopting it (C-5), so **keep `@dnd-kit`** and finally use it for something other than dead code.

### Fonts

Five families load on every route; DM Sans has **1** usage and General Sans **3** (D-6).

**Decision: one family, Inter Variable, plus JetBrains Mono for numerics.**

| Font | Action |
|---|---|
| Inter Variable | **ADD** - one variable file, the full weight range |
| JetBrains Mono | **KEEP** - 21 usages; correct for refs, IDs, money |
| Playfair Display | **DROP** - a high-contrast editorial display serif, 70 usages, in an operational CRM |
| DM Sans | **DROP** - 1 usage |
| General Sans | **DROP** - 3 usages, and it is a **local woff2 + italic** downloaded for them |
| Noto Sans | **DROP** - replaced by Inter as the body default |

Five families to two. Cross-charging between the two apps ends with the split.

---

## 7. Motion

Reuse the public site's proven constraints - they are already codified and correct:

- **No `whileHover` motion.** No scale-ups, lifts or nudges. Hover is a color/opacity CSS transition, full stop.
- **Press is `whileTap` scale DOWN** (0.97 for buttons).
- Durations from tokens: `--duration-fast` (hover/focus), `--duration-normal` (disclosure), `--duration-slow` (route/sheet).
- `prefers-reduced-motion: reduce` -> all transitions to 0.01ms. **Mandatory**, not optional.

A CRM is not a place for delight animation. Motion here has one job: explain where a thing came from.

---

## 8. Enforcement

A design system that is not lintable is a suggestion. The audit's central lesson (01 §Summary) is that this codebase's failure mode is **un-adopted abstractions**, so enforcement is not optional garnish.

| # | Rule | Mechanism |
|---|---|---|
| 1 | No numeric Tailwind palette classes (`bg-amber-100`, `text-emerald-700`, ...) | ESLint `no-restricted-syntax` on className regex. **Catches all 187.** |
| 2 | No hex / `rgb()` / `hsl()` / `oklch()` in components | Same. Catches the 12 hex + the `#1a0dab` x5. |
| 3 | No inline `style={{}}` except TanStack column sizing | ESLint with an allowlist |
| 4 | Spacing restricted to `0.5,1,`**`1.5,`**`2,`**`2.5,`**`3,4,6,8,12,16` | ESLint regex on `(p\|px\|py\|m\|gap\|space-[xy])-` |
| 5 | No arbitrary `text-[...]` | ESLint. Catches all 55. |
| 6 | Uppercase only at `--text-2xs` | Review |
| 7 | Every icon-only button has `aria-label` | `eslint-plugin-jsx-a11y` |
| 8 | Contrast gate | §9 |

Rules 1-5 are mechanical and should land **with** the token system, in the same phase. A migration that introduces tokens without the lint that forbids the alternatives will regrow the 187 classes within a quarter.

> **AMENDED 2026-07-17 (user decision, during 06 Phase 10): the spacing scale gains `1.5` (6px) and
> `2.5` (10px).** The original scale was authored without measuring. `1.5` is used **128 times** -
> the **third most-used spacing value in the codebase**, ahead of `8`. With `2.5` (47) that was ~60%
> of all spacing violations. That is not drift to be corrected; it is a scale missing a step it
> genuinely needs. Adding both dropped rule 4 from **232 warnings to 95**, and what remains (`5`,
> `3.5`, `10`, `7`, `9`...) is real drift worth fixing.
>
> **The `SPACING` regex in `eslint.config.mjs` and the `--spacing-*` tokens in `globals.css` are the
> same decision expressed twice - change them together or the lint stops matching the system it
> exists to protect.**
>
> Rules 1-5 landed **before** the token system, not with it, as `warn` (06 Phase 10). §10 of this
> document already ordered lint first and it was the right call: the measurement above is only
> available *because* the lint ran first, and it corrected the scale before a single token was
> written.

---

## 9. Accessibility gate

> **Everything in §2 is a design target. None of it is a compliance claim.** No contrast was measured
> during Phase 0-3, and `01-AUDIT-REPORT.md` §E states the same caveat. Shipping a palette because its
> lightness values look right is how the current dark mode happened.

**Merge gate for the token system:**

| # | Check | Standard |
|---|---|---|
| 1 | `--content` on `--surface` | >= 7:1 (AAA - it is the default text pairing, worth the headroom) |
| 2 | `--content-muted` on `--surface` | >= 4.5:1 |
| 3 | `--content-subtle` on `--surface` | >= 4.5:1 |
| 4 | Every `{state}-fg` on its `{state}-subtle` | >= 4.5:1 |
| 5 | `--primary-content` on `--primary` | >= 4.5:1 |
| 6 | `--focus-ring` on `--surface` and on `--surface-raised` | >= 3:1 |
| 7 | ~~`--line` on `--surface`~~ **`--line-control` on `--surface` and `--surface-raised`** | >= 3:1 - **AMENDED, see below** |
| 8 | All of 1-7 **in both modes** | |
| 9 | chart-1 vs chart-2 under deuteranopia and protanopia | distinguishable in a simulator |
| 10 | Every `StatusBadge` variant carries a **non-color** cue | WCAG 1.4.1 Level A |

**Any value failing its target is adjusted here, before implementation - not after.**

> ### MEASURED 2026-07-17 (06 Phase 11). The gate ran RED and caught two defects in §3's own palette.
>
> This section worked exactly as intended. Both fixes are user-approved and are in `globals.css` and
> `scripts/contrast-gate.mjs` (`pnpm gate:contrast`, exits non-zero on failure).
>
> **1. §3's `--content-subtle` is unfixable as written - `n-500` in BOTH modes.** Light needs
> `L <= 0.556` for 4.5:1 on `n-25`; dark needs `L >= 0.567` for 4.5:1 on `n-1000`. **The windows do
> not overlap.** Measured light `n-500` = **4.10:1 FAIL**. Every other content token already differs
> by mode; only this one was shared. **`--color-n-550` (`oklch(0.55 0.014 250)`) added for light
> (4.64:1); dark keeps `n-500` (4.75:1).**
>
> **2. Check 7 was testing the wrong token and could not be passed.** `--line` on `--surface` is
> **1.29:1** light / **1.39:1** dark; `--line-strong` is 1.56 / 2.03. Reaching 3:1 forces `L = 0.658`
> - a near-black hairline around every card, row and input. This section's own qualifier ("where it
> carries meaning") is the resolution: **WCAG 1.4.11 applies only where the boundary is the ONLY
> thing identifying a control.** `--line` and `--line-strong` are decorative and carry **no** target.
> New **`--line-control`** (light `--color-n-450` = **3.09:1**, dark `oklch(0.50 0.014 250)` =
> **3.39:1**) is the tested token, and the shadcn `--input` alias points at it.
>
> **Also fixed:** `--warning-foreground` was inherited as near-white on `oklch(0.769)` amber and had
> never passed contrast. It is dark ink now.
>
> **Not measurable here, still open:** check 10 (every `StatusBadge` variant carries a non-color cue)
> is **Phase 12's** gate - it is a component contract, not a color value.

And the honest note carried forward from 01 §E: a real audit (axe, keyboard sweep, screen reader, focus order) has **not** been run. This gate covers color only. The full audit is a scoped task in `06`.

---

## 10. Impact vs effort

| # | Item | Impact | Effort | Ratio | Closes |
|---|---|---|---|---|---|
| 1 | **`StatusBadge` + semantic token quartets** | 5 | 2 | **2.5** | D-1, E-2, most of D-4 |
| 2 | Token system + `@theme` | 5 | 3 | 1.7 | D-2, D-3, D-5, B-3, B-5 |
| 3 | Lint rules (§8) | 4 | 1 | **4.0** | Prevents regrowth of all of the above |
| 4 | Fonts 5 -> 2 | 3 | 1 | **3.0** | D-6, F-6 |
| 5 | Icons: drop hugeicons | 2 | 1 | 2.0 | D-7 |
| 6 | Type scale + 14px body | 4 | 3 | 1.3 | C-11, E-1 |
| 7 | One `DataTable` | 4 | 4 | 1.0 | G-3, F-2 |
| 8 | Adopt `sheet` | 3 | 2 | 1.5 | C-7 |
| 9 | Button de-shouting | 2 | 2 | 1.0 | D-8, E-4 |
| 10 | Fix `sidebar.tsx` `hsl()` | 1 | 1 | 1.0 | B-4 |

**Order: 3, 1, 4, 5, 2, 8, 6, 7, 9, 10.** Lint first - it is the cheapest item and it is the only one that stops the problem coming back.
