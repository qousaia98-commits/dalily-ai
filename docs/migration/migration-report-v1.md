# Migration Report v1.0 (Immutable Summary)

**Full analysis authority:** Migration Report produced in planning (Keep / Refactor / Rewrite / Delete).  
This file captures the engineering decisions that Sprint planning must follow.

## Executive verdict

Current Dalily is a **directory + subscription + hybrid RFQ** platform.  
Target Dalily 2.0 is an **intent → offers → select → unlock fee** marketplace.

**Strategy:** Strangler — salvage valuable platforms; rewrite wrong domains; delete forbidden monetization/browse cores.

## Salvage (Keep / Refactor)

Auth, i18n/RTL, UI kit, verification, reviews, chat transport/realtime, media uploads, admin shell/audit, payment event/manual rails, vision/voice capture, provider onboarding skeleton, notifications, geo helpers.

## Rewrite

- Customer discovery spine (replace directory search as primary)
- Marketplace request lifecycle (replace accept→chat economics)
- Matching (scarce assignment, not browse ranking)
- Unlock domain (new)
- Offer competition model (from quotes)

## Delete / retire (product path)

- Subscriptions as request access / ranking / featured visibility
- Public directory browse as default (`/search` listing, public provider browse semantics)
- Favorites browse stub as product direction
- Accept-based full chat gate for v2 requests

## Do not

- Scrap the entire repository
- “Just rename” unlock onto accept/chat
- Choose new frameworks in migration foundation sprints
