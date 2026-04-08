# Phase 2 — Activation Pivot

**Goal:** Remove the upload barrier. Make the studio the first thing users experience, with a pre-loaded example image ready to manipulate.

**What triggered this:** 10 screen recordings from Reddit launch — zero users uploaded an image. The landing page explains the concept but fails to activate users. Users need to feel the studio before they'll invest their own image.

**What this phase accomplishes:** Users land directly in the studio with a pre-configured example (randomly selected from Wave, Adam, Napoleon, Crows). They can immediately drag/zoom/pan and see class strings update. A welcome modal provides brief context on first visit. A left sidebar replaces the upload box as the image management surface — switch between gallery examples, upload your own image, or start a new blank direction.

**Constraints:**
- Timeline: Before the HN/X launch (Reddit is the testing ground)
- Resources: Solo developer
- Dependencies: None — all existing systems are working

**Systems:**

| System | Type | Description |
|--------|------|-------------|
| Image Sidebar | New | Left-edge panel for image management — gallery examples, upload, new direction |
| Welcome Experience | New | First-time animated modal explaining what Art Direct is and how to use it |
| Studio Homepage | Changed | Studio becomes the root route with pre-loaded example; landing moves to /about |

**What Ships (all T1 — these are atomic, they don't make sense independently):**

| Component | Tier | System | Notes |
|-----------|------|--------|-------|
| Studio as homepage (/) | T1 | Studio Homepage | Random example image pre-loaded with configured frames and class string |
| Landing content moves to /about | T1 | Studio Homepage | Current landing page content on its own route for SEO/sharing |
| Welcome modal | T1 | Welcome Experience | Animated step-through, auto-advances, clickable/hijackable, close button, first-time only (localStorage), "?" button to re-open |
| Left sidebar panel | T1 | Image Sidebar | Slides from left edge, button replaces current back/home button in top bar |
| Gallery examples in sidebar | T1 | Image Sidebar | Wave, Adam, Napoleon, Crows — click to load with pre-configured frames |
| Upload in sidebar | T1 | Image Sidebar | Drag-drop + file picker, creates new direction |
| New direction | T1 | Image Sidebar | Creates blank frames that are upload drop targets |

**What Does NOT Ship:**

| Deferred Item | Reason | Revisit In |
|---------------|--------|------------|
| Dexie.js persistence | Ship core UX first, add persistence after | Immediately after Phase 2 |
| Shareable URLs | Phase 2 in original roadmap, lower priority than activation | Phase 3 |
| Custom breakpoints | T2 from Phase 1, still lower priority | Phase 3 |

**Success Criteria:**
- [ ] Users interact with frames within 10 seconds of landing (measurable via PostHog)
- [ ] Upload rate increases vs. current baseline (currently 0% from recordings)
- [ ] Time to first frame_adjusted event decreases significantly
- [ ] Qualitative: HN/X launch produces higher activation than Reddit launch

**Risks:**

| Risk | Impact | Mitigation |
|------|--------|------------|
| Users don't understand what they're looking at without the landing page | Medium | Welcome modal provides context; /about exists for deep explanation |
| Sidebar adds complexity to a minimal UI | Low | Sidebar is collapsible, only opens on button click |
| Pre-loaded example feels like a demo, not a tool | Medium | Make upload prominent in sidebar; "New" is clearly visible |

**Open Questions:**
- [x] Should the welcome modal track dismissal analytics? — *Resolved: Yes. Track step reached on dismiss, dismiss method (close button vs click-outside vs auto-complete).*
- [x] Should the "?" re-open button live in the top bar or bottom corner? — *Resolved: Bottom-right corner. Floating GitHub and X (Twitter) buttons in bottom-left.*
