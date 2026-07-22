# The Review System, End to End

> Plain-language walkthrough of the whole review module: what it does, who can do
> what, and why each rule exists. No code, no jargon.
>
> Companions: `REVIEW-MODULE-REQUIREMENTS.md` (what the client asked for) ·
> `REVIEW-MODULE-PLAN.md` (gap register) · `REVIEW-MODULE-CHECKLIST.md` (live
> build state, task by task).

---

## The big idea

There are **two separate kinds of reviews**, and they never mix:

1. **Tour reviews** - about a specific tour. These are yours, stored in your
   database, shown on tour pages.
2. **Platform reviews** (Trustpilot) - about *booking with Island Tours*: the
   payment, the support, the website. These live on Trustpilot and only ever
   appear on the homepage/footer, **never on a tour page**.

Mixing them would be misleading - "4.8 stars" would mean two different things.
So they're kept apart by design.

Everything below is about **layer 1**, the tour reviews. Layer 2 (Trustpilot)
isn't built yet.

---

# Part 1 - How a review gets created

## The golden rule

> **You cannot review a tour unless you booked and paid for it.**

There is no "write a review" form anywhere on the website. No login page leads to
one. The *only* way a review can exist is through a private link tied to one
specific booking.

That's why every review can honestly say "Verified booking" - it's not a badge we
award, it's a description of the only door that exists.

## The three ways a guest reaches the review page

All three lead to the same place: `yoursite.com/en/review/{secret-token}`

**1. The email (the main way)**
After the tour, we email the guest a private link. This is designed to be the
main channel - someone who just had a great day out isn't going to hunt for a
review form.

**2. Their booking page**
If they come back and look up their booking, there's a "How was your tour? ->
Leave a review" box on it.

**3. Their account dashboard**
In the customer dashboard under "My Bookings", each eligible booking has a
"Leave a review" action.

Options 2 and 3 only appear when the booking genuinely qualifies - same rules the
system enforces on the back end, so the button can never offer something that
then gets refused.

## The email schedule (fully controlled from the dashboard)

**Settings -> Reviews tab.** Nothing is hardcoded:

| Setting | Default | What it means |
|---|---|---|
| **Send review requests** | **OFF** | Master switch |
| First send - days after tour | 1 | The morning after |
| First send - local hour | 10 | 10:00 **in the tour's own timezone** |
| Send one reminder | On | |
| Reminder - days later | 5 | |
| Give up after | 30 days | Stop chasing |
| Batch size per hour | 200 | |

**Three things worth understanding:**

**The switch is OFF right now.** A job that emails real customers should be turned
on deliberately by a person, not by deploying code. While it's off it does
*nothing* - it doesn't even create the invitations. So switching it on later
can't suddenly fire a backlog of stale emails at people who travelled months ago.

**Time is per island.** "The morning after at 10:00" is a different moment in
Curacao than in Sint Maarten. Each booking stores its own timezone, so the email
lands at 10am *local to that tour*.

**Two emails maximum, then silence.** The invite, one reminder, done. Never more.

## Who never gets asked

The system will not email someone about a tour that didn't happen. Cancelled,
expired, rejected, on-hold, still-pending bookings are all excluded. And if a
booking is cancelled *after* the invitation was created but before the email went
out, the invitation is revoked - the email never sends and the link dies.

## The review page itself

The link is **single-use, unguessable, and revocable**. There's no login - the
link *is* the credential. Unknown, already-used, and revoked links all show the
same "this link is no longer valid" message (so nobody can probe which links ever
existed).

The page is built as a series of steps that get progressively less demanding of
the guest:

**Step 1 - Tap a star.**
This is the whole review, if that's all they want to give. The moment they press
a star, **it's saved**. Someone who taps one star and closes the tab has still
left a countable review. This is deliberate - most people won't write an essay,
and a form that only counts when you submit at the end throws away the majority.

**Step 2 - Write something** (optional, saves on its own)

**Step 3 - Add photos** (optional, up to 8, uploaded straight from their phone)

**Step 3b - Who did you travel with?** (Couple / Family / Friends / Solo -
optional, one tap)

