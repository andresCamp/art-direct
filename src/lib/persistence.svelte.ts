/**
 * Persistence layer — IndexedDB via Dexie.js.
 *
 * The store at store.svelte.ts is the single source of truth for studio state.
 * This module observes the store and syncs to IndexedDB so directions, frames,
 * and preferences survive page refreshes and return visits.
 *
 * Slice 1 (current): schema, types, self-healing example seed pass.
 * Slice 2: full hydrateStore() read path + store.hydrate() integration.
 * Slice 3: startPersistence() reactive write subscriptions.
 * Slice 4: upload pipeline blob plumbing.
 * Slice 5: welcome flag migration from localStorage.
 * Slice 6: pagehide flush, fallback path, unit tests.
 */

import Dexie, { type Table } from 'dexie'
import { BREAKPOINTS } from './breakpoints'
import { DEFAULT_DEVICES } from './devices'
import { galleryItems, type GalleryItem } from './gallery-data'
import { CURATED_EXAMPLE_IDS, store, type HydrationPayload, type Orientation, type StudioTab, type ViewMode } from './store.svelte'
import type { BreakpointName, Direction, DirectionKind, FrameState, ImageState, OutputFormat } from './types'
import type { DeviceCategory } from './devices'

// ---------- Debug logging ----------
// Flip to false to silence the diagnostic logs once the persistence chain is
// confirmed working in production.
const DEBUG = true
const log = (...args: unknown[]) => { if (DEBUG) console.log('[persistence]', ...args) }

// ---------- Versioning ----------

/**
 * Bump whenever the curated example metadata in gallery-data.ts changes
 * (added/removed examples, re-curated frames, dimensions, dominantColor).
 *
 * On every hydration, the seed pass compares this against the stored
 * `seedVersion` in preferences. If they differ, the pass walks every spec
 * example and:
 *   - inserts missing ones (handles offline-first-visit recovery)
 *   - overwrites unmodified ones with the new defaults (curation update)
 *   - leaves user-modified ones alone (user edits win)
 */
const EXAMPLE_SEED_VERSION = 1

/**
 * The examples to seed into IDB. Single source of truth lives in store.svelte.ts
 * (`CURATED_EXAMPLE_IDS`) — the same constant the sidebar iterates. Keeping the
 * seed list and the UI list pinned to one constant prevents the "stored but
 * invisible" drift that orphaned `crows` for a release.
 */
const SEEDED_EXAMPLE_IDS = CURATED_EXAMPLE_IDS

// ---------- Stored shapes ----------

export interface StoredDirection {
  id: string                              // 'example:napoleon' | uuid
  name: string
  filename: string | null
  naturalWidth: number | null
  naturalHeight: number | null
  dominantColor: string | null
  frames: FrameState[]
  modifiedBreakpoints: BreakpointName[]   // serialized from Set in the store
  lastModifiedBreakpoint: BreakpointName | null
  lastModifiedAt: number                  // 0 = never modified by user (used by seed merge)
  kind: DirectionKind
  exampleId: string | null
  isExample: boolean                      // denormalized for read convenience (NOT indexed; IDB rejects boolean keys)
  createdAt: number
  updatedAt: number
}

export interface StoredBlob {
  directionId: string
  blob: Blob
}

export interface StoredPreferences {
  key: 'singleton'                        // there is only ever one row
  welcomeSeen: boolean
  lastActiveDirectionId: string | null
  outputFormat: OutputFormat
  viewMode: ViewMode
  studioTab: StudioTab
  sidebarOpen: boolean
  selectedDevices: Record<DeviceCategory, string>
  orientations: Record<DeviceCategory, Orientation>
  seedVersion: number
}

// ---------- Dexie database ----------

class ArtDirectDB extends Dexie {
  directions!: Table<StoredDirection, string>
  blobs!: Table<StoredBlob, string>
  preferences!: Table<StoredPreferences, string>

