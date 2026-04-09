import type { DeviceCategory } from './devices'

export type PreviewOrientation = 'portrait' | 'landscape'

export interface PreviewDevice {
  id: string
  label: string
  category: DeviceCategory
  width: number
  height: number
}

export const PREVIEW_PRESETS: PreviewDevice[] = [
  { id: 'iphone-se', label: 'iPhone SE', category: 'phone', width: 375, height: 667 },
  { id: 'iphone-15', label: 'iPhone 15 Pro', category: 'phone', width: 393, height: 852 },
  { id: 'ipad-mini', label: 'iPad Mini', category: 'tablet', width: 744, height: 1133 },
  { id: 'ipad', label: 'iPad', category: 'tablet', width: 1024, height: 1366 },
  { id: 'laptop-13', label: 'Laptop 13"', category: 'desktop', width: 1280, height: 800 },
  { id: 'macbook-14', label: 'MacBook 14"', category: 'desktop', width: 1512, height: 982 },
  { id: '1080p', label: '1080p', category: 'desktop', width: 1920, height: 1080 },
]

const DEFAULT_PRESET_ID = 'iphone-15'
const DEFAULT_PREVIEW_ORIENTATIONS: Record<DeviceCategory, PreviewOrientation> = {
  phone: 'portrait',
  tablet: 'landscape',
  desktop: 'landscape',
}

function getPreset(id: string): PreviewDevice {
  return PREVIEW_PRESETS.find(preset => preset.id === id) ?? PREVIEW_PRESETS[0]!
}

function getOrientedDimensions(preset: PreviewDevice, orientation: PreviewOrientation) {
  const isNaturallyPortrait = preset.height > preset.width
  const wantPortrait = orientation === 'portrait'
  const needsSwap = isNaturallyPortrait !== wantPortrait

  return needsSwap
    ? { width: preset.height, height: preset.width }
    : { width: preset.width, height: preset.height }
}

function createPreviewState() {
  const defaultPreset = getPreset(DEFAULT_PRESET_ID)

  let activePreset = $state<string>(defaultPreset.id)
  let activeCategory = $state<DeviceCategory>(defaultPreset.category)
  let previewOrientations = $state<Record<DeviceCategory, PreviewOrientation>>({ ...DEFAULT_PREVIEW_ORIENTATIONS })
  const defaultDimensions = getOrientedDimensions(defaultPreset, previewOrientations[defaultPreset.category])
  let width = $state(defaultDimensions.width)
  let height = $state(defaultDimensions.height)

  function applyPreset(preset: PreviewDevice) {
    activePreset = preset.id
    activeCategory = preset.category
    const dimensions = getOrientedDimensions(preset, previewOrientations[preset.category])
    width = dimensions.width
    height = dimensions.height
  }

  return {
    get activePreset() { return activePreset },
    get activeCategory() { return activeCategory },
    get orientation() { return width > height ? 'landscape' as const : 'portrait' as const },
    get previewOrientations() { return previewOrientations },
    get width() { return width },
    get height() { return height },

    selectPreset(presetOrId: PreviewDevice | string) {
      applyPreset(typeof presetOrId === 'string' ? getPreset(presetOrId) : presetOrId)
    },

    toggleOrientation() {
      const nextOrientation = previewOrientations[activeCategory] === 'portrait' ? 'landscape' : 'portrait'
      previewOrientations = {
        ...previewOrientations,
        [activeCategory]: nextOrientation,
      }

      const nextWidth = height
      height = width
      width = nextWidth
    },

    setCustomSize(nextWidth: number, nextHeight: number) {
      width = nextWidth
      height = nextHeight
      activePreset = ''
    },
  }
}

export const previewState = createPreviewState()
