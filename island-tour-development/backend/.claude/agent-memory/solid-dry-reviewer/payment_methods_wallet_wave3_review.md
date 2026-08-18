---
name: payment-methods-wallet-wave3-review
description: Wave-3 review (2026-08-17) of the wallet sheet + loading skeletons across island-tour-development (backend+frontend) and the dashboard - CRITICAL tsc failure in a test file, MAJOR contradictory wallet-guide copy when inactive; nested-Elements pattern confirmed safe
metadata:
  type: project
---

Reviewed 2026-08-17: uncommitted wave-3 diff adding the Apple Pay/Google Pay wallet
button (Stripe Express Checkout Element) to checkout, plus per-provider settings-board
skeletons. Backend `npx jest src/payments/payments.service.spec.ts` 63/63 green, frontend
`vitest run` (checkout-payment + reserve-and-pay) 46/46 green, dashboard `vitest run`
(payment-methods-board) 17/17 green. Backend + dashboard `tsc --noEmit` clean.

**CONFIRMED CRITICAL (frontend, unfixed) - `tsc --noEmit` FAILS on
`checkout-payment.test.tsx:272`:** `expect(eceProps.current?.options.paymentMethods)` -
`eceProps` is a `vi.hoisted(() => ({ current: null }) as { current: Record<string, any> |
null })` ref the mocked `ExpressCheckoutElement` writes its props into. The test does
`eceProps.current = null; renderPanel(); expect(eceProps.current?.options...)`. TypeScript's
control-flow narrowing on a MUTABLE OBJECT PROPERTY (as opposed to a local variable) is NOT
invalidated by the intervening `renderPanel()` call (a documented TS limitation - it can't see
that rendering indirectly reassigns `eceProps.current` via the mock closure), so `current`
stays narrowed to literal `null` at the `expect` line; optional-chaining `.options` on a value
narrowed to EXACTLY `null` (not a union) collapses the non-nullish branch to `never`, and
indexing `.options` on `never` is a hard compiler error ("Property 'options' does not exist on
type 'never'") - NOT silently swallowed by `?.` the way you'd expect. Reproduced in isolation
(minimal repro file) to confirm the mechanism, then verified the fix in place and reverted:
changing that one line to `eceProps.current!.options...` (non-null assertion) makes `tsc
--noEmit` pass clean. This is exactly the pattern the OTHER 3 new wallet tests in the same
`describe` block already use (`eceProps.current!.onClick(...)`, `eceProps.current!.onConfirm()`)
- only this first test used `?.` instead, inconsistently. **How to apply:** whenever a test in
this codebase uses a `vi.hoisted` mutable ref (`{current: T | null}`) to capture a mocked
component's props and resets it with a literal `= null` before a re-render, always read it back
with `!` (non-null assertion), never `?.` - `vitest run` will NOT catch this (no type-checking),
only `tsc --noEmit` will, so always run tsc on frontend test-file diffs, not just the test
runner. See [[operator_conditions_wave3_review]] for the standing "check tsc AND test-runner,
both, every wave" bar.

**CONFIRMED MAJOR (dashboard, unfixed) - inactive wallet rows show self-contradicting guide
copy:** `lib/settings/payment-method-guides.ts` - `applepay`/`googlepay`'s NEW `walletGuide.STRIPE`
arrays both open with a state-specific reassurance line ("Active means Apple/Google Pay is
already activated... nothing to buy or request") written for the ACTIVE-only display case.
`components/settings/payment-methods-board.tsx:307-311`'s merge ternary, when the wallet is
INACTIVE, concatenates `[...(steps ?? []), ...(walletSteps ?? [])]` - i.e. the FULL walletSteps
array (including that "already activated" opener) gets appended AFTER the activation
instructions. Net effect for an inactive Apple Pay row: "1) enable Apple Pay under Wallets. 2)
register the domain in Payment method domains... [then] 3) Active means Apple Pay is already
activated - nothing to buy or request. 4) One-time setup: register the public site domain...
(near-verbatim repeat of step 2). 5) The button appears automatically..." - contradictory
("already activated" right after telling them how to activate it) AND redundant (domain
registration stated twice, once from the pre-existing `PAYMENT_BRANDS` brand-guide, once from
the new walletGuide). Confirmed this is STRIPE-only: Mollie's applepay `walletGuide.MOLLIE` has
no such opening line, so Mollie doesn't have this bug. No test catches it (the one new test that
touches this merge only asserts `getAllByText(/Payment method domains/i).length >
0`, not exact content/order - see MINOR below). Fix: split the state-dependent opener out of
`walletGuide` into its own field (e.g. `walletActiveNote?: Partial<Record<PaymentProvider,
string>>`, shown ONLY in the active branch) so the inactive-merge only ever appends the
state-independent "how it works" bullets. No fix applied - flagged for a future round.

**CONFIRMED MINOR (dashboard test) - loose assertion:** the "Apple Pay guide names the one-time
domain registration" test asserts `.length).toBeGreaterThan(0)` despite the test's own comment
stating the line "can legitimately appear twice" - should assert `.toHaveLength(2)` to actually
lock in the behavior (and it would still have passed even with the MAJOR content bug above,
since count alone doesn't check WHICH lines or their order).

**Verified SAFE / no defect (focus item 1 - nested Elements groups in checkout-payment.tsx):**
the outer secretless `<Elements>` (split Card Elements + imperative `confirmCardPayment`) and
the inner `<Elements stripe={stripePromise} options={{clientSecret, locale}}>` (wrapping
`WalletExpressRow`, needed because `ExpressCheckoutElement` requires a clientSecret/mode group)
sharing one `stripePromise` is confirmed safe and Stripe-documented via Context7 docs +
react-stripe-js@6.8.0 source (`node_modules/@stripe/react-stripe-js/dist/react-stripe.js`):
`useElements`/`useStripe` resolve to the NEAREST ancestor `<Elements>` (plain React context), so
`WalletExpressRow`'s `stripe.confirmPayment({elements, ...})` correctly targets the wallet
(clientSecret) group, never the card group. Each `<Elements>` instance creates its own
`stripe.elements(options)` exactly once (guarded), so two providers off one Stripe instance is
fine. Also verified the inner group's un-memoized `{clientSecret, locale}` literal (unlike the
outer group's `useMemo`'d options) causes no thrash: the library diffs `options` by VALUE
(`isEqual`) against the previous render, not by reference, and `clientSecret` is a declared
`immutableKey` (warns only if the VALUE changes, which it never does here) - so the missing
`useMemo` is a pure style inconsistency, not a bug.

**Verified correct-but-verbose (focus item 3):** `payments.service.ts:340-344`'s
`walletMethods` filter - `(w) => (enabledMethods.length === 0 || enabledMethods.includes(w)) &&
(enabledMethods.length === 0 || enabledMethods.includes('card'))` - is logically equivalent to
`allOn || (includes(w) && includes('card'))` (boolean distribution) and is fully correct
(confirmed via the new test pair covering: empty-config all-on, own-switch-off exclusion, and
card-off overriding an explicitly-on wallet switch). Proposed cleanup: extract `const
methodEnabled = (key) => enabledMethods.length === 0 || enabledMethods.includes(key)`, then
`walletMethods: methodEnabled('card') ? WALLETS.filter(methodEnabled) : []` - turns the "wallets
need card too" rule into an explicit guard instead of a repeated fragment.

See also [[payments_admin_method_switch_review]] (wave 2, the admin per-method switch this wave
builds on) and [[operator_conditions_wave3_review]] (prior wave's tsc/test-parity review bar).