  constructor() {
    super('art-direct')
    // Future schema changes go in db.version(2).stores({...}).upgrade(tx => {...})
    // Never edit version(1).
    this.version(1).stores({
      directions: 'id, updatedAt',          // primary: id (string)
      blobs: 'directionId',                  // primary: directionId — never index Blob columns
      preferences: 'key',                    // primary: 'key' (always 'singleton')
    })
  }
}

export const db = new ArtDirectDB()

// ---------- Availability ----------

let available = true

export function isPersistenceAvailable(): boolean {
  return available
}

// ---------- Frame helpers (mirrors store.svelte.ts buildFrames) ----------

function createDefaultFrame(breakpoint: BreakpointName): FrameState {
  return {
    breakpoint,
    scale: 1,
    translateX: 0,
    translateY: 0,
    objectFit: 'cover',
    objectPosition: 'center',
    transformOrigin: 'center',
  }
}

function buildFrames(configured: FrameState[] = []): FrameState[] {
  return BREAKPOINTS.map(bp => {
    const match = configured.find(f => f.breakpoint === bp.name)
    return match ? { ...match } : createDefaultFrame(bp.name)
  })
}

// ---------- Stored direction builders ----------

function getExampleFilename(item: GalleryItem): string {
  return item.image.split('/').pop() ?? item.image
}

function buildExampleStoredDirection(item: GalleryItem, now: number): StoredDirection {
  const filename = getExampleFilename(item)
  return {
    id: `example:${item.id}`,
    name: filename,
    filename,
    naturalWidth: item.naturalWidth,
    naturalHeight: item.naturalHeight,
    dominantColor: item.dominantColor,
    frames: buildFrames(item.frames),
    modifiedBreakpoints: item.frames.map(f => f.breakpoint),
    lastModifiedBreakpoint: null,
    lastModifiedAt: 0,                     // 0 = unmodified; merge pass will overwrite cleanly
    kind: 'example',
    exampleId: item.id,
    isExample: true,
    createdAt: now,
    updatedAt: now,
  }
}

// ---------- Self-healing example seed ----------

interface SeedDelta {
  toInsert: { direction: StoredDirection; blob: Blob }[]
  toUpdate: StoredDirection[]
}

/**
 * Compare the stored examples against the current gallery-data.ts source of truth
 * and return what needs to change. Idempotent — running this twice with no changes
 * returns an empty delta.
 *
 * Rules:
 *   - Missing example → insert (handles offline-first-visit recovery + future additions)
 *   - Existing example with `lastModifiedAt === 0` (user never touched) → overwrite frames
 *   - Existing example with user modifications → leave alone
 */
async function computeSeedDelta(now: number): Promise<SeedDelta> {
  const delta: SeedDelta = { toInsert: [], toUpdate: [] }

  // Resolve each curated example against gallery-data.ts. Skip silently if missing
  // (would be a developer error — the curated IDs must exist in gallery-data).
  const items = SEEDED_EXAMPLE_IDS
    .map(id => galleryItems.find(item => item.id === id))
    .filter((item): item is GalleryItem => item != null)

  for (const item of items) {
    const id = `example:${item.id}`
    const stored = await db.directions.get(id)

    if (!stored) {
      // Missing — fetch the blob and queue an insert. If the fetch fails (offline),
      // the example just stays missing and the next hydration will retry.
      try {
        const response = await fetch(item.image)
        if (!response.ok) continue
        const blob = await response.blob()
        delta.toInsert.push({
          direction: buildExampleStoredDirection(item, now),
          blob,
        })
      } catch {
        // Offline / fetch failure — skip silently. Self-heal next load.
      }
      continue
    }

    // Existing. Only overwrite if the user has never modified it.
    if (stored.lastModifiedAt === 0) {
      delta.toUpdate.push({
        ...stored,
        frames: buildFrames(item.frames),
        modifiedBreakpoints: item.frames.map(f => f.breakpoint),
        naturalWidth: item.naturalWidth,
        naturalHeight: item.naturalHeight,
        dominantColor: item.dominantColor,
        updatedAt: now,
      })
    }
  }

  return delta
}

