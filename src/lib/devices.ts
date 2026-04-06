import { BREAKPOINTS } from './breakpoints'
import type { BreakpointName } from './types'

export type DeviceCategory = 'phone' | 'tablet' | 'desktop'

export interface Device {
  id: string
  name: string
  category: DeviceCategory
  width: number
  height: number
  breakpoint: BreakpointName
}

/** Derive the highest Tailwind breakpoint that applies at a given viewport width */
function breakpointForWidth(width: number): BreakpointName {
  let result: BreakpointName = 'base'
  for (const bp of BREAKPOINTS) {
    if (width >= bp.minWidth) result = bp.name
  }
  return result
}

interface DeviceSpec {
  id: string
  name: string
  category: DeviceCategory
  width: number
  height: number
}

const DEVICE_SPECS: DeviceSpec[] = [
  // Phones
  { id: 'iphone-15-pro', name: 'iPhone 15 Pro', category: 'phone', width: 393, height: 852 },
  { id: 'iphone-se', name: 'iPhone SE', category: 'phone', width: 375, height: 667 },
  { id: 'galaxy-s24', name: 'Galaxy S24', category: 'phone', width: 360, height: 780 },
  { id: 'pixel-8', name: 'Pixel 8', category: 'phone', width: 412, height: 915 },

  // Tablets
  { id: 'ipad', name: 'iPad', category: 'tablet', width: 1024, height: 1366 },
  { id: 'ipad-mini', name: 'iPad Mini', category: 'tablet', width: 744, height: 1133 },
  { id: 'ipad-air', name: 'iPad Air', category: 'tablet', width: 820, height: 1180 },
  { id: 'galaxy-tab', name: 'Galaxy Tab S9', category: 'tablet', width: 800, height: 1280 },

  // Desktops
  { id: 'macbook-14', name: 'MacBook 14"', category: 'desktop', width: 1512, height: 982 },
  { id: 'macbook-16', name: 'MacBook 16"', category: 'desktop', width: 1728, height: 1117 },
  { id: 'desktop-1080', name: '1080p', category: 'desktop', width: 1920, height: 1080 },
  { id: 'desktop-1440', name: '1440p', category: 'desktop', width: 2560, height: 1440 },
  { id: 'laptop-13', name: 'Laptop 13"', category: 'desktop', width: 1280, height: 800 },
]

export const DEVICES: Device[] = DEVICE_SPECS.map(spec => ({
  ...spec,
  breakpoint: breakpointForWidth(spec.width),
}))

export const DEFAULT_DEVICES: Record<DeviceCategory, string> = {
  phone: 'iphone-15-pro',
  tablet: 'ipad',
  desktop: 'macbook-14',
}

export function getDevice(id: string): Device {
  return DEVICES.find(d => d.id === id) ?? DEVICES[0]
}

export function getDevicesByCategory(category: DeviceCategory): Device[] {
  return DEVICES.filter(d => d.category === category)
}

/** Scale factor to fit device viewport into a display container */
export function getDisplayScale(device: Device, maxWidth: number, maxHeight: number): number {
  const scaleW = maxWidth / device.width
  const scaleH = maxHeight / device.height
  return Math.min(scaleW, scaleH, 1)
}
