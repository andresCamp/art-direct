/**
 * Tests for the Dexie persistence layer.
 *
 * Strategy:
 *   - fake-indexeddb (set up in vitest.setup.ts) gives us an in-memory IDB
 *     so Dexie's real code paths run without a browser.
 *   - happy-dom provides URL / Blob / document globals.
 *   - fetch is stubbed per-test to return a placeholder image Blob for the
 *     seed pass that fetches /gallery/<id>.webp.
 *   - __resetForTesting() tears down the persistence module's in-memory
 *     state (and optionally wipes the db) between tests.
 *   - store.reset() returns the in-memory store to its seeded baseline.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  db,
  hydrateStore,
  startPersistence,
  persistDirectionNow,
  persistPreferencesNow,
  __resetForTesting,
} from '../persistence.svelte'
import { store } from '../store.svelte'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeFetchMock() {
  return vi.fn(async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/webp' })
    return new Response(blob, { status: 200 })
  })
}

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

// Real timers + 600ms wait covers the 500ms debounce + an IDB transaction round trip.
async function waitForDebouncedWrite() {
  await wait(600)
}

/** Simulate a page reload: soft-reset persistence (keep db), reseed store, re-hydrate. */
async function simulateReload() {
  await __resetForTesting({ wipeDb: false })
  store.reset()
  await hydrateStore()
}

// ─── Setup / teardown ───────────────────────────────────────────────────────

