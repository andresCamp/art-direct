# Persistence — State Diagram

System map of the Dexie persistence layer built in Phase 2.5. Shows the lifecycle from cold start through hydration, the steady-state read/write loop, and the failure paths. Pairs with `persistence--product-spec.md`.

## High-level flow

```
                          ┌──────────────────────────────────┐
                          │           PAGE LOAD              │
                          │   index.astro → Studio.svelte    │
                          └────────────────┬─────────────────┘
                                           │
                                           ▼
                          ┌──────────────────────────────────┐
                          │     STORE SEED (synchronous)     │
                          │   createSeedDirections() puts    │
                          │   Napoleon in store.directions   │
                          │   activeDirectionId = napoleon   │
                          └────────────────┬─────────────────┘
                                           │
                                           ▼
                          ┌──────────────────────────────────┐
                          │     STUDIO MOUNTS (skeleton)     │
                          │   hydrated = false → render      │
                          │   placeholder ghost shapes       │
                          │   over #09090c bg                │
                          └────────────────┬─────────────────┘
                                           │
                                           ▼
                          ┌──────────────────────────────────┐
                          │    $effect: hydrateStore()       │
                          │   (async, fire-and-forget)       │
                          └────────────────┬─────────────────┘
                                           │
                       ┌───────────────────┼───────────────────┐
                       │                   │                   │
                       ▼                   ▼                   ▼
            ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
            │  db.open() OK    │  │  db.open() FAIL  │  │   read errors    │
            │                  │  │  (private mode,  │  │                  │
            │  → seed pass     │  │   quota, etc.)   │  │  → log warning   │
            │  → read-back     │  │                  │  │  → studio still  │
            │  → store.hydrate │  │  available=false │  │    renders w/    │
            │                  │  │  return early    │  │    seeded state  │
            └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
                     │                     │                     │
                     └─────────────────────┼─────────────────────┘
                                           │
                                           ▼
                          ┌──────────────────────────────────┐
                          │     hydrated = true              │
                          │  startPersistence() registers    │
                          │  $effect.root reactive watchers  │
                          │  + pagehide / visibilitychange   │
                          └────────────────┬─────────────────┘
                                           │
                                           ▼
                          ┌──────────────────────────────────┐
                          │            STEADY STATE          │
                          │   Studio fully interactive       │
                          │   Watchers tracking mutations    │
                          └──────────────────────────────────┘
```

## Hydration phase detail

```
                  hydrateStore()
                        │
                        ▼
              ┌──────────────────┐
              │   db.open()      │──────┐ throws
              └────────┬─────────┘      │
                       │ resolves       ▼
                       ▼          ┌─────────────────┐
              ┌──────────────────┐│ available=false │
              │   runSeedPass    ││ studio uses     │
              │                  ││ in-memory seed  │
              │  cheap path:     │└─────────────────┘
              │  seedVersion ==  │
              │  current AND     │
              │  count == 4      │
              │  ? return early  │
              │                  │
              │  else:           │
              │  computeSeedDelta│
              │  - missing → fetch + insert
              │  - existing & lastModifiedAt==0
              │      → overwrite (curation update)
              │  - existing & lastModifiedAt>0
              │      → leave alone (user edits win)
              │  - bump seedVersion
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │  read prefs      │
              │                  │
              │  if !welcomeSeen │
              │  + localStorage  │
              │    flag set:     │
              │  → migrate       │
              │  → remove ls key │
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │  read directions │
              │  orderBy         │
              │  updatedAt desc  │
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │  resolve active: │
              │  prefs.lastActive│
              │  ? (if exists)   │
              │  : stored[0].id  │
              │  : 'example:napo'│
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │  load active blob│
              │  - example:      │
              │    static URL    │
              │  - upload:       │
              │    db.blobs.get  │
              │    + createObjUrl│
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │  build payload   │
              │  store.hydrate() │
              │  bulk replace    │
              │  in one tick     │
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │  queueLazyBlobs  │
              │  for non-active  │
              │  uploads         │
              │  (background)    │
              └──────────────────┘
```

## Steady-state write loop