async function applySeedDelta(delta: SeedDelta, newSeedVersion: number): Promise<void> {
  if (delta.toInsert.length === 0 && delta.toUpdate.length === 0) {
    // Nothing to insert/update, but still bump the version so we don't recompute every load.
    await db.preferences.update('singleton', { seedVersion: newSeedVersion })
    return
  }

  await db.transaction('rw', db.directions, db.blobs, db.preferences, async () => {
    if (delta.toInsert.length > 0) {
      await db.directions.bulkPut(delta.toInsert.map(entry => entry.direction))
      await db.blobs.bulkPut(
        delta.toInsert.map(entry => ({ directionId: entry.direction.id, blob: entry.blob }))
      )
    }
    if (delta.toUpdate.length > 0) {
      await db.directions.bulkPut(delta.toUpdate)
    }
    await db.preferences.update('singleton', { seedVersion: newSeedVersion })
  })
}

/**
 * Run the self-healing example seed pass.
 *
 * Called from hydrateStore() on every load (not just first install). Compares
 * the stored seedVersion against EXAMPLE_SEED_VERSION and reconciles missing /
 * unmodified / user-modified examples per the rules in computeSeedDelta.
 *
 * If preferences row doesn't exist yet (cold first install), this also creates
 * it with default values so the seedVersion update has somewhere to land.
 */
async function runSeedPass(): Promise<void> {
  const now = Date.now()
  const prefs = await db.preferences.get('singleton')

  // Ensure a preferences row exists. The seed bump (and future writes) need it.
  if (!prefs) {
    await db.preferences.put({
      key: 'singleton',
      welcomeSeen: false,
      lastActiveDirectionId: null,
      outputFormat: 'agent-instruction',
      viewMode: 'device',
      studioTab: 'compose',
      sidebarOpen: false,
      selectedDevices: { ...DEFAULT_DEVICES },
      orientations: { phone: 'portrait', tablet: 'landscape', desktop: 'landscape' },
      seedVersion: 0,
    })
  }

  const storedSeedVersion = prefs?.seedVersion ?? 0

  // If the version matches AND every spec example exists, skip the work.
  // This makes the common path (warm load with no changes) cheap.
  if (storedSeedVersion === EXAMPLE_SEED_VERSION) {
    const presentCount = await db.directions
      .where('id')
      .anyOf(SEEDED_EXAMPLE_IDS.map(id => `example:${id}`))
      .count()
    if (presentCount === SEEDED_EXAMPLE_IDS.length) return
  }

  const delta = await computeSeedDelta(now)
  await applySeedDelta(delta, EXAMPLE_SEED_VERSION)
}

// ---------- Stored → in-memory conversion ----------

/**
 * Build the static `/gallery/<id>.webp` ImageState for an example direction.
 *
 * Examples never need a Dexie blob fetch. The static URL is the same one the
 * store uses when seeding via createDirectionFromGallery, AND the same one
 * Layout.astro preloads as the LCP image. Reusing it means hydration doesn't
 * unmount the active <img> element when restoring an example.
 */
function staticImageStateForExample(stored: StoredDirection): ImageState | null {
  if (!stored.exampleId || stored.naturalWidth == null || stored.naturalHeight == null || !stored.filename) {
    return null
  }
  const item = galleryItems.find(g => g.id === stored.exampleId)
  if (!item) return null
  return {
    blobUrl: item.image,
    filename: stored.filename,
    naturalWidth: stored.naturalWidth,
    naturalHeight: stored.naturalHeight,
  }
}

/** Build an ImageState from a Dexie blob row. Used for active uploaded direction + lazy fills. */
function imageStateFromBlob(stored: StoredDirection, blob: Blob): ImageState | null {
  if (!stored.filename || stored.naturalWidth == null || stored.naturalHeight == null) return null
  return {
    blobUrl: URL.createObjectURL(blob),
    filename: stored.filename,
    naturalWidth: stored.naturalWidth,
    naturalHeight: stored.naturalHeight,
  }
}

