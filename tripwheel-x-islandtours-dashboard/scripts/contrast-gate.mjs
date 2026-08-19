// 03 §9 contrast gate. Measures, does not eyeball.
// oklch -> oklab -> linear sRGB -> gamma sRGB -> WCAG relative luminance.

const clamp01 = (x) => Math.min(1, Math.max(0, x));

function oklchToSrgb(L, C, H) {
    const h = (H * Math.PI) / 180;
    const a = C * Math.cos(h);
    const b = C * Math.sin(h);

    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.291485548 * b;

    const l = l_ ** 3,
        m = m_ ** 3,
        s = s_ ** 3;

    const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

    const enc = (c) => {
        c = clamp01(c);
        return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    };
    return [enc(lr), enc(lg), enc(lb)];
}

// WCAG relative luminance from gamma-encoded sRGB.
function luminance([r, g, b]) {
    const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(c1, c2) {
    const a = luminance(c1),
        b = luminance(c2);
    const [hi, lo] = a > b ? [a, b] : [b, a];
    return (hi + 0.05) / (lo + 0.05);
}

const parse = (s) => {
    const m = s.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
    if (!m) throw new Error('bad oklch: ' + s);
    return oklchToSrgb(+m[1], +m[2], +m[3]);
};

// ── VEGA RE-SKIN VALUES (2026-07-17) ────────────────────────────────────
// Mirrors app/globals.css exactly and MUST stay in lockstep with it.
// Colors: the gate-green Vega-tuned system (user decision after evaluating
// the raw preset: "keep the color as previous").
const N = {
    0: 'oklch(1 0 0)',
    25: 'oklch(0.9793 0.0083 271)',
    50: 'oklch(0.9555 0.0125 271)',
    100: 'oklch(0.9443 0.0165 275)',
    200: 'oklch(0.9142 0.0208 274)',
    300: 'oklch(0.8893 0.0169 262)',
    400: 'oklch(0.70 0.014 265)',
    450: 'oklch(0.62 0.014 265)',
    500: 'oklch(0.53 0.015 265)',
    600: 'oklch(0.47 0.015 265)',
    700: 'oklch(0.38 0.014 265)',
    800: 'oklch(0.28 0.012 268)',
    900: 'oklch(0.21 0.012 268)',
    950: 'oklch(0.15 0.009 272)',
    1000: 'oklch(0.10 0.006 275)',
};
const B = {
    50: 'oklch(0.97 0.018 214)',
    100: 'oklch(0.94 0.035 214)',
    200: 'oklch(0.88 0.06 214)',
    300: 'oklch(0.79 0.085 214)',
    400: 'oklch(0.70 0.10 214)',
    500: 'oklch(0.60 0.11 214)',
    600: 'oklch(0.52 0.11 214)',
    700: 'oklch(0.45 0.10 214)',
    800: 'oklch(0.37 0.08 214)',
    900: 'oklch(0.29 0.055 214)',
};

const light = {
    surface: N[50],
    'surface-raised': N[25],
    'surface-inset': N[200],
    content: N[900],
    'content-muted': N[600],
    'content-subtle': N[500],
    line: N[300],
    'line-control': N[450],
    primary: B[600],
    'primary-content': N[0],
    'primary-subtle': B[50],
    'primary-subtle-content': B[700],
    'focus-ring': 'oklch(0.48 0.20 260)',
    'success-subtle': 'oklch(0.95 0.02 150)',
    'success-fg': 'oklch(0.42 0.12 150)',
    'warning-subtle': 'oklch(0.96 0.02 75)',
    'warning-fg': 'oklch(0.44 0.12 75)',
    'danger-subtle': 'oklch(0.95 0.02 25)',
    'danger-fg': 'oklch(0.45 0.12 25)',
    'info-subtle': 'oklch(0.96 0.02 250)',
    'info-fg': 'oklch(0.45 0.12 250)',
    'chart-1': 'oklch(0.68 0.14 159.65)',
    'chart-2': 'oklch(0.37 0.18 325.25)',
    'chart-3': 'oklch(0.40 0.16 259.09)',
    'chart-4': 'oklch(0.43 0.16 259.85)',
    'chart-5': 'oklch(0.29 0.07 260.37)',
    'chart-6': 'oklch(0.60 0.11 190)',
    sidebar: 'oklch(0.972 0.006 268)',
    'sidebar-content': N[700],
    'sidebar-active': B[50],
    'sidebar-active-content': B[700],
};

const dark = {
    surface: 'oklch(0.09 0.005 280)',
    'surface-raised': 'oklch(0.14 0.006 280)',
    'surface-inset': 'oklch(0.21 0.009 278)',
    content: 'oklch(0.93 0.01 265)',
    'content-muted': 'oklch(0.71 0.02 261)',
    'content-subtle': 'oklch(0.64 0.018 262)',
    line: 'oklch(0.23 0.011 278)',
    'line-control': 'oklch(0.58 0.015 268)',
    primary: B[400],
    'primary-content': N[1000],
    'primary-subtle': B[900],
    'primary-subtle-content': B[200],
    'focus-ring': 'oklch(0.56 0.24 261)',
    'success-subtle': 'oklch(0.26 0.02 150)',
    'success-fg': 'oklch(0.80 0.12 150)',
    'warning-subtle': 'oklch(0.27 0.02 75)',
    'warning-fg': 'oklch(0.82 0.12 75)',
    'danger-subtle': 'oklch(0.26 0.02 25)',
    'danger-fg': 'oklch(0.80 0.12 25)',
    'info-subtle': 'oklch(0.27 0.02 250)',
    'info-fg': 'oklch(0.82 0.12 250)',
    'chart-1': 'oklch(0.69 0.16 156.32)',
    'chart-2': 'oklch(0.44 0.13 252.86)',
    'chart-3': 'oklch(0.69 0.17 256)',
    'chart-4': 'oklch(0.43 0.16 259.85)',
    'chart-5': 'oklch(0.29 0.07 260.37)',
    'chart-6': 'oklch(0.74 0.11 190)',
    sidebar: 'oklch(0.12 0.006 280)',
    'sidebar-content': 'oklch(0.71 0.02 261)',
    'sidebar-active': B[900],
    'sidebar-active-content': B[200],
};

// Sub-threshold pairs a user decision has explicitly accepted, as
// `MODE:checkId`. Reported as WAIVED; they do not fail the gate. Currently
// empty - the Vega-tuned values pass everything.
const ACCEPTED_EXCEPTIONS = new Set([]);

const checks = [
    ['1', 'content', 'surface', 7.0],
    ['2', 'content-muted', 'surface', 4.5],
    ['3', 'content-subtle', 'surface', 4.5],
    ['4a', 'success-fg', 'success-subtle', 4.5],
    ['4b', 'warning-fg', 'warning-subtle', 4.5],
    ['4c', 'danger-fg', 'danger-subtle', 4.5],
    ['4d', 'info-fg', 'info-subtle', 4.5],
    ['5', 'primary-content', 'primary', 4.5],
    ['6a', 'focus-ring', 'surface', 3.0],
    ['6b', 'focus-ring', 'surface-raised', 3.0],
    ['7a', 'line-control', 'surface', 3.0],
    ['7b', 'line-control', 'surface-raised', 3.0],
    // Not in §9's list but load-bearing: these pairings are on every screen.
    ['+1', 'primary-subtle-content', 'primary-subtle', 4.5],
    ['+2', 'sidebar-content', 'sidebar', 4.5],
    ['+3', 'sidebar-active-content', 'sidebar-active', 4.5],
    ['+4', 'content', 'surface-raised', 7.0],
    ['+5', 'content-muted', 'surface-raised', 4.5],
];

let failed = 0;
for (const [mode, tokens] of [
    ['LIGHT', light],
    ['DARK', dark],
]) {
    console.log(`\n─── ${mode} ${'─'.repeat(58)}`);
    for (const [id, fg, bg, min] of checks) {
        const r = contrast(parse(tokens[fg]), parse(tokens[bg]));
        const pass = r >= min;
        const waived = !pass && ACCEPTED_EXCEPTIONS.has(`${mode}:${id}`);
        if (!pass && !waived) failed++;
        const tag = pass ? 'PASS' : waived ? 'WAIVE' : 'FAIL';
        console.log(
            `  ${tag.padEnd(5)} ${id.padEnd(3)} ${(fg + ' on ' + bg).padEnd(42)} ${r.toFixed(2).padStart(6)}:1  (need ${min})${waived ? '  [user-accepted]' : ''}`,
        );
    }
}

// Check 9 - chart hues under dichromacy. Brettel/Viénot simulation is overkill;
// the operative question is whether two hues collapse. Compare luminance
// separation, which survives every dichromacy, plus simulated confusion.
console.log(`\n─── CHECK 9: chart hues under dichromacy ${'─'.repeat(33)}`);

// Viénot 1999 dichromat simulation matrices operate in linear RGB.
function toLinear([r, g, b]) {
    const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return [lin(r), lin(g), lin(b)];
}
function toGamma([r, g, b]) {
    const enc = (c) => {
        c = clamp01(c);
        return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    };
    return [enc(r), enc(g), enc(b)];
}
const SIM = {
    deuteranopia: [
        [0.625, 0.375, 0.0],
        [0.7, 0.3, 0.0],
        [0.0, 0.3, 0.7],
    ],
    protanopia: [
        [0.567, 0.433, 0.0],
        [0.558, 0.442, 0.0],
        [0.0, 0.242, 0.758],
    ],
};
const simulate = (srgb, m) => {
    const [r, g, b] = toLinear(srgb);
    return toGamma([
        m[0][0] * r + m[0][1] * g + m[0][2] * b,
        m[1][0] * r + m[1][1] * g + m[1][2] * b,
        m[2][0] * r + m[2][1] * g + m[2][2] * b,
    ]);
};

for (const [mode, tokens] of [
    ['LIGHT', light],
    ['DARK', dark],
]) {
    for (const [type, m] of Object.entries(SIM)) {
        const c1 = simulate(parse(tokens['chart-1']), m);
        const c2 = simulate(parse(tokens['chart-2']), m);
        const r = contrast(c1, c2);
        // >=1.3 luminance-contrast between adjacent series is the practical
        // floor for telling two bars apart without color.
        const ok = r >= 1.3;
        console.log(
            `  ${ok ? 'PASS' : 'WARN'}  ${mode.padEnd(5)} ${type.padEnd(14)} chart-1 vs chart-2 -> ${r.toFixed(2)}:1 separation`,
        );
        if (!ok) failed++;
    }
}

console.log(`\n${failed === 0 ? 'GATE GREEN - all checks pass' : `GATE RED - ${failed} check(s) failed`}\n`);
process.exit(failed === 0 ? 0 : 1);