**Step 4 - "How was booking with us?"**
A separate, clearly different question about the *platform*, linking to
Trustpilot. Currently hidden because Trustpilot isn't set up yet.

## What happens on a bad score

If someone gives 3 stars or fewer, a private "sorry it missed the mark, tell us
what went wrong" box appears.

**This appears *in addition to* everything else - never instead.** Their public
review is still published, in full, exactly as written. Steps 2, 3 and 3b stay
open. The Trustpilot invitation (once configured) is still shown.

This matters a lot. Sending happy customers to a public review site and unhappy
ones to a private inbox is called **review gating**. It's illegal under EU
consumer law, it breaches Trustpilot's rules, and it's what Trustpilot itself was
fined 4 million euro over in Italy. The page tells the guest plainly: *"Your
review is published in full, whatever the score."*

---

# Part 2 - Moderation

Every review arrives as **Pending**. Nothing goes live automatically.

## The four states

| State | Meaning |
|---|---|
| **Pending** | Just arrived, waiting for a decision |
| **Approved** | Live on the tour page, counted in the rating |
| **Held** | "Needs a second look." Not published, not rejected, no black mark against the guest |
| **Rejected** | Not published. Requires a documented reason |

Pending is *entry only* - once a decision is made, a review can never be pushed
back to Pending. That stops someone quietly un-deciding something already in the
record.

## Why a review can be removed - the closed list

- Abuse, hate speech, threats, discrimination
- Personal data (a guide's full name, another guest, contact details)
- Spam or advertising
- Not about this tour (a review about the airline or the hotel)
- Illegal, or required to be removed by law

**"Negative" is not on that list, and the option doesn't exist in the
interface.** A moderator physically cannot select "this review is too critical"
as a reason. That's enforced in the software, not just in policy.

## The permanent record

Every single decision writes an audit row: who did it, when, what it changed from
and to, and why. Including deletions.

Deliberately, this record **survives the review being deleted**. (An earlier
version wiped the audit trail along with the review - which destroyed the very
evidence that a removal had happened.)

## Who can do what

| | Admin (Island Tours) | Operator |
|---|---|---|
| Read reviews of their own tours | yes | yes |
| Read *other* operators' reviews | yes | no |
| Approve / hold / reject | yes | no |
| Delete | yes | no |
| Write a response | yes | no (for now) |
| Flag one for review | yes | yes |

An operator **cannot remove or hide a bad review**. They can raise a flag and
Island Tours decides. In their dashboard, the approve/reject buttons aren't
greyed out - they simply aren't there, so nobody's tempted to ask for them.

---

# Part 3 - What a traveller sees on the tour page

This is where it gets interesting, because **what's shown depends on how many
reviews the tour has**. The reasoning is consistent: don't show a control that
can't tell the visitor anything useful.

## The thresholds

| Reviews | What appears |
|---|---|
| **0** | No review section at all. The tour just shows a "New" badge |
| **1-2** | The reviews themselves, but **no star rating number** |
| **3-9** | Rating + the star distribution chart (and each bar is clickable to filter) |
| **10-19** | The above + a sort control |
| **20+** | The above + filters: guest type, "with photos", language, and theme chips |

Why: sorting three reviews tells you nothing. A filter on a handful of reviews is
a dead end. Better to show nothing than a broken-feeling control.

## The "new tour" problem, and how it's handled

A brand new tour has zero reviews. Showing nothing makes it look untested;
inventing a rating would be a lie.

So: **if the tour has fewer than 3 reviews of its own, it may borrow its
operator's rating** - but only if that operator is genuinely established (10+
reviews averaging 4.0 or better).

And when that happens, **the page says so in plain words**:

> *"New on Island Tours. This tour is run by Miss Ann Boat Trips, rated 4.8
> across 39 reviews."*

Three important guardrails:

- The individual reviews shown are always **that tour's own** - never another
  tour's
- Tour cards in listings never borrow - they show the "New" badge instead
- The data given to Google **never** includes a borrowed rating (that would be
  telling search engines a product has 39 reviews when it has none - review
  fraud, in both Google's and the EU's eyes)

## What each review card shows

