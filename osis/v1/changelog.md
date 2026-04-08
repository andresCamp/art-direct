# Changelog

## 2026-04-08

### Phase 2 Shipped — Activation Pivot

All Phase 2 ship-list items implemented:
- Studio is now the homepage (`src/pages/index.astro`)
- Landing content moved to `/about` (`src/pages/about.astro`)
- Welcome modal with animated cursor demo, first-visit gating via localStorage, reopen "?" button, analytics (`src/components/WelcomeModal.svelte`)
- Left sidebar with examples, blank/uploaded threads, new direction (`src/components/studio/Sidebar.svelte`)
- GitHub + X floating buttons (bottom-left) (`src/components/GitHubStars.svelte`)
- Global drop zone overlay (`src/components/DropZoneOverlay.svelte`)
- Direction model in store: `kind: 'example' | 'upload' | 'blank'` with deletion rules (`src/lib/store.svelte.ts`, `src/lib/types.ts`)

### Discoveries (propagated up from implementation)

- **DirectionKind uses `'upload'`, not `'uploaded'`.** The spec and the original game-plan referred to the upload kind as `uploaded`. The implementation in `src/lib/types.ts` and `src/lib/store.svelte.ts` settled on `'upload'`. Either the type should be renamed or the specs should be amended — pick one and keep them in sync.
- **Curated examples narrowed from 4 to 3.** `image-sidebar--product-spec.md` lists "Wave, Adam, Napoleon, Crows". `src/lib/store.svelte.ts` exports `CURATED_EXAMPLE_IDS = ['napoleon', 'wave', 'adam']` — Crows was dropped.
- **Single example slot, not a gallery.** `loadExampleDirection()` replaces any existing example direction rather than stacking them: `directions = [direction, ...directions.filter(item => item.kind !== 'example')]`. There is at most one `kind: 'example'` direction at a time. The spec didn't anticipate this constraint.
- **Direction schema is richer than the spec described.** `Direction` carries `id`, `name`, `image`, `frames`, `dominantColor`, `modifiedBreakpoints`, `lastModifiedBreakpoint`, `lastModifiedAt`, `kind`, and `exampleId`. `lastModifiedAt` and `lastModifiedBreakpoint` were added to drive the OutputPanel highlight; `exampleId` lets the sidebar mark the active example without string-parsing the id. Worth reflecting in the system spec.
- **Sidebar is keyboard-driven, not click-outside-driven.** `image-sidebar--product-spec.md` says "Click again or click outside to close." Actual implementation uses Cmd/Ctrl+B and Escape. Click-outside is not wired (the sidebar pushes the studio surface rather than overlaying it on desktop). Tooltip on the toggle shows the shortcut.
- **WelcomeModal demo is real cursor animation, not abstract slides.** The spec described "3-4 frames" with subtle transitions. Implementation is a two-step flow: a title card, then a continuously-looping `requestAnimationFrame` cursor animation that drags the mobile frame, drags the desktop frame, and "clicks" the copy button — all driving live class-token updates. ~1170 lines, including quadratic-curve cursor pathing, jitter, tilt, and `svelte/motion` Tweens. Much more ambitious than spec implied.
- **`/modal` test route exists.** Not in any spec. `src/pages/modal.astro` mounts `<WelcomeModal client:load testMode />`. The `testMode` prop bypasses localStorage and analytics so the modal can be tested in isolation without polluting state or events. Should be documented as part of the welcome experience system.
- **Welcome reopen "?" button is fixed bottom-right via component-local CSS.** `position: fixed; bottom: 18px; right: 18px; z-index: 60`. It lives inside `WelcomeModal.svelte` (not a separate floating affordance). The 2026-04-07 changelog already resolved the location decision; this confirms the placement.
- **Empty-frame drop targets are a fully-developed sub-flow.** `src/components/studio/Frame.svelte` renders a dashed "Drop or browse" zone with click-to-browse, drag-to-drop, and a clipboard-paste button when the active direction has `image: null` (i.e. a blank thread). The image-sidebar spec mentioned this in passing; the implementation includes a dedicated `handleClipboardPasteForActiveDirection()` and `handleFilesForActiveDirection()` in `src/lib/upload.ts` that target the active direction rather than creating a new one.
- **GitHubStars compensates for the sidebar push.** `src/components/GitHubStars.svelte` reads `store.sidebarOpen` and applies a `translateX(264px)` on desktop so the floating buttons stay inside the studio surface when the sidebar opens. This coupling between two unrelated systems is not in any spec.
- **`StudioMount.svelte` is now orphaned.** It was the Phase-1 landing→studio transition mount. Nothing imports it anymore — `pages/index.astro` mounts `Studio.svelte` directly with `client:load`. Candidate for deletion.
- **`store.reset()` exists but no UI surfaces it.** The Phase-1 "session reset" path is still in the store but no component calls it now that there is no landing-page back button. Either wire it up (e.g. sidebar overflow menu) or remove.
- **Curated example is auto-seeded on every visit.** `createSeedDirections()` always inserts napoleon as the first direction. There is no "empty studio" cold start — the studio always boots with at least one direction visible. This is what allowed the homepage swap, but the spec didn't make this seeding explicit.
- **New analytics event taxonomy.** Added: `image_pasted`, `new_direction_created`, `direction_switched`, `direction_deleted`, `welcome_modal_shown`, `welcome_modal_dismissed`. Removed in practice: `studio_entered` and `session_reset` (no longer fire because their owners are unused). Worth updating the analytics list in `product-spec.md`.

### Manual Updates
- `twin.md` — Regenerated to reflect studio-first architecture, directions model, welcome modal, sidebar systems, and floating social buttons. Phase 1 twin from 2026-04-06 is fully replaced.
- `osis.json` — Updated `lastTwinUpdate` to 2026-04-08.

## 2026-04-07

### Manual Updates
- `product-spec.md` — Updated Phase 2 roadmap from "Polish and Ecosystem" to "Activation Pivot" based on user research (10 screen recordings, 0 uploads). Studio becomes homepage, landing moves to /about.
- `product-spec.md` — Updated screens, pipeline, design philosophy, and product loop to reflect new studio-first flow.
- `product-spec.md` — Added Image Sidebar and Welcome Experience as new systems in the pipeline.
- Created `phase-2-activation/game-plan.md` — Phase 2 game plan driven by activation signal from Reddit launch.
- Created `phase-2-activation/image-sidebar--product-spec.md` — System product spec for the new image management sidebar.
- Created `phase-2-activation/welcome-experience--product-spec.md` — System product spec for the first-time welcome modal.
- Created `phase-2-activation/persistence--product-spec.md` — System product spec for Dexie.js local persistence (Phase 2.5).
- Resolved: "?" re-open button lives in bottom-right corner. Floating GitHub + X (Twitter) buttons in bottom-left.
- Resolved: Welcome modal should track dismissal analytics (yes).
