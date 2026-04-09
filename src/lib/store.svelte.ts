import { BREAKPOINTS } from './breakpoints'
import { DEFAULT_DEVICES, getDevice, type DeviceCategory } from './devices'
import { generateClassString } from './class-generator'
import { galleryItems } from './gallery-data'
import type { BreakpointName, Direction, DirectionKind, FrameState, ImageState, OutputFormat } from './types'

export type ViewMode = 'device' | 'tailwind'
export type Orientation = 'portrait' | 'landscape'
export type StudioTab = 'compose' | 'preview'

/**
 * Bulk state replacement payload from the persistence layer.
 * Built by persistence.ts hydrateStore() and applied via store.hydrate().
 */
export interface HydrationPayload {
  directions: Direction[]
  activeDirectionId: string | null
  outputFormat: OutputFormat
  viewMode: ViewMode
  selectedDevices: Record<DeviceCategory, string>
  orientations: Record<DeviceCategory, Orientation>
  studioTab: StudioTab
  sidebarOpen: boolean
  welcomeSeen: boolean
}

export const CURATED_EXAMPLE_IDS = ['napoleon', 'wave', 'adam'] as const
const PRELOADED_EXAMPLE_ID = CURATED_EXAMPLE_IDS[0]
const curatedExamples = galleryItems.filter(item => CURATED_EXAMPLE_IDS.includes(item.id as typeof CURATED_EXAMPLE_IDS[number]))

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

function buildFrames(configuredFrames: FrameState[] = []) {
  return BREAKPOINTS.map(bp => {
    const configured = configuredFrames.find(frame => frame.breakpoint === bp.name)
    return configured ? { ...configured } : createDefaultFrame(bp.name)
  })
}

function getImageFilename(path: string) {
  return path.split('/').pop() ?? path
}

function createDirectionFromGallery(item: typeof galleryItems[number]): Direction {
  return {
    id: `example:${item.id}`,
    name: getImageFilename(item.image),
    image: {
      blobUrl: item.image,
      filename: getImageFilename(item.image),
      naturalWidth: item.naturalWidth,
      naturalHeight: item.naturalHeight,
    },
    frames: buildFrames(item.frames),
    dominantColor: item.dominantColor,
    modifiedBreakpoints: new Set(item.frames.map(f => f.breakpoint)),
    lastModifiedBreakpoint: null,
    lastModifiedAt: 0,
    kind: 'example',
    exampleId: item.id,
  }
}

