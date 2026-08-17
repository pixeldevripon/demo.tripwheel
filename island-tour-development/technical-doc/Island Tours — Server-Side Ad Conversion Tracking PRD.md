**PROJECT REQUIREMENTS DOCUMENT**  
**Island Tours — Server-Side Ad Conversion Tracking**

| Project Name | Island Tours — Server-Side Ad Conversion Tracking |
| :---- | :---- |
| **Prepared By** | Rezina |
| **Stakeholder** | Denley Felisie |
| **Date** | August 16, 2026 |
| **Platform** | island.tours booking platform |
| **Related Document** | Island Tours Conversion Tracking Proposal |

**Project Objective**  
Island Tours currently reports ad performance through Google Ads' own dashboards, which gives an incomplete and unverifiable picture of what paid campaigns actually return. This project replaces that generic, browser-only tagging approach with conversion events fired natively from the booking platform's server, so every event reflects real commission revenue and can be independently verified by the stakeholder in Google Ads, Meta, and GA4. This document defines what is being built, why, for whom, and how success will be measured. It is scoped to functional and non-functional requirements; commercial terms are covered separately.

**Problem Statement**

* Ad platforms currently optimize on generic or incomplete conversion signals rather than true booking economics (commission, not full tour price).  
* The stakeholder cannot independently verify what is happening beneath Google Ads reporting; existing agency relationships have functioned as a black box.  
* Cancellations and no-shows on deposit / pay-on-arrival bookings are not reflected back to ad platforms, so Smart Bidding continues optimizing on bookings that are never completed.  
* Paid, affiliate, and organic conversions are not cleanly separated, risking double-counting and wasted spend.  
* Stripe settles in both EUR and USD, so conversion values reported to ad platforms can be inconsistent across currencies.

**Goals and Objectives**

**Business Goals**

* Give ad platforms an accurate, revenue-based signal (commission) to optimize Smart Bidding against.  
* Make conversion tracking fully transparent and independently verifiable by the stakeholder.  
* Protect ad spend efficiency by correcting for cancellations and separating paid from affiliate/organic traffic.  
* Establish a tracking foundation that supports future paid-campaign management as a follow-on engagement.

**Non-Goals**

* Ad campaign creation, management, or spend allocation — out of scope for this project.  
* Replacing or migrating off Cookiebot — Consent Mode v2 is configured against it, not replaced.  
* Server-side GTM (Stape) — treated as an optional, separately scoped Phase 2, not a launch requirement.

**Success Metrics**

| Metric | Target / Definition of Success |
| :---- | :---- |
| Conversion value accuracy | 100% of fired conversions carry server-resolved commission\_amount, not booking total |
| Attribution completeness | gclid / gbraid / wbraid / fbclid and UTMs captured and persisted on the booking record for all checkout sessions |
| De-duplication | Zero double-counted conversions across browser Pixel and server CAPI, verified via shared transaction ID and atomic mark-fired guard |
| Cancellation correction latency | Negative adjustments (Google Ads) and refund events (Meta) reflected within 24–48 hours of cancellation |
| Currency consistency | Google Ads, Meta, and GA4 report identical, EUR-normalized values for the same booking |
| Channel separation | Paid conversions are distinguishable from affiliate/organic in reporting; no shared-attribution overlap |
| Verifiability | Stakeholder can independently trace any event to its source via the recorded walkthrough and written reference |
| Post-launch stability | Zero unresolved tracking defects at the end of the 14-day monitoring window |

**Users and Stakeholders**

| Role | Interest / Responsibility |
| :---- | :---- |
| Denley Felisie (stakeholder) | Owns the decision, verifies conversion accuracy, grants platform and ad-account access |
| Marketing Team — Arnav (delivery) | Designs and builds server-side tracking, configures ad platforms, runs QA and monitoring |
| Prospective customers (end users) | Interact with the booking flow; not directly involved, but session/consent handling must respect them |
| Google Ads / Meta / GA4 (systems) | Consume conversion events; Smart Bidding and reporting depend on event accuracy |
| Future affiliate partners | Indirectly affected — must remain cleanly separated from paid attribution |

**Functional Requirements**

**Event Capture and Attribution**

* Capture gclid, gbraid, wbraid, and fbclid at the landing page and store them in first-party cookies.  
* Write click IDs and UTM parameters through to the booking record at booking creation, so attribution survives multi-session, multi-day booking journeys.  
* Keep UTM-based paid attribution separate from affiliate/promo-code attribution at the data-model level.

**Conversion Firing**

* Fire one conversion event to Google Ads, Meta, and GA4 when a booking transitions to “confirmed” status.  
* Resolve commission\_amount server-side from the booking record and send it as the conversion value (not the full tour price).  
* Normalize all conversion values to a single reporting currency (EUR) with a consistent, documented rounding policy, regardless of whether Stripe settled in EUR or USD.  
* Trigger fires from the URL pattern /curacao/thank-you/\[bookingRef\] tied to the booking's confirmed state.

**De-duplication**

* Fire Meta Conversions API (CAPI) from the server in parallel with the browser Pixel, deduplicated by a shared transaction ID.  
* Implement an atomic server-side “mark-fired” guard per booking so page refreshes or repeat visits cannot cause duplicate conversions on any platform.

**Consent and Match Quality**

* Send hashed email, phone (E.164), name, and address for Google Ads Enhanced Conversions to improve match rates.  
* Configure Consent Mode v2 with region-aware defaults against the existing Cookiebot installation.