function fromStored(stored: StoredDirection, image: ImageState | null): Direction {
  return {
    id: stored.id,
    name: stored.name,
    image,
    frames: stored.frames,
    dominantColor: stored.dominantColor,
    modifiedBreakpoints: new Set(stored.modifiedBreakpoints),
    lastModifiedBreakpoint: stored.lastModifiedBreakpoint,
    lastModifiedAt: stored.lastModifiedAt,
    kind: stored.kind,
    exampleId: stored.exampleId ?? undefined,
  }
}

// ---------- Lazy blob loads (uploaded directions only) ----------

/**
 * After hydration, kick off background blob loads for any non-active uploaded
 * directions. Each resolved load patches the store with a fresh blob URL.
 * Sidebar.svelte already handles the `image == null` placeholder gracefully
 * while the load is in flight.
 */
function queueLazyBlobLoads(stored: StoredDirection[], activeId: string | null): void {
  for (const s of stored) {
    if (s.id === activeId) continue
    if (s.kind === 'example') continue        // examples use static URLs, no blob load
    if (!s.filename) continue                  // blank directions have no image

    db.blobs.get(s.id).then(record => {
      if (!record) return
      const image = imageStateFromBlob(s, record.blob)
      if (image) store.patchDirection(s.id, { image })
    }).catch(err => {
      console.warn('[persistence] failed to lazy-load blob for', s.id, err)
    })
  }
}

// ---------- Hydration entry point ----------

/**
 * Hydration entry point. Called once on Studio mount via Studio.svelte's
 * mount $effect.
 *
 * Flow:
 *   1. Open Dexie (catches private-browsing / quota failures and degrades to
 *      ephemeral mode).
 *   2. Run the self-healing example seed pass.
 *   3. Read preferences and direction list.
 *   4. Resolve the active direction id (last-active → most-recent → Napoleon).
 *   5. Load the active direction's image:
 *      - Examples → static `/gallery/<id>.webp` URL (LCP-friendly).
 *      - Uploaded → fresh `URL.createObjectURL(stored.blob)`.
 *   6. Build the hydration payload and call `store.hydrate(payload)`.
 *   7. Kick off lazy blob loads for the remaining uploaded directions.
 *
 * If anything in steps 1-2 throws, persistence is marked unavailable and the
 * store keeps the in-memory seed (Napoleon).
 */
