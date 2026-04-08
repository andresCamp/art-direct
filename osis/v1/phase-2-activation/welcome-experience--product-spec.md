# Welcome Experience — Product Spec

## Purpose

The welcome modal gives first-time visitors just enough context to understand what they're looking at and what to do. Without the landing page as a buffer, users arrive cold into the studio. The welcome moment bridges that gap — it's the 5-second pitch that turns confusion into curiosity.

### The Analogy

Think of the first-launch walkthrough in a mobile app — the ones that show 3-4 slides before you hit the main screen. Art Direct's version is faster and non-blocking: the studio is visible underneath, and the user can dismiss at any time.

Where it sits in the pipeline:

```
[First visit] -> [Welcome Modal (context)] -> [Studio (value)]
```

## Inputs

- First-visit flag (localStorage check, later Dexie)
- Nothing else — the modal is self-contained

## Interaction Model

- **Auto-play:** Modal appears centered over the studio (studio visible but dimmed underneath). Steps advance on a timer (~3-4 seconds each).
- **Hijackable:** User can click through steps at their own pace. Each step has a clickable indicator (dots or similar).
- **Dismissable:** Close button always visible. Clicking outside closes. Any dismiss = "seen it."
- **Re-openable:** After dismissal, a subtle "?" button appears (location TBD — top bar or bottom corner). Click re-opens the modal.
- **One-time:** First visit only. Stored in localStorage (later Dexie). Re-open via "?" is always available.

## The Flow

### The Steps

The modal tells a micro-story in 3-4 frames:

1. **"This is Art Direct"** — One line: "Visual art direction for responsive images." Maybe the logo/wordmark.
2. **Show the interaction** — Animation of dragging an image in a breakpoint frame. The visual "aha" — you can move the image differently per breakpoint.
3. **Show the output** — Animation of the class string updating as the image moves. The payoff — it generates Tailwind classes.
4. **"One image. Every breakpoint. Try it."** — CTA to dismiss and start playing. Maybe mention the sidebar for uploading your own image.

Each step has a subtle transition (fade/slide). Total auto-play duration: ~10-12 seconds.

### Dismiss Flow
1. User dismisses (close button, click outside, or final step CTA)
2. localStorage flag set: `artdirect-welcome-seen: true`
3. Modal fades out
4. Studio is fully interactive
5. "?" button appears in its persistent location

### Re-open Flow
1. User clicks "?"
2. Modal re-opens at step 1
3. Same interaction model (auto-advance, clickable, dismissable)

## Behavioral Rules

- The modal MUST NOT block interaction for more than ~1 second. If there's any loading, show the studio first, then overlay the modal.
- Steps should be visual, not text-heavy. Show, don't tell.
- The modal should feel like a reveal, not an obstacle.
- On mobile: modal is full-screen or near-full-screen. Same content, adapted layout.
- The "?" button should be subtle — not a primary UI element. Developers who've seen the modal once don't need it competing for attention.
- If localStorage is unavailable (private browsing), show the modal every time. Don't error.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| User refreshes before dismissing | Modal shows again (flag not set until dismiss) |
| User clears localStorage | Modal shows again. This is fine. |
| User arrives from /about link | Still shows welcome modal — they haven't used the studio yet |
| Very slow connection | Studio loads first, modal appears after. Never block rendering for the modal. |

## Connections

| System | Relationship | What Flows |
|--------|--------------|------------|
| Studio | Overlays on | Studio renders underneath, dimmed |
| Image Sidebar | Coordinates with | Sidebar button should not compete with modal; consider hiding sidebar trigger until modal is dismissed |
| Persistence (future) | Will use | Dexie replaces localStorage for the "seen" flag |

## Analytics

PostHog events fired by the welcome modal. Tracked because we want to know how many first-time visitors actually see the modal, how far through the steps they get before dismissing, and how often the "?" reopen pattern is used.

| Event | When | Properties |
|-------|------|------------|
| `welcome_modal_shown` | First visit (after 500ms delay) | `trigger: 'first_visit'` |
| `welcome_modal_shown` | User clicks the "?" reopen button | `trigger: 'reopen'` |
| `welcome_modal_dismissed` | Any dismiss path (close button, click-outside, final CTA, auto-complete) | `step_reached` (0-indexed step the user was on), `method` (which dismiss path) |

**Test mode:** When `testMode` prop is set, no events fire and no localStorage writes happen — keeps Playwright/Storybook runs clean.

**Why `step_reached` matters:** The drop-off curve across steps tells us whether step 2 is doing the heavy lifting (the visual "aha") or whether users bail before they get the value. If most dismisses happen at step 0, the modal is being treated as an obstacle and we should rethink the auto-play timing.
