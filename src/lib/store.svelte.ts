import { BREAKPOINTS } from './breakpoints'
import { DEFAULT_DEVICES, getDevice, type DeviceCategory } from './devices'
import { generateClassString } from './class-generator'
import type { BreakpointName, FrameState, ImageState, OutputFormat } from './types'

export type ViewMode = 'device' | 'tailwind'
export type Orientation = 'portrait' | 'landscape'

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

function createStore() {
  let image = $state<ImageState | null>(null)
  let frames = $state<FrameState[]>([])
  let activeBreakpoint = $state<BreakpointName>('base')
  let outputFormat = $state<OutputFormat>('img')
  let dominantColor = $state<string | null>(null)
  let viewMode = $state<ViewMode>('device')
  let selectedDevices = $state<Record<DeviceCategory, string>>({ ...DEFAULT_DEVICES })
  let orientations = $state<Record<DeviceCategory, Orientation>>({
    phone: 'portrait',
    tablet: 'landscape',
    desktop: 'landscape',
  })

  let modifiedBreakpoints = $state<Set<BreakpointName>>(new Set())
  let lastModifiedBreakpoint = $state<BreakpointName | null>(null)
  let lastModifiedAt = $state<number>(0)

  const classString = $derived(generateClassString(
    frames.filter(f => modifiedBreakpoints.has(f.breakpoint))
  ))

  const activeFrame = $derived(frames.find(f => f.breakpoint === activeBreakpoint) ?? null)

  const activeDevices = $derived(
    Object.entries(selectedDevices).map(([category, id]) => {
      const cat = category as DeviceCategory
      const device = getDevice(id)
      const orientation = orientations[cat]
      // Swap width/height if orientation doesn't match device's natural orientation
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

  return {
    get image() { return image },
    get frames() { return frames },
    get visibleFrames() { return visibleFrames },
    get activeBreakpoint() { return activeBreakpoint },
    get outputFormat() { return outputFormat },
    get dominantColor() { return dominantColor },
    get classString() { return classString },
    get activeFrame() { return activeFrame },
    get viewMode() { return viewMode },
    get selectedDevices() { return selectedDevices },
    get activeDevices() { return activeDevices },
    get orientations() { return orientations },
    get modifiedBreakpoints() { return modifiedBreakpoints },
    get lastModifiedBreakpoint() { return lastModifiedBreakpoint },
    get lastModifiedAt() { return lastModifiedAt },
    clearLastModified() { lastModifiedBreakpoint = null },

    isModified(breakpoint: BreakpointName) {
      return modifiedBreakpoints.has(breakpoint)
    },

    setImage(img: ImageState) {
      image = img
      frames = BREAKPOINTS.map(bp => createDefaultFrame(bp.name))
      activeBreakpoint = '' as BreakpointName
    },

    setFilename(name: string) {
      if (image) image = { ...image, filename: name }
    },

    updateFrame(breakpoint: BreakpointName, updates: Partial<FrameState>) {
      const idx = frames.findIndex(f => f.breakpoint === breakpoint)
      if (idx !== -1) {
        frames[idx] = { ...frames[idx], ...updates }
        modifiedBreakpoints = new Set([...modifiedBreakpoints, breakpoint])
        lastModifiedBreakpoint = breakpoint
        lastModifiedAt = Date.now()
      }
    },

    setActiveBreakpoint(bp: BreakpointName) {
      activeBreakpoint = bp
    },

    setOutputFormat(format: OutputFormat) {
      outputFormat = format
    },

    setDominantColor(color: string | null) {
      dominantColor = color
    },

    setViewMode(mode: ViewMode) {
      viewMode = mode
    },

    setDevice(category: DeviceCategory, deviceId: string) {
      selectedDevices = { ...selectedDevices, [category]: deviceId }
    },

    resetFrame(breakpoint: BreakpointName) {
      const idx = frames.findIndex(f => f.breakpoint === breakpoint)
      if (idx !== -1) {
        frames[idx] = createDefaultFrame(breakpoint)
        const next = new Set(modifiedBreakpoints)
        next.delete(breakpoint)
        modifiedBreakpoints = next
      }
    },

    toggleOrientation(category: DeviceCategory) {
      orientations = {
        ...orientations,
        [category]: orientations[category] === 'portrait' ? 'landscape' : 'portrait',
      }
    },

    reset() {
      image = null
      frames = []
      activeBreakpoint = 'base'
      outputFormat = 'img'
      dominantColor = null
      viewMode = 'device'
      selectedDevices = { ...DEFAULT_DEVICES }
      orientations = { phone: 'portrait', tablet: 'landscape', desktop: 'landscape' }
      modifiedBreakpoints = new Set()
    },
  }
}

export const store = createStore()