export async function hydrateStore(): Promise<void> {
  try {
    log('hydrateStore: opening db')
    await db.open()
    await runSeedPass()
    log('hydrateStore: seed pass complete')
  } catch (err) {
    available = false
    console.warn('[persistence] disabled:', err)
    return
  }

  try {
    let prefs = await db.preferences.get('singleton')

    // One-time migration: localStorage['artdirect-welcome-seen'] → Dexie preferences.
    // Idempotent — runs every load but only does work the first time.
    if (prefs && !prefs.welcomeSeen) {
      try {
        if (typeof localStorage !== 'undefined' && localStorage.getItem('artdirect-welcome-seen') === '1') {
          await db.preferences.update('singleton', { welcomeSeen: true })
          try { localStorage.removeItem('artdirect-welcome-seen') } catch {}
          prefs = { ...prefs, welcomeSeen: true }
        }
      } catch {
        // localStorage unavailable (private mode) — nothing to migrate.
      }
    }

    const stored = await db.directions.orderBy('updatedAt').reverse().toArray()
    log('hydrateStore: read', stored.length, 'directions from db')
    for (const s of stored) {
      log('  →', s.id, 'lastModifiedAt:', s.lastModifiedAt, 'frames[0]:', s.frames[0])
    }

    if (stored.length === 0) {
      // The seed pass should normally populate at least one example. The only
      // way to land here is if the seed fetch failed (offline first visit).
      // Studio continues with the in-memory Napoleon — nothing to hydrate.
      return
    }

    // Resolve the active direction id.
    //
    // First-visit default MUST match the LCP `<link rel="preload">` in
    // Layout.astro:26 (currently `napoleon.webp`). Without this, on a cold
    // install all curated examples share an `updatedAt` (same `now` inside the
    // seed transaction); Dexie tie-breaks `orderBy('updatedAt').reverse()` by
    // primary key, so `stored[0]` becomes whichever id sorts last alphabetically
    // — `example:wave` — and the preload is wasted on a different image than
    // the studio renders. Pinning to napoleon keeps the preload aligned.
    const lastActiveId = prefs?.lastActiveDirectionId ?? null
    const lastActiveExists = lastActiveId != null && stored.some(d => d.id === lastActiveId)
    const napoleonId = 'example:napoleon'
    const napoleonStored = stored.some(d => d.id === napoleonId)
    const activeId = lastActiveExists
      ? lastActiveId
      : (napoleonStored ? napoleonId : (stored[0]?.id ?? null))

    // Load the active direction's image synchronously (blocks hydrate by ~1 await).
    const activeStored = stored.find(d => d.id === activeId) ?? null
    let activeImage: ImageState | null = null
    if (activeStored) {
      if (activeStored.kind === 'example') {
        activeImage = staticImageStateForExample(activeStored)
      } else if (activeStored.filename) {
        const record = await db.blobs.get(activeStored.id)
        if (record) activeImage = imageStateFromBlob(activeStored, record.blob)
      }
    }

    // Build in-memory directions: active gets its loaded image, examples get
    // static URLs immediately, other uploaded directions start with `image: null`
    // and get filled in by the lazy loader below.
    const directions: Direction[] = stored.map(s => {
      if (s.id === activeId) return fromStored(s, activeImage)
      if (s.kind === 'example') return fromStored(s, staticImageStateForExample(s))
      return fromStored(s, null)
    })

    const payload: HydrationPayload = {
      directions,
      activeDirectionId: activeId,
      outputFormat: prefs?.outputFormat ?? 'agent-instruction',
      viewMode: prefs?.viewMode ?? 'device',
      studioTab: prefs?.studioTab ?? 'compose',
      sidebarOpen: prefs?.sidebarOpen ?? false,
      selectedDevices: prefs?.selectedDevices ?? { ...DEFAULT_DEVICES },
      orientations: prefs?.orientations ?? { phone: 'portrait', tablet: 'landscape', desktop: 'landscape' },
      welcomeSeen: prefs?.welcomeSeen ?? false,
    }

    store.hydrate(payload)

    // Background blob loads for non-active uploaded/blank directions.
    queueLazyBlobLoads(stored, activeId)
  } catch (err) {
    console.warn('[persistence] hydration read-back failed:', err)
  }
}

// ---------- Reactive writes ----------

/**
 * Per-key debounce. Each pending write owns its timer plus the closure that
 * will run when the timer fires. Storing the closure (not just the timer)
 * lets `flushAllPending` re-trigger the same write synchronously on pagehide.
 */
interface PendingWrite {
  timer: ReturnType<typeof setTimeout>
  run: () => Promise<void>
}

const DEBOUNCE_MS = 500
const PREFS_KEY = '__prefs__'
const pendingWrites = new Map<string, PendingWrite>()

function scheduleWrite(key: string, run: () => Promise<void>): void {
  const existing = pendingWrites.get(key)
  if (existing) clearTimeout(existing.timer)
  log('scheduleWrite', key, existing ? '(cancelled previous)' : '')
  const timer = setTimeout(() => {
    pendingWrites.delete(key)
    log('write firing', key)
    run()
      .then(() => log('write OK', key))
      .catch(err => console.warn('[persistence] write failed:', key, err))
  }, DEBOUNCE_MS)
  pendingWrites.set(key, { timer, run })
}

