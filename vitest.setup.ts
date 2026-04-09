/**
 * Vitest setup. Runs once before each test file.
 *
 * - fake-indexeddb/auto: installs an in-memory IndexedDB implementation on
 *   globalThis. Dexie talks to it transparently.
 * - URL.createObjectURL stub: happy-dom provides URL but its createObjectURL
 *   isn't fully implemented for Blobs in our test scenarios. We stub it to
 *   return a deterministic placeholder so direction.image.blobUrl assertions
 *   are stable.
 */

import 'fake-indexeddb/auto'

// Stable, deterministic blob URL stub for tests. The real one creates a unique
// blob: URL per call; we don't need uniqueness in tests, just a non-empty string.
let blobUrlCounter = 0
if (typeof URL !== 'undefined') {
  URL.createObjectURL = () => `blob:test://${++blobUrlCounter}`
  URL.revokeObjectURL = () => {}
}
