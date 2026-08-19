import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/*
 * Design-system enforcement - spec 03 §8, landed by 06 Phase 10.
 *
 * Flipped to `error` at Phase 20 (2026-07-17) after the violation sweep -
 * the design system and dependency direction are now enforced, not advisory.
 *
 * `import` and `jsx-a11y` are already registered as plugins by
 * eslint-config-next/core-web-vitals, so their rules are referenced by name
 * with no direct dependency. Do not add one: under pnpm the transitive copy is
 * not resolvable from this file.
 */

// Rule 1 - numeric Tailwind palette classes. Substring match, so variants
// (`dark:`, `hover:`, `group-*:`) are caught too.
const PALETTE = String.raw`(?:bg|text|border|ring|ring-offset|from|via|to|fill|stroke|decoration|outline|shadow|accent|caret|divide|placeholder)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950)`;

// Rule 2 - raw color values. Hex is length-constrained to real CSS forms so
// `#` fragments and slugs do not trip it.
const RAW_COLOR = String.raw`(?:#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-fA-F])|(?:rgba?|hsla?|oklch|oklab|lch|lab)\()`;

// Rule 4 - spacing off the scale: 0.5,1,1.5,2,2.5,3,4,6,8,12,16.
// 1.5 and 2.5 were added to 03 §8's original scale by decision 2026-07-17:
// 1.5 (6px) is the 3rd most-used spacing value in the codebase (128 uses), so
// the scale was missing a step it genuinely needs. This list and the `--spacing-*`
// tokens in globals.css are the same decision - change them together.
// The trailing (?![\d.]) is load-bearing: a plain \b lets `p-3.5` pass by
// matching the allowed `3`.
const SPACING = String.raw`(?:^|[\s:'"])-?(?:px|py|pt|pb|pl|pr|ps|pe|p|mx|my|mt|mb|ml|mr|ms|me|m|gap-x|gap-y|gap|space-x|space-y)-(?!(?:0\.5|1\.5|2\.5|0|1|2|3|4|6|8|12|16|px|auto|full)(?![\d.]))\d`;

// Rule 5 - arbitrary type values. Matching the opening bracket is enough, and
// it avoids escaping `]` inside an esquery selector.
const ARBITRARY_TEXT = String.raw`(?:^|[\s:'"])text-\[`;

/**
 * Fires on plain strings and on template chunks. cva/cn/clsx arguments are
 * ordinary Literals, so this reaches them without a className selector.
 */
const designRule = (source, message) => [
  { selector: `Literal[value=/${source}/]`, message },
  { selector: `TemplateElement[value.raw=/${source}/]`, message },
];

const DESIGN_SELECTORS = [
  ...designRule(
    PALETTE,
    "03 §8.1: no numeric Tailwind palette classes. Use a semantic token (StatusBadge for status color).",
  ),
  ...designRule(
    RAW_COLOR,
    "03 §8.2: no hex/rgb/hsl/oklch literal in a component. Every color comes from a token in globals.css.",
  ),
  ...designRule(
    SPACING,
    "03 §8.4: spacing is restricted to 0.5,1,1.5,2,2.5,3,4,6,8,12,16.",
  ),
  ...designRule(
    ARBITRARY_TEXT,
    "03 §8.5: no arbitrary text-[...]. Use a step from the type scale.",
  ),
];

const NO_INLINE_STYLE = {
  selector: "JSXAttribute[name.name='style']",
  message:
    "03 §8.3: no inline style. Use a class; for a runtime value, set a CSS custom property.",
};

const COMPONENT_MODULES = [
  "attributes",
  "bookings",
  "categories",
  "collections",
  "destinations",
  "faq",
  "hubs",
  "locals-favourites",
  "login",
  "media",
  "onboarding",
  "operators",
  "payments",
  "profile",
  "settings",
  "shell",
  "spotlight",
  "trips",
];

// Not modules - the shared surface any module may import (05 §D3).
const SHARED_COMPONENTS = ["common", "ui", "providers", "skeletons", "data-table"];

const HOOK_DOMAINS = [
  "attributes",
  "bookings",
  "categories",
  "collections",
  "destinations",
  "faq",
  "hubs",
  "locals-favourites",
  "media",
  "operators",
  "payments",
  "profile",
  "settings",
  "tiers",
  "trips",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
      "react-compiler/react-compiler": "off",
      "@next/next/no-html-link-for-pages": "off",
      "react/no-unescaped-entities": "off",
    },
  },

  // ── Dependency direction (05 §D1-D5) ───────────────────────────────────
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            // D1 - lib/ never imports components/.
            {
              target: "./lib",
              from: "./components",
              message:
                "D1: lib/ must not import components/. Move the shared type into types/.",
            },
            // D2 - types/ imports nothing but types/.
            {
              target: "./types",
              from: "./components",
              message: "D2: types/ may only import types/.",
            },
            {
              target: "./types",
              from: "./hooks",
              message: "D2: types/ may only import types/.",
            },
            {
              target: "./types",
              from: "./app",
              message: "D2: types/ may only import types/.",
            },
            {
              target: "./types",
              from: "./lib",
              message:
                "D2: types/ may only import types/. Locale/Currency live in lib/constants today - move them to types/ in Stage D.",
            },
            // D3 - a module never reaches into another module.
            ...COMPONENT_MODULES.map((m) => ({
              target: `./components/${m}/**`,
              from: `./components/!(${[...SHARED_COMPONENTS, m].join("|")})/**`,
              message: `D3: components/${m}/ must not import another module. Shared UI goes to components/common/.`,
            })),
            // D4 - a hook domain reaches lib/api/<domain> and types/, nothing else.
            ...HOOK_DOMAINS.map((d) => ({
              target: `./hooks/${d}/**`,
              from: `./hooks/!(${d})/**`,
              message: `D4: hooks/${d}/ must not import another hook domain. Lift the shared key factory into lib/.`,
            })),
          ],
        },
      ],
      // D5 - the isolation test. Nothing from the public site, forever.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/components/frontend/*",
                "@/lib/api/public/*",
                "**/frontend/**",
              ],
              message:
                "D5: this repo is standalone. Public-site code must never be imported here.",
            },
          ],
        },
      ],
    },
  },

  // ── Design system (03 §8 rules 1-5, 7) ─────────────────────────────────
  {
    files: ["components/**/*.tsx", "app/**/*.tsx"],
    rules: {
      "no-restricted-syntax": ["error", ...DESIGN_SELECTORS, NO_INLINE_STYLE],
      // 03 §8.7 - an icon-only button must carry a label.
      "jsx-a11y/control-has-associated-label": [
        "error",
        {
          controlComponents: ["Button", "Toggle", "ToggleGroupItem"],
          depth: 5,
        },
      ],
    },
  },

  // ── Allowlist: TanStack Table column sizing (03 §8.3) ──────────────────
  // `style={{ width: header.getSize() }}` is the documented API for column
  // widths - there is no class-based equivalent. Only the inline-style rule is
  // lifted here; every color/spacing/type rule still applies.
  {
    files: ["components/**/*-table.tsx", "components/ui/chart.tsx"],
    rules: {
      "no-restricted-syntax": ["error", ...DESIGN_SELECTORS],
    },
  },
]);

export default eslintConfig;