**Post-Conversion Correction**

* Send negative conversion adjustments to Google Ads and refund events to Meta when a confirmed booking is later cancelled or is a no-show.  
* Ensure corrections propagate within 24–48 hours so Smart Bidding self-corrects on accurate outcomes.

**Reporting and Verification**

* Provide a recorded walkthrough showing exactly where each event lands in Google Ads, Meta, and GA4.  
* Provide a written reference documenting every event, its parameters, and its value source, kept alongside the codebase.

**Non-Functional Requirements**

* Accuracy: conversion values must always trace to the booking record — no client-side estimation of commission.  
* Reliability: dedup guard must be atomic to prevent race conditions under concurrent requests (e.g., refresh during redirect).  
* Transparency: every fired event must be independently checkable by the stakeholder in the native ad-platform dashboards — no reliance on the delivery team's reporting layer.  
* Compliance: consent handling must respect Consent Mode v2 defaults per region before any personal data is sent to ad platforms.  
* Maintainability: event logic lives in the platform's own codebase (not a bolted-on tag), so it evolves alongside booking-flow changes.  
* No added recurring infrastructure cost is required for the core (non-Phase-2) build.

**Scope**

**In Scope**

* Native, server-side conversion tracking across Google Ads, Meta, and GA4.  
* Click ID and UTM capture and persistence on the booking record.  
* Commission-based, currency-normalized conversion values.  
* Cancellation and no-show correction events.  
* Enhanced Conversions and Consent Mode v2 configuration.  
* Google Ads developer token request and follow-up.  
* QA across card, deposit, and pay-on-arrival booking flows, including a test cancellation.  
* 14 days of post-launch monitoring with defect fixes.

**Out of Scope (This Phase)**

* Server-side GTM on Stape and a first-party tracking subdomain — deferred to optional Phase 2\.  
* Ad campaign strategy, creative, targeting, or spend management.  
* Any change to Cookiebot as the consent management platform.

**Solution Approach**

Conversions are generated inside the Island Tours platform itself rather than by an external tagging layer. Because the event is fired from the same system that owns the booking record, it can carry true commission revenue, be corrected when a booking is cancelled, and be cleanly separated from affiliate and organic traffic — none of which a purely browser-based or generic tag can do reliably.

| Component | Role |
| :---- | :---- |
| Island Tours platform | Server-side source of truth for commission, currency, and click IDs |
| Google Tag Manager (Web) | Browser event capture and consent signals |
| Google Ads | Enhanced Conversions, dynamic-value conversion action, offline adjustments |
| Meta Pixel \+ Conversions API | Browser and server events, deduplicated by shared transaction ID |
| GA4 | Reporting event stream |
| Cookiebot | Consent Mode v2, already installed on the site |
| Stripe | Payment settlement; webhook source for confirmed bookings and refunds |

**Milestones**

| \# | Stage | Key Deliverable |
| :---- | :---- | :---- |
| 1 | Access and account setup | Access provisioned; Google Ads developer token request submitted |
| 2 | Click ID and UTM capture | gclid/gbraid/wbraid/fbclid and UTMs captured and written to booking record |
| 3 | Data layer and commission value | Server-side commission value, EUR normalization, atomic dedup guard |
| 4 | Google Ads setup | Dynamic-value conversion action, Enhanced Conversions, Consent Mode v2 |
| 5 | Meta CAPI and deduplication | Server-side CAPI parallel to Pixel, shared transaction ID dedup |
| 6 | Cancellation adjustments and QA | Negative/refund events live; QA complete; walkthrough delivered |

Target: 7 business days end to end, starting once access is complete. The Google Ads developer token approval (2–3 business days, outside the team's control) is the only external dependency and is submitted on day one so it runs in parallel with the rest of the build.

**Dependencies and Risks**

| Dependency / Risk | Mitigation |
| :---- | :---- |
| Google Ads developer token approval (external, 2–3 days) | Submitted on day one; rest of build proceeds in parallel; only the offline-adjustment stage is blocked by it |
| Timely access provisioning by stakeholder | Timeline starts from the day access is complete; access list defined up front |
| Cookiebot must remain installed and licensed | Consent Mode v2 is configured against existing Cookiebot, not replacing it |
| Stripe webhook access to bookings and refunds | Required and assumed available throughout |
| Dual-currency settlement (EUR/USD) causing reporting mismatches | Server-side normalization to EUR with a single rounding policy before any event fires |

**Assumptions and Constraints**

* Access (GTM, Google Ads, GA4, Meta Business Manager) is granted within the first two business days.  
* Cookiebot remains installed and licensed on the site for the duration of the project and after.  
* Ad campaign creation, management, and spend are handled outside this project.  
* Phase 2 (server-side GTM on Stape) can be scheduled any time after core tracking is live and verified, and carries its own hosting cost billed directly to the stakeholder.

**Access Requirements**

* Google Tag Manager — admin access  
* Google Ads — admin access  
* Google Analytics 4 — editor or admin access  
* Meta Business Manager — Pixel and system user access  
* Stakeholder approval to submit the Google Ads developer token request on day one

**Deliverables**

* Live server-side conversion tracking across Google Ads, Meta, and GA4.  
* Recorded walkthrough of event verification in each platform.  
* Written reference of every event, its parameters, and its value source.  
* QA results, including a proven test cancellation with negative adjustment.  
* 14 days of post-launch monitoring with defect remediation.