function cancelPending(key: string): PendingWrite | undefined {
  const entry = pendingWrites.get(key)
  if (entry) {
    clearTimeout(entry.timer)
    pendingWrites.delete(key)
  }
  return entry
}

function flushAllPending(): void {
  const entries = Array.from(pendingWrites.entries())
  pendingWrites.clear()
  for (const [, { timer, run }] of entries) {
    clearTimeout(timer)
    run().catch(err => console.warn('[persistence] flush failed:', err))
  }
}

/** Convert an in-memory Direction to its stored shape. createdAt is filled in by the writer. */
function toStored(d: Direction): Omit<StoredDirection, 'createdAt'> {
  return {
    id: d.id,
    name: d.name,
    filename: d.image?.filename ?? null,
    naturalWidth: d.image?.naturalWidth ?? null,
    naturalHeight: d.image?.naturalHeight ?? null,
    dominantColor: d.dominantColor,
    frames: d.frames.map(f => ({ ...f })),
    modifiedBreakpoints: [...d.modifiedBreakpoints],
    lastModifiedBreakpoint: d.lastModifiedBreakpoint,
    lastModifiedAt: d.lastModifiedAt,
    kind: d.kind,
    exampleId: d.exampleId ?? null,
    isExample: d.kind === 'example',
    updatedAt: Date.now(),
  }
}

/**
 * Cheap structural hash used to detect "did this direction actually change since last snapshot."
 *
 * `lastModifiedBreakpoint` is intentionally excluded: it's a transient UI flag
 * that drives the OutputPanel marching-ants animation and is cleared by a
 * follow-up `clearLastModified()` call ~2s after every mutation. Including it
 * would fire a second IDB write per drag/zoom/toggle even though no durable
 * state actually changed.
 */
function hashDirection(d: Direction): string {
  return JSON.stringify({
    n: d.name,
    f: d.frames,
    mb: [...d.modifiedBreakpoints].sort(),
    lma: d.lastModifiedAt,
    dc: d.dominantColor,
    k: d.kind,
    eid: d.exampleId ?? null,
    if: d.image?.filename ?? null,
    iw: d.image?.naturalWidth ?? null,
    ih: d.image?.naturalHeight ?? null,
  })
}

function hashPrefs(): string {
  return JSON.stringify({
    of: store.outputFormat,
    vm: store.viewMode,
    st: store.studioTab,
    so: store.sidebarOpen,
    sd: store.selectedDevices,
    or: store.orientations,
    aid: store.activeDirectionId,
    ws: store.welcomeSeen,
  })
}

const directionSnapshots = new Map<string, string>()
let prefsSnapshot = ''
let teardownRoot: (() => void) | null = null

function scheduleDirectionWrite(d: Direction): void {
  // Capture the direction reference, not a snapshot — we want the LATEST state
  // when the timer fires, not the state from when the change was detected.
  scheduleWrite(`dir:${d.id}`, async () => {
    const partial = toStored(d)
    log('toStored snapshot', d.id, 'lastModifiedAt:', partial.lastModifiedAt, 'frames[0]:', partial.frames[0])
    const existing = await db.directions.get(d.id)
    const createdAt = existing?.createdAt ?? Date.now()
    await db.directions.put({ ...partial, createdAt })
    log('db.directions.put OK', d.id)
  })
}

function scheduleDirectionDelete(id: string): void {
  // A pending write for the just-deleted direction is pointless. Cancel it.
  cancelPending(`dir:${id}`)
  db.transaction('rw', db.directions, db.blobs, async () => {
    await db.directions.delete(id)
    await db.blobs.delete(id)
  }).catch(err => console.warn('[persistence] delete failed:', id, err))
}

function schedulePrefsWrite(): void {
  scheduleWrite(PREFS_KEY, async () => {
    await db.preferences.update('singleton', {
      outputFormat: store.outputFormat,
      viewMode: store.viewMode,
      studioTab: store.studioTab,
      sidebarOpen: store.sidebarOpen,
      selectedDevices: { ...store.selectedDevices },
      orientations: { ...store.orientations },
      lastActiveDirectionId: store.activeDirectionId,
      welcomeSeen: store.welcomeSeen,
    })
  })
}

