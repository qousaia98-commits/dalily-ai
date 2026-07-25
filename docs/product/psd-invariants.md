# Dalily 2.0 – PSD Invariants (Immutable)

**Source:** Official Product Specification Document Chapters 2–4 (FINAL)  
**Role of this file:** Engineering-facing invariant checklist. Full narrative PSD remains the product authority; this file must not invent new product rules.

## Product model

- Dalily 2.0 is an **intent-to-hire marketplace**, not a business directory.
- Customers describe a need; they do **not** browse businesses as the primary path.
- Providers compete with **offers**; customer **selects** one offer.
- Selected provider pays a **Lead Unlock Fee**; only then are phone, exact address, navigation, and full chat released.
- **No monthly subscription** as access to requests / ranking / visibility.
- **No silent pay-for-priority** in matching.

## Customer journey invariants (Ch. 2)

1. Entry question: “What do you need?”
2. Fast intake normally **&lt; 60 seconds**: problem → AI category suggest → confirm → optional photos → location → publish.
3. Urgency auto-classified; emergency confirm only when needed.
4. AI never invents prices; optional historical guidance band X–Y only when enough data exists.
5. Trust messaging is UX (privacy, relevant recipients, verified badges, customer control).
6. Waiting Room + Offer compare + structured Q&A pre-unlock + Unlock Pending + SLA fallback.
7. Full chat only post-unlock.
8. Rebook/invite allowed; public directory browse is not.

## Matching philosophy (Ch. 2.8)

- Requests are scarce — allocate, do not broadcast.
- Eligibility before ranking.
- Customer success first; fair opportunity second; equal volume never.
- Shortlists over crowds; expand-on-failure rather than start-wide.
- Newcomers get oxygen without fake trust.
- Inactive/slow providers receive fewer requests.
- Distance matters in context; verified gets advantage, not monopoly.
- Emergency is a different mode.
- Outcomes beat spend.

## Provider invariants (Ch. 3)

- Opportunities must feel worth paying unlock fees.
- Dashboard prioritizes Unlock SLA and assigned requests.
- Skip is healthy; ghosting is not.
- Explain why a provider received a request.
- Premium **tools** may exist later; they must not buy matching placement.

## Economy invariants (Ch. 4)

- Liquidity is cell-local (geo × category) completion path quality, not headcount.
- Depth before width; no fake abundance.
- Oversupply is as dangerous as undersupply.
- Cold start: seed supply + assisted early jobs; then earn MVL before scale.
- Unlock fee monetizes selected intent.
- When cell health is red: freeze expansion and tell the truth in UX.

## Explicit non-goals during migration

- Do not reintroduce directory-first UX as the default.
- Do not reintroduce subscription ranking boosts.
- Do not open full chat before unlock grant.
- Do not add unrelated product features during strangler sprints.
