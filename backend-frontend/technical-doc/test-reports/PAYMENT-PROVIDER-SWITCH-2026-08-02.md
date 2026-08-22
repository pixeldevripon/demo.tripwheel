# Payment provider switch - collect credentials in the confirm dialog (2026-08-02)

**Request:** the payment settings switcher already shows a confirmation modal; when the target
provider is missing a required field (API key, client secret, or anything else it needs to be
activated), that should also arrive **as the modal** - taking the values with the admin's
consent, saving them, and switching - instead of failing into a toast.

| # | Change | Where |
|---|---|---|
| 1 | Activation gate names every missing credential, and now includes Stripe's publishable key | backend |
| 2 | Shared requirements descriptor, mirrored from the backend gate | dashboard |
| 3 | One activation path: save credentials, then switch | dashboard |
| 4 | Confirm dialog gained a collect mode | dashboard |
| 5 | "Configured" badge reads the real requirement list | dashboard |
| 6 | **Browser autofill was writing the admin's own login into the credential fields** | dashboard |

---

## 1. What was wrong

Toggling to a provider that was missing a credential sent the switch anyway, the backend
refused it with a 400, and the dashboard showed the message as a toast. The toggle offered an
action it then declined - and the only way forward was to leave the dialog, find the field in
the card below, save it, and come back to re-toggle.

Two smaller faults sat behind it.

**The gate was incomplete.** It required Stripe's `secretKey` and `webhookSecret` but not the
`publishableKey`. The checkout mounts Stripe.js with that key and bails when the intent comes
back without one (`checkout-form.tsx`), so a Stripe holding only the server-side pair passed
the gate and still could not take a card - the exact outcome the gate exists to prevent.

**The badge disagreed with the gate.** `ConnectionStatus` keyed off `secretKey` alone, so a
card could read "Configured" while the switch refused it.

## 2. What changed

### Backend - `settings.service.ts`

`missingProviderCredentials(provider)` is now the single authority and returns the gaps as
labels:

| Provider | Required |
|---|---|
| Stripe | `publishableKey`, `secretKey`, `webhookSecret` |
| Mollie | `apiKey` |

Mollie's `profileId` is deliberately not required - empty means the hosted page rather than the
inline card form, which is a working checkout.

The 400 now names **every** gap in one message ("Configure the Stripe publishable key, secret
key and webhook secret before ..."). Discovering the third missing field on the third attempt
is not a gate doing its job.

### Dashboard

**`lib/settings/payment-requirements.ts`** (new) mirrors that table - labels, placeholders,
which are secret, and where to find each one - plus `missingProviderFields()`, which reads the
GET responses the page already has cached, so it costs no extra request. Secrets come back
masked; a masked string is proof one is stored, which is all this needs. It returns every
requirement while the config is still loading, so a switch is never waved through on missing
data.

**`useActivateProvider()`** replaces `useUpdatePaymentProvider` so there is exactly one
activation path. It saves the collected credentials, then flips the provider, then invalidates
all three query keys (the provider config caches are stale too - the masked hints read from
them) and fires **one** toast.

Order matters: credentials are saved **first**. They are worth keeping on their own, so if the
switch then fails the admin retries the toggle rather than retyping their keys, and checkout
was never pointed at a provider that could not charge. The reverse order has no safe midpoint.

**The dialog** now has two modes. Ready is the old plain confirmation. Incomplete asks for
exactly the missing fields, with a title and body that say what is happening, and a
"Save and switch to X" action. Its zod schema is built from the gaps, so it is exactly as
strict as the gap, and values are trimmed - a key that is only whitespace passes a bare
`.min(1)` and then fails for looking configured.

Two details that carry weight:

- The action is a **plain submit button, not `AlertDialogAction`**. That primitive closes the
  dialog on click, which would throw away typed keys the moment validation or the request
  failed. The dialog now closes only on success.
- It is **keyed by target**, so it remounts per provider and a key typed for one can never be
  submitted to the other.

## 3. The autofill fault, found while verifying

Opening the collect dialog in a real browser, Chrome had already filled both fields:

```
publishableKey  value: "admin@islandtours.com"   autofilled: true
webhookSecret   value: "bestPassw0rd"            autofilled: true
```

A dialog holding one text input and one password input reads to Chrome as a login form, so it
offered the admin's **own email and password** as the Stripe credentials. One click of "Save
and switch" would have encrypted and stored them as real keys.

The same fault was already live on the settings cards themselves - the screenshot attached to
the request shows `admin@islandtours.com` sitting in Mollie's Profile ID, which is autofill,
not stored data. There it is worse: a blank secret means "keep the current one", so a silently
filled one means **replace it**, and one Save would overwrite a live credential with a
password.

`autocomplete="off"` does **not** prevent this on a password input when the browser holds a
saved login for the site - measured, not assumed: the webhook field carried `off` and was
filled anyway. Only `autocomplete="new-password"` is honoured as "do not fill this".

Fixed across the whole payments screen: `off` on the text fields, `new-password` on the
secrets, `autoComplete="off"` on the dialog form. Re-measured after: every field empty,
`autofilled: false`.

`instagram-form.tsx` carries a prior comment preferring `off` over `new-password` for API
credentials, on the grounds that `new-password` invites the password-manager UI to write into
the field. That reasoning is sound but the trade goes the other way here: an offer to save is a
prompt the admin can dismiss, silent injection of the wrong value is not. That surface was left
alone as out of scope - the finding is recorded here for whoever revisits it.

## 4. Verification

Exercised in the running dashboard against a real Stripe row with two of three fields cleared
(backed up first, restored byte-identical after - `diff` confirms).

| Check | Result |
|---|---|
| Badge with an incomplete Stripe | "Not configured" (was "Configured") |
| Dialog fields offered | Publishable Key + Webhook Secret only - the stored secret key was not asked for |
| Submit with both empty | Dialog stays open, both fields flagged required, no request sent |
| Pasted key with surrounding spaces | Stored trimmed |
| Webhook secret | 26 chars in, 110 stored - encrypted |
| Secret key after the switch | 272 chars, untouched |
| `activeProvider` | `STRIPE` |
| Toast | One, "Stripe is now taking checkout payments" |
| Masked hints after save | Refreshed, so the config caches were invalidated |
| Ready path (switch back to Mollie) | Zero inputs, "Switch to Mollie", switched |
| Autofill, after the fix | Every field on both cards and the dialog empty, `autofilled: false` |

Backend suite **2461 tests / 106 suites green**, including 5 new gate tests (all three
credentials present; each of publishable key and webhook secret missing; all three missing in
one message; no config row at all). `tsc --noEmit` clean in backend and dashboard; `eslint`
clean on every changed file.

Database left exactly as found: `activeProvider = MOLLIE`, Stripe row identical to the
pre-test backup.

## 5. Files

**Backend** - `settings.service.ts` (gate + `formatList`), `settings.swagger.ts`,
`settings.service.spec.ts`.

**Dashboard** - `lib/settings/payment-requirements.ts` (new), `hooks/settings/use-settings.ts`,
`components/settings/payments-form.tsx`, `components/settings/settings-fields.tsx`
(`autoFocus` + `autoComplete` on `TextField`, `autoFocus` on `SecretField`).

**Docs** - `02-architecture/BOOKING-AND-PAYMENTS.md` §8, "The active PSP and its activation
contract".