/**
 * Subscribe the persistence layer to store mutations. Wraps Svelte 5's
 * `$effect.root` so the watchers can live outside any component tree — they're
 * tied to the Studio mount lifecycle via the cleanup function we return.
 *
 * Two effects:
 *   - direction list + per-direction fields → debounced per-id writes / immediate deletes
 *   - persisted preference fields → debounced single-key write
 *
 * Plus a `pagehide` / `visibilitychange:hidden` listener that fires pending
 * writes immediately (fire-and-forget — IndexedDB is async and can't be
 * synchronously awaited during unload). The 500ms debounce is the real safety
 * net for typical interaction patterns; the page-hide flush catches the
 * "user dragged then immediately closed the tab" edge.
 *
 * Snapshots are pre-filled from current store state so the first effect run
 * sees "no changes" and doesn't immediately re-write the just-hydrated state.
 */
export function startPersistence(): () => void {
  if (!available) return () => {}
  log('startPersistence called, current directions:', store.directions.map(d => d.id))

  // Prefill so the first effect tick is a no-op against freshly hydrated state.
  directionSnapshots.clear()
  for (const d of store.directions) {
    directionSnapshots.set(d.id, hashDirection(d))
  }
  prefsSnapshot = hashPrefs()

  teardownRoot = $effect.root(() => {
    // Direction list + nested fields. We EXPLICITLY read every tracked field
    // (including each FrameState property) to make Svelte 5's fine-grained
    // reactivity subscribe at the leaf level. Relying on JSON.stringify inside
    // hashDirection to walk the proxy is not reliable for nested array element
    // mutations like `d.frames[idx] = { ... }` — the iterator protocol does
    // not create the same per-property subscriptions that explicit reads do.
    $effect(() => {
      const dirList = store.directions
      const currentIds = new Set<string>()
      log('directions effect tick, count:', dirList.length)

      for (let i = 0; i < dirList.length; i++) {
        const d = dirList[i]
        currentIds.add(d.id)

        // Touch top-level fields so Svelte tracks them.
        // `lastModifiedBreakpoint` is deliberately not tracked: see hashDirection.
        void d.name
        void d.dominantColor
        void d.lastModifiedAt          // bumped on every updateFrame call
        void d.kind
        void d.exampleId
        void d.image
        if (d.image) {
          void d.image.filename
          void d.image.naturalWidth
          void d.image.naturalHeight
        }
        // modifiedBreakpoints is a Set; iterate it so Svelte tracks element changes.
        for (const _bp of d.modifiedBreakpoints) void _bp

        // Per-frame fields. The store mutates `d.frames[idx] = { ... }`, so we
        // need to subscribe to each frame's properties (not just `d.frames`).
        const framesLen = d.frames.length
        for (let j = 0; j < framesLen; j++) {
          const f = d.frames[j]
          void f.breakpoint
          void f.scale
          void f.translateX
          void f.translateY
          void f.objectFit
          void f.objectPosition
          void f.transformOrigin
        }

        const hash = hashDirection(d)
        const prev = directionSnapshots.get(d.id)
        if (prev !== hash) {
          log('hash diff', d.id, 'lastModifiedAt:', d.lastModifiedAt)
          directionSnapshots.set(d.id, hash)
          scheduleDirectionWrite(d)
        }
      }

      // Detect deletions: anything in our snapshot map that's no longer in the store.
      for (const id of Array.from(directionSnapshots.keys())) {
        if (!currentIds.has(id)) {
          directionSnapshots.delete(id)
          scheduleDirectionDelete(id)
        }
      }
    })

    // Preferences
    $effect(() => {
      // Explicit reads (matches the directions effect's pattern).
      void store.outputFormat
      void store.viewMode
      void store.studioTab
      void store.sidebarOpen
      void store.activeDirectionId
      void store.welcomeSeen
      void store.selectedDevices.phone
      void store.selectedDevices.tablet
      void store.selectedDevices.desktop
      void store.orientations.phone
      void store.orientations.tablet
      void store.orientations.desktop

      const hash = hashPrefs()
      if (hash !== prefsSnapshot) {
        prefsSnapshot = hash
        schedulePrefsWrite()
      }
    })
  })

  // Page-hide flush. Both events fire fire-and-forget — we can't synchronously
  // wait on IndexedDB writes during unload, but starting them gives Dexie a
  // chance to commit before the page is gone.
  const onPageHide = () => flushAllPending()
  const onVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      flushAllPending()
    }
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', onPageHide)
    document.addEventListener('visibilitychange', onVisibility)
  }

  return () => {
    teardownRoot?.()
    teardownRoot = null
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('visibilitychange', onVisibility)
    }
    flushAllPending()
  }
}