- Star rating
- Reviewer's first name + last initial only (never a full name)
- **"Verified booking"** badge, with an explanation on hover
- **When they travelled** - the month of the *tour*, not when they wrote the
  review
- **Who they travelled with** (if they told us)
- **Their photos, leading the card**, big enough to see, tap to enlarge
- The review text
- **"Translated by Google"** + a "show original" toggle, if you're reading it in
  a language they didn't write in
- Any published response

## Translation

A review written in Dutch is automatically shown in English (or German, French,
Spanish, Portuguese, Chinese) to whoever's reading. It's labelled as
machine-translated and one tap shows the guest's actual words.

Both versions are sent together, so the toggle is instant - and there's no
separate translated web page for search engines to index as duplicate content.

*This needs a Google Translate API key, which isn't set up yet. Without it,
reviews simply display in their original language.*

## Responses

Right now, **only Island Tours writes responses** - not operators. That's a
deliberate phase-one choice; operator-written responses (with moderation) are
planned but not switched on.

Rules:

- One response per review, **ever**. It can't be edited afterwards
- It's screened for abusive language
- It's labelled with **who actually wrote it** - "Island Tours" or the operator's
  name
- Posting one never hides, edits or reorders the review it answers

## The filters (on tours with 20+ reviews)

- **Star bars** - click "5 stars" to see only those. Click again to clear
- **Travelling as** - Couple / Family / Friends / Solo
- **With photos**
- **Written in** - the language the guest *wrote in* (i.e. "reviews from Dutch
  speakers"), not what you can read it in
- **Theme chips** - "Great guide", "Beautiful scenery", "Felt safe"...

Every filter option shows a count, and **only options that will actually return
something are offered**. You can never pick a filter and land on an empty page.

## Photos

If **3 or more different guests** posted photos, a photo strip appears at the top
of the section. Three or more *guests* - not three photos - because one person's
three snapshots aren't three opinions.

---

# Part 4 - How ratings are calculated

The number on a tour is the **plain average of every published review**, to one
decimal place. No weighting, no decay, no manual adjustment.

Ratings are stored on the tour for speed and recalculated automatically whenever
a review is approved, held, rejected or deleted. *(Verified: all 44 tours and 7
operators match a live recount exactly - zero drift.)*

Only **approved, first-party** reviews count. Pending, held, rejected, or
imported-from-elsewhere reviews are excluded from every total.

---

# Part 5 - The legal side

EU law (the Omnibus Directive) says that if you show consumer reviews, you must
state **whether and how** you check they're from real customers. Saying
"verified" on a badge isn't enough on its own.

So there's a page - **"How we handle reviews"** - linked directly from the reviews
section, covering:

1. Only guests with completed bookings can review
2. Everyone gets the same invitation, regardless of how their day went
3. We publish criticism - the only removal grounds are the closed list above
4. We never pay for reviews, and operators can't buy a better rating
5. How the average is calculated
6. **The one case where the rating isn't the tour's own** (the borrowed-rating
   situation)
7. How responses work
8. How to edit, delete, or report a review

---

# Part 6 - Where things stand

**Working and tested:**
Collection flow, review page, photo upload, moderation queue with audit trail,
all tour-page display and thresholds, filters, translation plumbing, structured
data for Google, the disclosure page, review analytics in the dashboard.

**Built but needs a key or a switch:**

| | What's needed |
|---|---|
| Post-tour emails | Turn the switch on in Settings -> Reviews |
| Translation | A Google Translate API key |
| Trustpilot | A real Trustpilot business account |

**Deliberately not built yet:**

- **Operator-written responses** - needs your decision. Worth thinking about:
  right now your team writes every reply, and that stops being practical as
  volume grows
- **AI review summaries** and **helpful votes** - both parked for version 2 by
  your master specification

---

## The one thread running through all of it

Almost every rule here comes back to the same idea: **don't show people something
that isn't true, and don't let anyone quietly make it untrue.**

That's why a review requires a real booking, why "negative" can't be a removal
reason, why deleting a review can't delete its audit trail, why an operator can't
touch their own reviews, why a borrowed rating is announced in words and withheld
from Google, why a machine translation says it's a machine translation, and why a
response is signed by whoever actually wrote it.