beforeEach(async () => {
  vi.stubGlobal('fetch', makeFetchMock())
  await __resetForTesting()
  store.reset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ─── Seed pass ──────────────────────────────────────────────────────────────

describe('persistence — seed pass', () => {
  it('seeds the 3 curated examples on a fresh db', async () => {
    await hydrateStore()
    const ids = (await db.directions.toArray()).map(d => d.id).sort()
    expect(ids).toEqual([
      'example:adam',
      'example:napoleon',
      'example:wave',
    ])
    expect(await db.blobs.count()).toBe(3)
  })

  it('is idempotent — running hydrateStore twice does not duplicate', async () => {
    await hydrateStore()
    await __resetForTesting({ wipeDb: false })
    store.reset()
    await hydrateStore()
    expect(await db.directions.count()).toBe(3)
    expect(await db.blobs.count()).toBe(3)
  })

  it('creates a preferences row with seedVersion bumped', async () => {
    await hydrateStore()
    const prefs = await db.preferences.get('singleton')
    expect(prefs).toBeDefined()
    expect(prefs?.seedVersion).toBeGreaterThanOrEqual(1)
    expect(prefs?.welcomeSeen).toBe(false)
  })

  it('marks examples as kind=example with isExample flag', async () => {
    await hydrateStore()
    const napoleon = await db.directions.get('example:napoleon')
    expect(napoleon?.kind).toBe('example')
    expect(napoleon?.isExample).toBe(true)
    expect(napoleon?.exampleId).toBe('napoleon')
  })
})

// ─── Self-heal seed pass ────────────────────────────────────────────────────

describe('persistence — self-healing seed', () => {
  it('backfills a missing example on subsequent hydration', async () => {
    await hydrateStore()
    // Simulate a corrupt / partially-deleted state.
    await db.directions.delete('example:wave')
    await db.blobs.delete('example:wave')
    expect(await db.directions.count()).toBe(2)

    // Reload — seed pass should detect the missing example and reinsert it.
    await simulateReload()
    expect(await db.directions.count()).toBe(3)
    expect(await db.directions.get('example:wave')).toBeDefined()
  })

  it('preserves user-modified examples (lastModifiedAt > 0)', async () => {
    await hydrateStore()
    // Mutate Napoleon directly in the db with a non-zero lastModifiedAt.
    const napoleon = await db.directions.get('example:napoleon')
    expect(napoleon).toBeDefined()
    const userTranslateX = 999
    napoleon!.frames = napoleon!.frames.map(f =>
      f.breakpoint === 'base' ? { ...f, translateX: userTranslateX } : f
    )
    napoleon!.lastModifiedAt = Date.now()
    await db.directions.put(napoleon!)

    // Force the seed pass to recompute the delta by removing seedVersion.
    const prefs = await db.preferences.get('singleton')
    await db.preferences.put({ ...prefs!, seedVersion: 0 })

    // Reload — even with seed pass running, the modified Napoleon should not
    // be overwritten because lastModifiedAt > 0.
    await simulateReload()
    const restored = await db.directions.get('example:napoleon')
    const baseFrame = restored?.frames.find(f => f.breakpoint === 'base')
    expect(baseFrame?.translateX).toBe(userTranslateX)
  })
})

// ─── Hydration read-back ────────────────────────────────────────────────────

describe('persistence — hydration', () => {
  it('populates store.directions from the db', async () => {
    await hydrateStore()
    expect(store.directions.length).toBe(3)
    expect(store.directions.find(d => d.id === 'example:napoleon')).toBeDefined()
  })

  it('rehydrates modifiedBreakpoints as a Set (round-trip Set ↔ Array)', async () => {
    await hydrateStore()
    const napoleon = store.directions.find(d => d.id === 'example:napoleon')
    expect(napoleon?.modifiedBreakpoints).toBeInstanceOf(Set)
    // Napoleon's seeded frames define configured frames at base/lg/xl.
    expect(napoleon?.modifiedBreakpoints.has('base')).toBe(true)
  })

  it('restores lastActiveDirectionId across reloads', async () => {
    await hydrateStore()
    const cleanup = startPersistence()
    store.setActiveDirection('example:wave')
    await persistPreferencesNow()
    cleanup()

    await simulateReload()
    expect(store.activeDirectionId).toBe('example:wave')
  })

  it('restores outputFormat / viewMode / orientations across reloads', async () => {
    await hydrateStore()
    const cleanup = startPersistence()
    store.setOutputFormat('img')
    store.setViewMode('tailwind')
    store.toggleOrientation('phone')
    await persistPreferencesNow()
    cleanup()

    await simulateReload()
    expect(store.outputFormat).toBe('img')
    expect(store.viewMode).toBe('tailwind')
    expect(store.orientations.phone).toBe('landscape')
  })

  it('restores studioTab (compose/preview) across reloads', async () => {
    await hydrateStore()
    const cleanup = startPersistence()
    store.setStudioTab('preview')
    await persistPreferencesNow()
    cleanup()

    await simulateReload()
    expect(store.studioTab).toBe('preview')
  })

  it('restores sidebarOpen across reloads', async () => {
    await hydrateStore()
    const cleanup = startPersistence()
    store.setSidebar(true)
    await persistPreferencesNow()
    cleanup()

    await simulateReload()
    expect(store.sidebarOpen).toBe(true)
  })
})

// ─── persistDirectionNow (uploads / immediate writes) ──────────────────────

describe('persistence — persistDirectionNow', () => {
  it('writes a fresh upload + blob immediately', async () => {
    await hydrateStore()
    const cleanup = startPersistence()

    const fakeImage = {
      blobUrl: 'blob:test://upload',
      filename: 'test.png',
      naturalWidth: 800,
      naturalHeight: 600,
    }
    const id = store.addDirection(fakeImage)
    const blob = new Blob([new Uint8Array([9, 9, 9])], { type: 'image/png' })
    await persistDirectionNow(id, blob)

    const stored = await db.directions.get(id)
    expect(stored).toBeDefined()
    expect(stored?.kind).toBe('upload')
    expect(stored?.filename).toBe('test.png')

    const storedBlob = await db.blobs.get(id)
    // fake-indexeddb in happy-dom doesn't faithfully structured-clone Blob
    // internals (Blob.size/prototype get stripped), but preserves the row
    // identity + the `type` discriminator. In a real browser this round-trips
    // perfectly — verified end-to-end via the manual checklist. In tests we
    // assert the row exists with the right type tag.
    expect(storedBlob).toBeDefined()
    expect(storedBlob?.directionId).toBe(id)
    expect((storedBlob?.blob as Blob).type).toBe('image/png')

    cleanup()
  })
})

// ─── Reactive write watcher ─────────────────────────────────────────────────

describe('persistence — reactive write watcher', () => {
  it('persists a frame mutation after the debounce window', async () => {
    await hydrateStore()
    store.setActiveDirection('example:napoleon')
    const cleanup = startPersistence()

    store.updateFrame('base', { translateX: 42, translateY: 17 })
    await waitForDebouncedWrite()

    const stored = await db.directions.get('example:napoleon')
    const baseFrame = stored?.frames.find(f => f.breakpoint === 'base')
    expect(baseFrame?.translateX).toBe(42)
    expect(baseFrame?.translateY).toBe(17)
    expect(stored?.lastModifiedAt).toBeGreaterThan(0)

    cleanup()
  })

  it('persists frame mutations across a simulated reload', async () => {
    await hydrateStore()
    store.setActiveDirection('example:napoleon')
    const cleanup = startPersistence()

    store.updateFrame('lg', { scale: 1.5, objectPosition: '25% 75%' })
    await waitForDebouncedWrite()
    cleanup()

    await simulateReload()
    const napoleon = store.directions.find(d => d.id === 'example:napoleon')
    const lgFrame = napoleon?.frames.find(f => f.breakpoint === 'lg')
    expect(lgFrame?.scale).toBe(1.5)
    expect(lgFrame?.objectPosition).toBe('25% 75%')
  })

  it('persists prefs changes after the debounce window', async () => {
    await hydrateStore()
    const cleanup = startPersistence()

    store.setOutputFormat('css')
    store.setViewMode('tailwind')
    await waitForDebouncedWrite()

    const prefs = await db.preferences.get('singleton')
    expect(prefs?.outputFormat).toBe('css')
    expect(prefs?.viewMode).toBe('tailwind')

    cleanup()
  })

  it('coalesces rapid frame drags into a single write', async () => {
    await hydrateStore()
    store.setActiveDirection('example:napoleon')
    const cleanup = startPersistence()

    // Spy on db.directions.put — count writes to napoleon's row.
    const putSpy = vi.spyOn(db.directions, 'put')

    // 10 rapid mutations within the debounce window.
    for (let i = 0; i < 10; i++) {
      store.updateFrame('base', { translateX: i })
      await wait(20)
    }
    await waitForDebouncedWrite()

    // Filter to writes targeting napoleon (ignore any unrelated puts).
    const napoleonWrites = putSpy.mock.calls.filter(call => {
      const arg = call[0] as { id?: string }
      return arg?.id === 'example:napoleon'
    })
    // Debounce should coalesce the 10 rapid changes into <= 2 writes
    // (one for the burst, possibly one trailing).
    expect(napoleonWrites.length).toBeLessThanOrEqual(2)

    // Final state must reflect the LAST mutation.
    const stored = await db.directions.get('example:napoleon')
    const baseFrame = stored?.frames.find(f => f.breakpoint === 'base')
    expect(baseFrame?.translateX).toBe(9)

    putSpy.mockRestore()
    cleanup()
  })

  it('immediately deletes a direction (no debounce)', async () => {
    await hydrateStore()
    const cleanup = startPersistence()

    // Add a user upload direction so we have something deletable.
    const id = store.addDirection({
      blobUrl: 'blob:test://x',
      filename: 'x.png',
      naturalWidth: 100,
      naturalHeight: 100,
    })
    await persistDirectionNow(id, new Blob([new Uint8Array([1])], { type: 'image/png' }))
    expect(await db.directions.get(id)).toBeDefined()

    store.removeDirection(id)
    // Allow the effect to fire and the immediate delete transaction to commit.
    await wait(50)

    expect(await db.directions.get(id)).toBeUndefined()
    expect(await db.blobs.get(id)).toBeUndefined()

    cleanup()
  })
})

// ─── Welcome flag migration ─────────────────────────────────────────────────

describe('persistence — welcome flag migration', () => {
  it('migrates localStorage["artdirect-welcome-seen"] to Dexie preferences', async () => {
    // Pre-seed localStorage to simulate a returning user from a pre-Dexie build.
    localStorage.setItem('artdirect-welcome-seen', '1')
    await hydrateStore()

    const prefs = await db.preferences.get('singleton')
    expect(prefs?.welcomeSeen).toBe(true)
    // localStorage should be cleared after migration.
    expect(localStorage.getItem('artdirect-welcome-seen')).toBeNull()
    // The store should reflect the migrated value.
    expect(store.welcomeSeen).toBe(true)
  })

  it('does nothing if localStorage flag is absent', async () => {
    await hydrateStore()
    const prefs = await db.preferences.get('singleton')
    expect(prefs?.welcomeSeen).toBe(false)
  })
})
