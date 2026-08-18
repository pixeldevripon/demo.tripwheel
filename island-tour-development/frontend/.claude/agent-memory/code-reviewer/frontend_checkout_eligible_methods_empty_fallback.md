---
name: checkout-eligible-methods-empty-fallback
description: checkout-payment.tsx isEligible() treats an empty eligibleMethods list as "card only", not "all methods" - interacts badly with the backend admin-method-switch intersection
type: project
---

`components/frontend/checkout/checkout-payment.tsx` (~line 156-160):

```ts
const isEligible = (m: PayMethod) =>
    currencyAllows(m) &&
    (eligibleMethods.length === 0
        ? m === 'card'
        : eligibleMethods.includes(m));
```

This fallback exists for an "older/edge response" case (the intent didn't
report any methods at all) and defaults to card-only. Reviewed 2026-08-16
alongside the payment-methods-board admin per-method switch (Pastel wave 2,
backend `payments.service.ts` intersects `intent.payment_method_types` with
the admin's stored `paymentMethods[]`): if that intersection legitimately
computes to empty - e.g. because a dashboard bug lets an admin disable the
only PSP-active method while leaving several never-activated methods
"nominally on" (see the dashboard repo's `payment-methods-board.tsx`
last-method-off guard, which checks against the full toggleable key set
instead of the actually-active subset) - the checkout silently falls back to
showing Card as eligible regardless of whether card itself was the method the
admin just disabled, or whether it's even PSP-active. The traveller sees a
method that may not actually work, and the admin's real intent is masked with
no error anywhere in the chain.

**Why this matters for review:** an empty `eligibleMethods` array is now
ambiguous between two very different states - "no data" (the original edge
case this fallback was written for) and "the admin's config legitimately
resolves to nothing" (a real misconfiguration that should probably show an
error, not silently pick Card). If a future task touches this fallback or the
backend intersection logic again, treat a genuinely-empty intersected list as
worth surfacing distinctly rather than papering over with card-only.

**How to apply:** when reviewing checkout-payment.tsx or the backend
payment-method-switch code together, check whether this ambiguity has been
resolved (e.g. a distinct "no eligible method" state) before treating either
side's "empty list" handling as adequate on its own.
