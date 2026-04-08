---
type: observation
date: 2026-04-07
source: screen recordings + reddit
affected: product-spec.md, phase-2-activation/game-plan.md
summary: 10 screen recordings from Reddit launch showed zero image uploads. Upload step is a wall. One positive Reddit comment validated the value prop.
---

## Screen Recordings (10 users)
- None of the 10 users uploaded an image
- Too much friction in the upload-first flow
- Users see the landing page but don't commit to uploading their own image

## Reddit Feedback
Comment (possibly AI-generated, unclear):
> "This is a brilliant bit of kit for anyone wrestling with responsive image cropping, especially with Tailwind. The visual, client-side approach makes perfect sense for fine-tuning that composition across breakpoints."

## GitHub
- 2 stars received

## Decision
Pivot to studio-first: pre-load example image, add sidebar for image management, welcome modal for first-time context. Landing page moves to /about.
