# Device Picker — Product Spec

## Purpose

The Device Picker turns Art Direct's Preview tab from a glorified iframe with 7 hardcoded sizes into a real verifier. It gives the user a comprehensive, searchable, pinnable set of devices — lifted verbatim from Chromium's emulated-devices list — so that when they want to check how a composition holds up on a specific phone, tablet, or laptop, the device is actually there. The user pins their preferred QA devices into a horizontal strip for one-click access and reaches the full list through a "More devices…" affordance when they need something more exotic. Pins persist globally, so the user's QA rig follows them across sessions.

### The Analogy

Chrome DevTools' device toolbar is the obvious analog. It has a short default list, a "More devices…" manager behind it, and lets you toggle devices in and out of the toolbar with a checkbox. Art Direct's picker works the same way — minus the user-agent emulation and DPR spoofing, because Art Direct is a CSS-only tool and those knobs don't affect the Tailwind class string it generates.

Where it sits in the pipeline:

```
[User's class string] → [Preview iframe] → [DEVICE PICKER selects viewport] → [User verifies composition]
                                                     ↑
                                          [Pinned devices ← Dexie Preferences]
                                                     ↑
                                          [Full list ← unified devices module]
```

## Inputs

- The unified canonical device list (Chromium-lifted, frozen snapshot for v1)
- The user's persisted pinned device IDs (from the Phase 2.5 Preferences record)
- The user's current preview viewport — width, height, orientation, and active device ID
- User interactions: clicking a device in the strip, opening "More devices…", typing in the picker search, starring/unstarring a device

## Data Model

### Device

A single device record. Same shape in memory and at the data layer — no separate wire format.

- `id`: string (stable, e.g. `iphone-15-pro`)
- `name`: string (display name, e.g. `iPhone 15 Pro`)
- `category`: `'phone' | 'tablet' | 'desktop'` (and possibly `'other'` — see Open Questions)
- `width`: number (CSS pixels, portrait-natural)
- `height`: number (CSS pixels, portrait-natural)
- `breakpoint`: Tailwind breakpoint name derived from width (base, sm, md, lg, xl, 2xl)

Explicitly not on the record: `userAgent`, `devicePixelRatio`. Art Direct is a CSS-only tool; those fields don't change any output.

The full device array is a module-level constant — one file, one export. Both Preview and Compose import it directly.

### PinnedDevices (on Preferences)

A new field on the existing Preferences record from Phase 2.5.

- `pinnedDevices`: `string[]` — ordered array of device IDs. Order is the strip order, left to right.

Seeding: on first Preferences write (fresh install, or a return visit by a pre-Phase-3 user whose Preferences record has no `pinnedDevices` field), the field is seeded with the IDs of the current 7 `PREVIEW_PRESETS` in the same order they appear today. After that first write, the field is fully user-owned — the user can unpin every device if they want.

## Interaction Model

The rhythm from the user's perspective:

1. User opens the Preview tab.
2. They see a horizontal strip of their pinned devices (default 7 on a fresh install).
3. They click one — the preview viewport jumps to that device's dimensions. Standard behavior, no change from today except the strip source.
4. They want a device that isn't in the strip. They click "More devices…" at the end of the strip.
5. A searchable picker opens (modal/popover/panel — see Open Questions). It shows the full Chromium list, grouped by category (Phones / Tablets / Desktops).
6. They type in the search field — results filter in real time.
7. They tap the star next to a device to pin it. The strip updates immediately; the picker stays open.
8. They close the picker. The viewport is unchanged unless they also clicked a device inside the picker to switch to it.

Unpinning is the inverse: un-star a device in the picker, or (if design decides to wire it) right-click / long-press a device in the strip to remove it. The final unpin UX is left to the design spec.

Selecting a device in the picker also switches the preview viewport to it — pinning and selecting are separate gestures (star vs. row click), but both are one-click.

## The Flow

### First Visit (Default Pins Seeded)
1. Preferences record is created (by the Phase 2.5 persistence layer on fresh install)
2. `pinnedDevices` is seeded with the 7 current preset IDs in their existing order
3. Preview tab renders the strip from `pinnedDevices` — user sees the exact same 7 devices they'd see today
4. "More devices…" affordance sits at the end of the strip

### Searching for a Device
1. User clicks "More devices…"
2. Picker opens, full Chromium list rendered grouped by category
3. User types `pixel` — list filters to devices whose name contains `pixel`
4. User sees Pixel 7, Pixel 8, Pixel Fold, etc., under the Phones group

### Pinning a New Device
1. Inside the picker, user taps the star icon next to `Pixel 8`
2. `pinnedDevices` is updated in memory and written to Dexie immediately
3. The Preview strip re-renders with `Pixel 8` appended
4. Star state in the picker reflects the pinned state (filled vs. outline)

