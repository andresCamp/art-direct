# Phase 3 — Devices

**Goal:** Give Preview a Chrome DevTools-parity device picker with search and persisted pinned favorites, and collapse Art Direct's device data down to a single canonical source.

**What triggered this:** Andrés: *"I always viewed the limited device list as a drawback."* Today there are two parallel device lists — the 7-preset horizontal strip in `PreviewToolbar.svelte` and the 13-device list in `src/lib/devices.ts` powering Compose's EditView Devices mode. Neither is comprehensive, both drift, and the Preview strip in particular makes the tab feel like a glorified iframe with 7 hardcoded sizes rather than a real verifier. Users can't trust Preview as a QA surface if their actual target device isn't in the list.

**What this phase accomplishes:** Preview gets a comprehensive, searchable device picker lifted verbatim from Chromium's emulated-devices list. The horizontal strip stays, but now it shows the user's *pinned* devices instead of a hardcoded array. A "More devices…" affordance opens a searchable picker of the full Chromium list where the user stars devices to pin them into the strip. Pinned devices persist globally via the Phase 2.5 Dexie Preferences layer, so the QA set follows the user across sessions and directions. Under the hood, Art Direct gains a single canonical devices module — the old `src/lib/devices.ts` and the new `PREVIEW_PRESETS` in `src/lib/preview-state.svelte.ts` collapse into one list that both Compose and Preview read from.

**Constraints:**
- Resources: Solo developer
- Dependencies: Phase 2.5 Persistence (already shipped) — pin storage piggybacks on the Dexie Preferences record
- Compose UX must not regress: EditView's Devices/Tailwind toggle rewires to the unified module but its user-visible behavior stays identical
- Class-string output stays pure Tailwind: no arbitrary `min-[Wpx]:` breakpoints leak into the generator

**Systems:**

| System | Type | Description |
|--------|------|-------------|
| Device Picker | New | Searchable Chromium-parity device list for the Preview tab, with persisted global pins |

**What Ships (all T1 — these are atomic, they don't make sense independently):**

| Component | Tier | System | Notes |
|-----------|------|--------|-------|
| Unified canonical devices module (Chromium-lifted) | T1 | Device Picker | One list, one shape — `id`, `name`, `category`, `width`, `height`, `breakpoint`. No `userAgent`, no `devicePixelRatio`. |
| Preview strip = pinned devices | T1 | Device Picker | `PreviewToolbar.svelte` reads pinned IDs from preferences instead of hardcoded `PREVIEW_PRESETS` |
| "More devices…" searchable picker | T1 | Device Picker | Affordance at the end of the strip opens a searchable list of the full Chromium set, grouped by category, with a star to pin/unpin |
| Pin persistence via Dexie Preferences | T1 | Device Picker | New `pinnedDevices: string[]` field on the Preferences record, written immediately on pin/unpin |
| Default pin seed on fresh install | T1 | Device Picker | On first Preferences write, seed pinned IDs to the current 7 `PREVIEW_PRESETS` so existing users see no visible change |
| EditView Devices mode rewired to unified module | T1 | Device Picker | Compose's Devices/Tailwind toggle reads from the unified module but ignores pin state — behavior stays exactly as today |

**What Does NOT Ship:**

| Deferred Item | Reason | Revisit In |
|---------------|--------|------------|
| Arbitrary `min-[Wpx]:` Tailwind output | Compose output stays standard-breakpoint only; device-exact breakpoints break portability | Not planned |
| Custom user-defined devices | Chromium list is broad enough for v1; adds picker/edit UX complexity | Later |
| Per-direction pinned sets | Pins are a user preference, not a per-image setting | Not planned |
| Device user-agent emulation | Art Direct is a CSS-only tool; UA strings don't affect the output | Not planned |
| DPR-aware preview rendering | Same reason — Tailwind class strings don't change by DPR | Not planned |
| Live-syncing with upstream Chromium device list | Frozen snapshot is fine for v1; avoids a background fetch dependency | Later |

**Success Criteria:**
- [ ] Pinned set persists across page refresh and return visit
- [ ] Full Chromium device list is browsable in under 2 clicks from the Preview tab
- [ ] No regression in Compose Devices/Tailwind toggle behavior
- [ ] Default Preview strip on a fresh install matches the current 7 presets exactly (zero visible regression)
- [ ] Preview and Compose both read from the same devices module — no duplicate device arrays in the codebase

**Risks:**

| Risk | Impact | Mitigation |
|------|--------|------------|
| The full Chromium list feels "less curated" — users lose the opinionated 7-preset default | Medium | Default pins = current 7 presets. Users only see the big list when they actively open "More devices…". |
| Picker UX clutters the Preview tab | Medium | "More devices…" is a single affordance at the end of the strip, not inline. Search-first list keeps the surface small regardless of list length. |
| Chromium device list drifts over time, snapshot goes stale | Low | Freeze a dated snapshot in v1. Refresh is a manual, deliberate PR, not a background fetch. |
| A pinned device is removed in a future Chromium snapshot, leaving a dangling ID in preferences | Low | On hydration, drop pinned IDs that no longer resolve to a device. Log silently. |
| EditView Devices mode accidentally inherits pin state or changes behavior during the rewire | Medium | EditView reads the raw device list, never touches the `pinnedDevices` field. Cover with a pre-rewire snapshot test of the Compose device dropdown. |

**Open Questions:**
- [ ] What snapshot version of the Chromium emulated-devices list do we lift? Pick a date and freeze it. — *Unresolved*
- [ ] Some Chromium devices don't fit cleanly into phone/tablet/desktop (foldables, Nest Hub, etc.). Do we add an "other" category or force-fit them into the existing three? — *Unresolved*
- [ ] When we refresh the snapshot later (if ever), do new devices appear silently or get highlighted somehow in the picker? — *Unresolved*
- [ ] "More devices…" picker — modal, popover, or slide-down panel? Leave for design spec. — *Unresolved*
- [ ] Search: name only, or also fuzzy match on width and category? — *Unresolved*