```
       ┌───────────────────────┐
       │     USER ACTION       │
       └───────┬───────────────┘
               │
       ┌───────┴────────┬─────────────────┬─────────────────┐
       ▼                ▼                 ▼                 ▼
  ┌─────────┐    ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
  │  drag   │    │   upload    │  │    delete    │  │  toggle pref │
  │  frame  │    │   file      │  │  direction   │  │  / switch dir│
  └────┬────┘    └──────┬──────┘  └──────┬───────┘  └──────┬───────┘
       │                │                │                  │
       ▼                ▼                ▼                  ▼
  ┌─────────┐    ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
  │ store.  │    │ store.add   │  │ store.remove │  │ store.set*   │
  │ update  │    │ Direction   │  │ Direction    │  │ welcomeSeen  │
  │ Frame() │    │             │  │              │  │ activeDir    │
  └────┬────┘    └──────┬──────┘  └──────┬───────┘  └──────┬───────┘
       │                │                │                  │
       ▼                ▼                ▼                  ▼
  ┌─────────┐    ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
  │$state   │    │$state       │  │$state        │  │$state        │
  │mutation │    │mutation     │  │mutation      │  │mutation      │
  │d.frames │    │directions = │  │directions =  │  │outputFormat /│
  │d.lastMod│    │[new,...prev]│  │filter(...)   │  │viewMode etc. │
  └────┬────┘    └──────┬──────┘  └──────┬───────┘  └──────┬───────┘
       │                │                │                  │
       └────────────────┼────────────────┼──────────────────┤
                        │                │                  │
                        ▼                ▼                  ▼
            ┌────────────────────────────────────────────────────┐
            │       Svelte 5 reactive subscriptions fire         │
            └─────────┬──────────────────────────────────┬───────┘
                      │                                  │
                      ▼                                  ▼
       ┌──────────────────────────┐         ┌──────────────────────┐
       │ directions $effect       │         │ prefs $effect        │
       │ (in $effect.root)        │         │ (in $effect.root)    │
       │                          │         │                      │
       │ 1. iterate dirList[i]    │         │ 1. read each prefs   │
       │ 2. explicit reads on     │         │    field             │
       │    every tracked field   │         │ 2. compute hashPrefs │
       │ 3. compute hashDirection │         │ 3. compare snapshot  │
       │ 4. compare snapshot      │         │ 4. if diff →         │
       │ 5. if diff →             │         │    schedulePrefs     │
       │    scheduleDirWrite      │         │    Write             │
       │    update snapshot       │         │    update snapshot   │
       │ 6. detect deletions      │         │                      │
       └──────────┬───────────────┘         └─────────┬────────────┘
                  │                                   │
                  │ writes                            │ writes
                  ▼                                   ▼
       ┌──────────────────────────────────────────────────────────┐
       │   pendingWrites Map<key, {timer, run}>                   │
       │                                                          │
       │   key = 'dir:<id>' | '__prefs__'                         │
       │                                                          │
       │   scheduleWrite():                                       │
       │     - clear existing timer for key                       │
       │     - setTimeout(run, 500ms)                             │
       │     - store {timer, run} in map                          │
       └──────────┬─────────────────────────────────┬─────────────┘
                  │                                 │
                  │ 500ms timer fires               │ pagehide /
                  │                                 │ visibility
                  │ OR                              │ change:
                  │                                 │ hidden
                  │ persistDirectionNow()           │
                  │ (uploads bypass debounce)       │ flushAllPending()
                  │                                 │ fires all timers
                  │ OR                              │ immediately
                  │                                 │ (fire-and-forget)
                  │ persistPreferencesNow()         │
                  │ (welcomeSeen, etc.)             │
                  ▼                                 ▼
       ┌──────────────────────────────────────────────────────────┐
       │                    DEXIE WRITES                          │
       │                                                          │
       │   directions table:                                      │
       │     db.transaction('rw', dir, blobs):                    │
       │       db.directions.put({..., createdAt})                │
       │       db.blobs.put({directionId, blob}) (uploads only)   │
       │                                                          │
       │   directions delete:                                     │
       │     db.transaction('rw', dir, blobs):                    │
       │       db.directions.delete(id)                           │
       │       db.blobs.delete(id)                                │
       │                                                          │
       │   preferences table:                                     │
       │     db.preferences.update('singleton', {...})            │
       └──────────────────────────────────────────────────────────┘
```