/** Explicit immediate flush for preferences. Used by welcome flag write + tests. */
export async function persistPreferencesNow(): Promise<void> {
  if (!available) return
  cancelPending(PREFS_KEY)
  await db.preferences.update('singleton', {
    outputFormat: store.outputFormat,
    viewMode: store.viewMode,
    studioTab: store.studioTab,
    sidebarOpen: store.sidebarOpen,
    selectedDevices: { ...store.selectedDevices },
    orientations: { ...store.orientations },
    lastActiveDirectionId: store.activeDirectionId,
    welcomeSeen: store.welcomeSeen,
  })
  // Keep the snapshot in sync so the reactive watcher doesn't re-fire.
  prefsSnapshot = hashPrefs()
}

/**
 * Explicit immediate write for fresh uploads. Cancels any pending debounced
 * write for this id, persists the direction record + blob in a single
 * transaction, and updates the snapshot map so the reactive watcher doesn't
 * re-fire for this state.
 *
 * Called from upload.ts entry points right after the store mutation, because
 * uploads are the moment the user expects "saved" — no 500ms debounce.
 */
export async function persistDirectionNow(id: string, blob?: Blob): Promise<void> {
  if (!available) return

  cancelPending(`dir:${id}`)

  const direction = store.directions.find(d => d.id === id)
  if (!direction) return

  const partial = toStored(direction)
  const existing = await db.directions.get(id)
  const createdAt = existing?.createdAt ?? Date.now()

  await db.transaction('rw', db.directions, db.blobs, async () => {
    await db.directions.put({ ...partial, createdAt })
    if (blob) {
      await db.blobs.put({ directionId: id, blob })
    }
  })

  directionSnapshots.set(id, hashDirection(direction))
}

// ---------- Test / debug helper ----------

/** Wipe all persisted state. Used by tests and "clear browser data" parity. */
export async function clearAll(): Promise<void> {
  if (!available) return
  await db.transaction('rw', db.directions, db.blobs, db.preferences, async () => {
    await db.directions.clear()
    await db.blobs.clear()
    await db.preferences.clear()
  })
}

/**
 * Test-only: tear down in-memory persistence state. Restores `available =
 * true`, clears snapshot maps, cancels pending timers, tears down the
 * $effect.root. By default also wipes + reopens the Dexie database; pass
 * `{ wipeDb: false }` to simulate a page reload (in-memory state resets but
 * the persisted db survives).
 *
 * Not for production use. Underscore prefix signals "internal test seam."
 */
export async function __resetForTesting(opts: { wipeDb?: boolean } = {}): Promise<void> {
  const wipeDb = opts.wipeDb ?? true
  if (teardownRoot) {
    teardownRoot()
    teardownRoot = null
  }
  for (const [, { timer }] of pendingWrites) clearTimeout(timer)
  pendingWrites.clear()
  directionSnapshots.clear()
  prefsSnapshot = ''
  if (wipeDb) {
    try {
      await db.delete()
    } catch {}
    available = true
    await db.open()
  }
}
