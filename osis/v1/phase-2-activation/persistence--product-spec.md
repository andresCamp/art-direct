# Persistence — Product Spec

## Purpose

Persistence makes Art Direct remember. Images, directions, and preferences survive page refreshes and return visits. Without it, every session starts from zero — the user loses their work the moment they close the tab. Persistence turns Art Direct from a one-shot tool into a workspace.

### The Analogy

Think of browser DevTools — your breakpoints, console history, and saved snippets persist across sessions without accounts or cloud sync. All local, all instant. Art Direct's persistence works the same way: IndexedDB via Dexie.js, no server, no sign-up.

Where it sits in the pipeline:

```
[User action] → [Store (reactive state)] → [Dexie (IndexedDB)]
                                         ↔
[Page load] ← [Store hydrated from Dexie]
```

## Inputs

- Image blobs (from upload or gallery selection)
- Frame states per direction (from store)
- Welcome modal "seen" flag (from localStorage, migrated)
- Direction metadata (filename, dominant color, created timestamp)

## Data Model

### Direction
The primary entity. One image + its set of breakpoint compositions.

- `id`: auto-increment
- `image`: Blob (stored directly in IndexedDB — no blob URLs across sessions)
- `filename`: string
- `naturalWidth`: number
- `naturalHeight`: number
- `dominantColor`: string (hex)
- `frames`: FrameState[] (6 breakpoints)
- `createdAt`: timestamp
- `updatedAt`: timestamp
- `isExample`: boolean (gallery examples are seeded, not deletable)

### Preferences
Single record for app-level state.

- `welcomeSeen`: boolean (migrated from localStorage)
- `lastActiveDirectionId`: number (restore on return)
- `outputFormat`: string (remember last selected format)

## Interaction Model

Persistence is invisible. The user never "saves" — state flows to IndexedDB automatically as they work.

- **On page load:** Dexie hydrates the store. Last active direction loads. If no directions exist (fresh install), seed gallery examples and pick one randomly.
- **On frame manipulation:** Debounced write to Dexie (~500ms). No save button.
- **On image upload:** Blob stored in IndexedDB immediately. Direction created.
- **On direction switch:** `lastActiveDirectionId` updated.
- **On return visit:** Last active direction loads. Sidebar shows all persisted directions.

## The Flow

### First Visit (Fresh Install)
1. Dexie initializes, finds empty database
2. Seed gallery examples (Wave, Adam, Napoleon, Crows) as directions with `isExample: true` and pre-configured frames
3. Pick one randomly as active
4. Store hydrated, studio renders
5. Welcome modal shows (welcomeSeen: false)

### Return Visit
1. Dexie initializes, finds existing data
2. Load `lastActiveDirectionId` from preferences
3. Hydrate store with that direction's image + frames
4. Studio renders where they left off
5. No welcome modal (welcomeSeen: true)

### Creating a New Direction
1. User uploads image or clicks "New"
2. Direction record created in Dexie with default frames
3. `lastActiveDirectionId` updated
4. Store switches to new direction

### Switching Directions
1. User clicks a direction in sidebar
2. Current direction's frames already persisted (debounced writes)
3. Store loads new direction from Dexie
4. `lastActiveDirectionId` updated
5. Studio updates

### Deleting a Direction
1. User deletes from sidebar (UI TBD — swipe, X button, or context menu)
2. Direction removed from Dexie (blob + frames)
3. If it was active, switch to most recent remaining direction
4. Gallery examples (`isExample: true`) cannot be deleted — hide the delete action for these

## Behavioral Rules

- **Never block the UI for persistence.** All Dexie writes are fire-and-forget with debounce. If IndexedDB is slow, the user doesn't notice.
- **Debounce frame writes at ~500ms.** A user dragging rapidly generates dozens of state changes per second. Only persist when they pause.
- **Blob storage, not blob URLs.** Blob URLs are session-scoped and break on refresh. Store the actual Blob in IndexedDB and create a fresh blob URL on hydration.
- **Gallery examples are seeded, not re-downloaded.** On first visit, fetch gallery images from /public/gallery/ once and store in Dexie. Subsequent loads read from IndexedDB.
- **Migrate localStorage gracefully.** Check for the `artdirect-welcome-seen` localStorage flag, migrate to Dexie preferences, then clean up localStorage.
- **Storage limits are generous.** IndexedDB typically allows hundreds of MB. A handful of images is well within limits. No quota management needed for v1.
- **If IndexedDB is unavailable** (rare — some aggressive privacy modes), fall back to ephemeral behavior. Seed examples in memory, don't persist. The tool still works, just doesn't remember.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| User clears browser data | Fresh install flow — reseed examples, show welcome modal |
| IndexedDB unavailable | Ephemeral mode — works like pre-persistence Art Direct |
| Corrupt database | Dexie's upgrade mechanism handles schema changes. If truly corrupt, delete and reseed. |
| User uploads dozens of images | IndexedDB handles it. Sidebar scrolls. No hard limit in v1. |
| Same image uploaded twice | Two separate directions. No deduplication (not worth the complexity). |

## Connections

| System | Relationship | What Flows |
|--------|--------------|------------|
| Store | Bidirectional | Store writes to Dexie on changes; Dexie hydrates store on load |
| Image Sidebar | Reads from | Sidebar lists all persisted directions |
| Welcome Experience | Reads/writes | `welcomeSeen` preference |
| Upload Handler | Writes to | New direction created on upload |
| Gallery Data | Seeds from | Example images and pre-configured frames on first visit |
