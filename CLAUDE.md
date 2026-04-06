# Art Direct

Visual art direction for responsive images using Tailwind CSS. One image, every breakpoint, a class string you can copy.

## Product Knowledge

Read osis/twin.md and the active specs in osis/ before working on any product feature. Say "osis" to consult the product expert.

- Vision: osis/v1/vision.md
- Product Spec: osis/v1/product-spec.md
- Changelog: osis/v1/changelog.md

## Architecture Decisions

- **Static site, no backend.** Everything runs client-side. No accounts, no persistence, no image uploads to a server. Images are blob URLs.
- **Framework:** Not yet chosen. Next.js is likely given the developer's experience, but this is a simple static tool — could be anything that deploys to artdirect.dev.
- **Output is Tailwind class strings.** The tool maps visual manipulations (drag, zoom, pan) to Tailwind utilities scoped per breakpoint. Zero runtime in the consumer's app.

## Design Direction

- Light blue identity color (not Tailwind blue — Art Direct's own shade)
- Dashed border frames for breakpoint containers
- Subtle gradient background that shifts with the rotating example gallery
- Fine grain texture overlay (Arc/Dia style)
- Developer tool aesthetic — clean, monospace where appropriate, minimal chrome
- No modals, no onboarding, no tooltips

## Key Context

- Domain: artdirect.dev (available, not yet purchased)
- OSS project with landing page
- The landing page example section rotates through 5 iconic paintings (The Great Wave, Rousseau, Dali, etc.) each with different pre-composed art direction to show range
- Uploading an image transitions from landing to full studio mode
- The technique was discovered in the osis landing page manifesto section — see /Users/andrescampos/Projects/osis/apps/landing/app/page.tsx for the original responsive image positioning strings that inspired this tool