## Dexie schema

```
┌──────────────────────────────────────┐  ┌─────────────────────┐
│         directions                   │  │       blobs         │
│  PK: id (string)                     │  │  PK: directionId    │
│  IDX: updatedAt                      │  │                     │
├──────────────────────────────────────┤  ├─────────────────────┤
│  id, name, filename                  │  │  directionId        │
│  naturalWidth, naturalHeight         │  │  blob (Blob)        │
│  dominantColor                       │  │                     │
│  frames[6]                           │  │  (1-to-1 with       │
│  modifiedBreakpoints[]               │  │   directions for    │
│  lastModifiedBreakpoint              │  │   uploads / blanks; │
│  lastModifiedAt    ◄── 0 = never     │  │   examples skip)    │
│  kind ('example'|'upload'|'blank')   │  │                     │
│  exampleId                           │  └─────────────────────┘
│  isExample                           │
│  createdAt, updatedAt                │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│         preferences                  │
│  PK: key = 'singleton'               │
├──────────────────────────────────────┤
│  welcomeSeen                         │
│  lastActiveDirectionId               │
│  outputFormat                        │
│  viewMode                            │
│  selectedDevices { phone, tablet, desktop }
│  orientations { phone, tablet, desktop }
│  seedVersion       ◄── self-heal trigger
└──────────────────────────────────────┘
```

## Failure modes

```
┌──────────────────────────┬──────────────────────────────────────┐
│ Condition                │ Behavior                             │
├──────────────────────────┼──────────────────────────────────────┤
│ IndexedDB unavailable    │ available = false, all writes no-op, │
│ (private mode, quota)    │ studio runs ephemerally with seeded  │
│                          │ Napoleon, every refresh = fresh load │
├──────────────────────────┼──────────────────────────────────────┤
│ Offline first-visit      │ Seed fetch fails for missing webps,  │
│                          │ in-memory Napoleon stays. Next load  │
│                          │ with network → seedPass backfills    │
│                          │ missing examples (idempotent)        │
├──────────────────────────┼──────────────────────────────────────┤
│ Curation update          │ Bump EXAMPLE_SEED_VERSION → seedPass │
│ (gallery-data.ts edit)   │ overwrites unmodified examples,      │
│                          │ leaves user-modified ones alone      │
├──────────────────────────┼──────────────────────────────────────┤
│ Tab close mid-debounce   │ pagehide / visibilitychange fires    │
│                          │ flushAllPending() (best-effort, not  │
│                          │ awaited — IDB is async during unload)│
├──────────────────────────┼──────────────────────────────────────┤
│ Write fails              │ .catch logs warning, snapshot stays  │
│                          │ updated, next $effect tick won't     │
│                          │ retry — relies on next user action   │
│                          │ to re-trigger (potential gap)        │
└──────────────────────────┴──────────────────────────────────────┘
```

## Critical invariants

1. **Store never imports persistence.** persistence.ts depends on store, not the reverse. The store stays unit-testable without IndexedDB.
2. **Snapshot prefill before first effect tick.** `startPersistence()` populates `directionSnapshots` from current store state synchronously, then registers `$effect.root`. The first effect run sees no diff against the just-hydrated state and writes nothing.
3. **Examples stay LCP-friendly.** Example direction `image.blobUrl` is the static `/gallery/<id>.webp` URL (matches Layout.astro's `<link rel="preload">`), never a `URL.createObjectURL` blob URL. Sidebar thumbnails of examples use the same static URL.
4. **Per-key debounce.** Rapid frame drags within 500ms coalesce to one write. Switching between directions A→B mid-debounce keeps A's pending write alive (different keys).
5. **Uploads bypass debounce.** `persistDirectionNow(id, blob)` is called from `upload.ts` immediately after the store mutation — uploads are the moment users expect "saved."
6. **Welcome flag is immediate.** WelcomeModal calls `persistPreferencesNow()` after `store.setWelcomeSeen(true)` to flush past the prefs debounce. Closing the tab right after dismissal still persists.
7. **Self-heal on every load.** `runSeedPass()` runs unconditionally on every hydration; the cheap path (seedVersion match + count check) returns early in the steady state.