### Unpinning a Device
1. User un-stars `iPhone SE` in the picker (or uses the strip unpin gesture if wired)
2. `pinnedDevices` is updated in memory and written to Dexie immediately
3. Preview strip removes `iPhone SE`
4. If `iPhone SE` was the currently selected preview device, the viewport does not change — it just becomes an "unpinned current" state until the user picks another device

### Selecting a Pinned Device from the Strip
1. User clicks `iPad` in the strip
2. Preview viewport jumps to iPad dimensions at the current orientation
3. No Dexie write — selection is ephemeral preview state, not a preference

### How EditView's Devices Mode Reads the Same Data
1. EditView's Devices/Tailwind toggle renders in Compose
2. When in Devices mode, EditView imports the unified devices module and filters it the same way it does today (by breakpoint match)
3. It never reads `pinnedDevices` — Compose's device picker is breakpoint-keyed, not preference-keyed
4. User-visible behavior in Compose is identical to today; only the import source has moved

## Behavioral Rules

- **Never block the UI for picker open.** The full device list is a module-level constant. Opening the picker is synchronous; no fetch, no async hydration.
- **Search is name-prefix + substring, not fuzzy.** Typing `iph` matches `iPhone SE`, `iPhone 15 Pro`, etc. No typo tolerance, no Levenshtein — keep it predictable.
- **Pins persist immediately.** Every star/unstar is a Dexie write to the Preferences record. Fire-and-forget, no debounce — pin actions are rare and intentional, unlike frame drags.
- **Default pins are seeded, not hardcoded.** Once the seed write happens, the pinned set is fully user-owned. The user can unpin every single default and end up with an empty strip — that's allowed.
- **Compose's Devices mode reads from the same source but ignores pin state.** EditView keys devices by breakpoint match, not by user preference. The unified module is the source; `pinnedDevices` is a Preview-only filter over it.
- **Chromium list is a frozen snapshot in v1.** No background fetch, no update prompt. A new snapshot is a deliberate PR.
- **No custom user-defined devices in v1.** If the user's exact device isn't in the Chromium list, they're stuck. Custom devices are a later feature.
- **No DPR or user-agent emulation.** Art Direct is a CSS-only tool. These fields don't affect the class string, so they don't belong in the data model or the UI.
- **Picker shows category groupings, not a flat list.** `Phones`, `Tablets`, `Desktops`, and possibly `Other` are section headers. Flat lists are harder to scan at 100+ devices.
- **Pinned device order is preserved.** New pins go to the end of the strip. Reordering is out of scope for v1 (not mentioned in the locked decisions).
- **Dangling pins are dropped silently on hydration.** If a pinned ID no longer resolves to a device in the current snapshot, it's filtered out at load time. No user-facing error.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| A pinned device is removed in a future Chromium snapshot | Filter the dangling ID out of `pinnedDevices` on hydration. Don't write it back unless the user interacts with the picker. |
| User unpins every device | Strip is empty except for the "More devices…" affordance. Design may choose to show a subtle CTA ("No pinned devices — click More devices… to pin one") — leave the exact copy to the design spec. |
| User searches with no matches | Picker shows an empty state with the search query echoed back. No suggestions in v1. |
| IndexedDB unavailable | Persistence layer already falls back to ephemeral mode (per Phase 2.5). Default 7 pins live in memory, pin/unpin works for the session but doesn't persist across refresh. |
| EditView and Preview want different orientations on the same device | Preview owns its own orientation state (already does). EditView's Compose mode is unaffected — orientation is not part of the device record, it's view-local. |
| User has an old Preferences record from before Phase 3 | `pinnedDevices` is missing — on first read, seed it with the default 7. First subsequent write persists the seeded set. |

## Connections

| System | Relationship | What Flows |
|--------|--------------|------------|
| Persistence (Phase 2.5) | Bidirectional | Reads initial pinned IDs on hydration; writes updated pinned IDs on pin/unpin |
| Preview | Reads from | Consumes selected device dimensions for iframe sizing; reads `pinnedDevices` to render the strip |
| EditView (Compose Devices mode) | Reads from | Imports the unified devices module for breakpoint-keyed device matching; ignores pin state |
| Store / preview-state | Owns | Preview selection, orientation, and viewport live in `preview-state.svelte.ts`; pin state lives in the Preferences record (one write layer, read through the store) |

## Open Questions

- [ ] What snapshot version of the Chromium emulated-devices list do we lift? Pick a date and freeze it. — *Unresolved*
- [ ] Some Chromium devices don't fit cleanly into phone/tablet/desktop (foldables, Nest Hub, etc.). Do we add an "other" category or force-fit them into the existing three? — *Unresolved*
- [ ] When we refresh the snapshot later (if ever), do new devices appear silently or get highlighted somehow in the picker? — *Unresolved*
- [ ] "More devices…" picker — modal, popover, or slide-down panel? Leave for design spec. — *Unresolved*
- [ ] Search: name only, or also fuzzy match on width and category? — *Unresolved*