function createStore() {
  function getCuratedExample(id = PRELOADED_EXAMPLE_ID) {
    return curatedExamples.find(item => item.id === id) ?? curatedExamples[0]
  }

  function createSeedDirections() {
    const initialExample = getCuratedExample()
    return initialExample ? [createDirectionFromGallery(initialExample)] : []
  }

  function insertDirection(direction: Direction) {
    directions = [direction, ...directions.filter(existing => existing.id !== direction.id)]
  }

  function ensureDirection() {
    if (directions.length > 0) return
    const initialExample = getCuratedExample()
    if (!initialExample) return
    const direction = createDirectionFromGallery(initialExample)
    directions = [direction]
    activeDirectionId = direction.id
  }

  // --- Multi-direction state ---
  let directions = $state<Direction[]>(createSeedDirections())
  let activeDirectionId = $state<string | null>(directions[0]?.id ?? null)
  let sidebarOpen = $state(false)

  // --- Global settings (not per-direction) ---
  let activeBreakpoint = $state<BreakpointName>('' as BreakpointName)
  let outputFormat = $state<OutputFormat>('agent-instruction')
  let viewMode = $state<ViewMode>('device')
  let studioTab = $state<StudioTab>('compose')
  let selectedDevices = $state<Record<DeviceCategory, string>>({ ...DEFAULT_DEVICES })
  let orientations = $state<Record<DeviceCategory, Orientation>>({
    phone: 'portrait',
    tablet: 'landscape',
    desktop: 'landscape',
  })

  // --- Live drag activity (drives the OutputPanel marching-ants border) ---
  // Frames push raw pointer deltas while a drag is in flight; OutputPanel
  // reads these to march its dashed border in lockstep with the cursor.
  let dragDepth = $state(0)
  const isDragging = $derived(dragDepth > 0)
  let dragOffset = $state(0)

  // --- Welcome flag (persisted to Dexie; see persistence.ts) ---
  // Migrated from localStorage['artdirect-welcome-seen']. The reactive
  // persistence watcher catches mutations to this field.
  let welcomeSeen = $state(false)

  // --- Active direction derived ---
  const activeDirection = $derived(directions.find(d => d.id === activeDirectionId) ?? null)

  // --- Delegating getters (same public surface as before) ---
  const image = $derived(activeDirection?.image ?? null)
  const frames = $derived(activeDirection?.frames ?? [])
  const dominantColor = $derived(activeDirection?.dominantColor ?? null)
  const modifiedBreakpoints = $derived(activeDirection?.modifiedBreakpoints ?? new Set<BreakpointName>())
  const lastModifiedBreakpoint = $derived(activeDirection?.lastModifiedBreakpoint ?? null)
  const lastModifiedAt = $derived(activeDirection?.lastModifiedAt ?? 0)

  // --- Derived values (unchanged logic, now read from delegating getters) ---
  const classString = $derived(
    modifiedBreakpoints.size > 0 ? generateClassString(frames) : ''
  )

  const activeFrame = $derived(frames.find(f => f.breakpoint === activeBreakpoint) ?? null)

  const activeDevices = $derived(
    Object.entries(selectedDevices).map(([category, id]) => {
      const cat = category as DeviceCategory
      const device = getDevice(id)
      const orientation = orientations[cat]
      const isNaturallyPortrait = device.height > device.width
      const wantPortrait = orientation === 'portrait'
      const needsSwap = isNaturallyPortrait !== wantPortrait
      return {
        category: cat,
        device: needsSwap
          ? { ...device, width: device.height, height: device.width }
          : device,
        orientation,
      }
    })
  )

  const visibleFrames = $derived(
    viewMode === 'tailwind'
      ? frames
      : activeDevices.map(({ device }) => {
          const frame = frames.find(f => f.breakpoint === device.breakpoint)
          return frame ?? createDefaultFrame(device.breakpoint)
        })
  )

  // --- Helper to mutate a direction by id ---
  function mutateDirection(id: string, fn: (d: Direction) => void) {
    const idx = directions.findIndex(d => d.id === id)
    if (idx !== -1) fn(directions[idx])
  }

  function mutateActive(fn: (d: Direction) => void) {
    if (activeDirectionId) mutateDirection(activeDirectionId, fn)
  }

  return {
    // --- Existing public getters (unchanged surface) ---
    get image() { return image },
    get frames() { return frames },
    get visibleFrames() { return visibleFrames },
    get activeBreakpoint() { return activeBreakpoint },
    get outputFormat() { return outputFormat },
    get dominantColor() { return dominantColor },
    get classString() { return classString },
    get activeFrame() { return activeFrame },
    get viewMode() { return viewMode },
    get studioTab() { return studioTab },
    get selectedDevices() { return selectedDevices },
    get activeDevices() { return activeDevices },
    get orientations() { return orientations },
    get modifiedBreakpoints() { return modifiedBreakpoints },
    get lastModifiedBreakpoint() { return lastModifiedBreakpoint },
    get lastModifiedAt() { return lastModifiedAt },
    get isDragging() { return isDragging },
    get dragOffset() { return dragOffset },
    get welcomeSeen() { return welcomeSeen },

    // --- New multi-direction getters ---
    get directions() { return directions },
    get activeDirectionId() { return activeDirectionId },
    get activeDirection() { return activeDirection },
    get curatedExamples() { return curatedExamples },
    get sidebarOpen() { return sidebarOpen },

    // --- Existing methods (now mutate active direction) ---
    clearLastModified() {
      mutateActive(d => { d.lastModifiedBreakpoint = null })
    },

    isModified(breakpoint: BreakpointName) {
      return modifiedBreakpoints.has(breakpoint)
    },

    setImage(img: ImageState) {
      mutateActive(d => {
        d.image = img
        d.name = img.filename
        d.frames = buildFrames()
        d.modifiedBreakpoints = new Set()
        d.kind = 'upload'
        d.exampleId = undefined
      })
      activeBreakpoint = '' as BreakpointName
    },

    setFilename(name: string) {
      mutateActive(d => {
        if (d.image) d.image = { ...d.image, filename: name }
        d.name = name
      })
    },

    updateFrame(breakpoint: BreakpointName, updates: Partial<FrameState>) {
      mutateActive(d => {
        const idx = d.frames.findIndex(f => f.breakpoint === breakpoint)
        if (idx !== -1) {
          d.frames[idx] = { ...d.frames[idx], ...updates }
          d.modifiedBreakpoints = new Set([...d.modifiedBreakpoints, breakpoint])
          d.lastModifiedBreakpoint = breakpoint
          d.lastModifiedAt = Date.now()
        }
      })
    },

    setActiveBreakpoint(bp: BreakpointName) {
      activeBreakpoint = bp
    },

    setOutputFormat(format: OutputFormat) {
      outputFormat = format
    },

    setDominantColor(color: string | null) {
      mutateActive(d => { d.dominantColor = color })
    },

    setViewMode(mode: ViewMode) {
      viewMode = mode
    },

    setStudioTab(tab: StudioTab) {
      studioTab = tab
    },

    setDevice(category: DeviceCategory, deviceId: string) {
      selectedDevices = { ...selectedDevices, [category]: deviceId }
    },

    resetFrame(breakpoint: BreakpointName) {
      mutateActive(d => {
        const idx = d.frames.findIndex(f => f.breakpoint === breakpoint)
        if (idx !== -1) {
          d.frames[idx] = createDefaultFrame(breakpoint)
          const next = new Set(d.modifiedBreakpoints)
          next.delete(breakpoint)
          d.modifiedBreakpoints = next
        }
      })
    },

    toggleOrientation(category: DeviceCategory) {
      orientations = {
        ...orientations,
        [category]: orientations[category] === 'portrait' ? 'landscape' : 'portrait',
      }
    },

    reset() {
      directions = createSeedDirections()
      activeDirectionId = directions[0]?.id ?? null
      activeBreakpoint = '' as BreakpointName
      outputFormat = 'agent-instruction'
      viewMode = 'device'
      studioTab = 'compose'
      selectedDevices = { ...DEFAULT_DEVICES }
      orientations = { phone: 'portrait', tablet: 'landscape', desktop: 'landscape' }
      sidebarOpen = false
      welcomeSeen = false
    },

    // --- New multi-direction methods ---
    addDirection(img: ImageState | null, opts?: {
      name?: string
      frames?: FrameState[]
      dominantColor?: string | null
      kind?: DirectionKind
      exampleId?: string
    }): string {
      const id = crypto.randomUUID()
      const direction: Direction = {
        id,
        name: opts?.name ?? img?.filename ?? 'Untitled direction',
        image: img,
        frames: buildFrames(opts?.frames),
        dominantColor: opts?.dominantColor ?? null,
        modifiedBreakpoints: opts?.frames ? new Set(opts.frames.map(f => f.breakpoint)) : new Set(),
        lastModifiedBreakpoint: null,
        lastModifiedAt: 0,
        kind: opts?.kind ?? (img ? 'upload' : 'blank'),
        exampleId: opts?.exampleId,
      }
      insertDirection(direction)
      activeDirectionId = id
      activeBreakpoint = '' as BreakpointName
      return id
    },

    removeDirection(id: string) {
      const direction = directions.find(item => item.id === id)
      if (!direction || direction.kind === 'example' || directions.length === 1) return

      directions = directions.filter(d => d.id !== id)
      if (activeDirectionId === id) {
        activeDirectionId = directions[0]?.id ?? null
      }
      ensureDirection()
    },

    setActiveDirection(id: string) {
      activeDirectionId = id
      activeBreakpoint = '' as BreakpointName
    },

    loadImageIntoActiveDirection(img: ImageState) {
      mutateActive(d => {
        d.image = img
        d.name = img.filename
        d.frames = buildFrames()
        d.modifiedBreakpoints = new Set()
        d.kind = 'upload'
        d.exampleId = undefined
      })
      activeBreakpoint = '' as BreakpointName
    },

    toggleSidebar() {
      sidebarOpen = !sidebarOpen
    },

    setSidebar(open: boolean) {
      sidebarOpen = open
    },

    beginDrag() {
      dragDepth += 1
    },

    endDrag() {
      dragDepth = Math.max(0, dragDepth - 1)
    },

    addDragDelta(dx: number, dy: number) {
      if (dx === 0 && dy === 0) return
      // Signed-magnitude mapping: speed = total cursor distance,
      // sign = which hemisphere the drag leans into (right+down → CW, left+up → CCW).
      // Picking the sign from a single axis (dominant-axis) caused the dashes to
      // freeze on the top-right / bottom-left diagonals, because dx and dy have
      // opposite signs there and would flicker frame-to-frame. The hemisphere
      // split puts the discontinuity on the top-left/bottom-right axis instead,
      // which is rarely held as a sustained drag direction.
      const mag = Math.hypot(dx, dy)
      const sign = dx + dy >= 0 ? 1 : -1
      dragOffset += sign * mag
    },

    // --- Persistence integration ---

    /**
     * Bulk-replace state from the persistence layer. Called once on mount after
     * Dexie hydration. Svelte 5 runes batch the resulting render to one tick.
     *
     * Hybrid swap rule: when payload.activeDirectionId equals the current
     * activeDirectionId, the active direction's image element keeps its URL
     * (examples are static `/gallery/<id>.webp` URLs that don't change between
     * the seeded direction and the hydrated one), so the LCP `<img>` does not
     * unmount and the swap is invisible. Frame state may differ if the user
     * modified it in a prior session — that re-renders without disturbing the
     * image element.
     */
    hydrate(payload: HydrationPayload) {
      directions = payload.directions
      activeDirectionId = payload.activeDirectionId
      outputFormat = payload.outputFormat
      viewMode = payload.viewMode
      studioTab = payload.studioTab
      sidebarOpen = payload.sidebarOpen
      selectedDevices = { ...payload.selectedDevices }
      orientations = { ...payload.orientations }
      welcomeSeen = payload.welcomeSeen
      activeBreakpoint = '' as BreakpointName
    },

    setWelcomeSeen(seen: boolean) {
      welcomeSeen = seen
    },

    /**
     * Apply a partial patch to a single direction by id. Used by the persistence
     * layer for the lazy-blob-load path on uploaded directions: as each blob
     * resolves from IndexedDB, this fills in the direction's `image` field.
     * Generic enough to be reused for other targeted updates.
     */
    patchDirection(id: string, partial: Partial<Direction>) {
      mutateDirection(id, d => {
        Object.assign(d, partial)
      })
    },
  }
}

export const store = createStore()
