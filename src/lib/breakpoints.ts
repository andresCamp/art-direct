import type { BreakpointDef, BreakpointName } from './types'

export const BREAKPOINTS: BreakpointDef[] = [
  { name: 'base', minWidth: 0, label: 'Base', prefix: '' },
  { name: 'sm', minWidth: 640, label: 'sm', prefix: 'sm:' },
  { name: 'md', minWidth: 768, label: 'md', prefix: 'md:' },
  { name: 'lg', minWidth: 1024, label: 'lg', prefix: 'lg:' },
  { name: 'xl', minWidth: 1280, label: 'xl', prefix: 'xl:' },
  { name: '2xl', minWidth: 1536, label: '2xl', prefix: '2xl:' },
]

export const DISPLAY_WIDTHS: Record<BreakpointName, number> = {
  base: 280,
  sm: 340,
  md: 400,
  lg: 480,
  xl: 560,
  '2xl': 640,
}
