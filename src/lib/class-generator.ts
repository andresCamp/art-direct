import { BREAKPOINTS } from './breakpoints'
import type { FrameState, ObjectFit } from './types'

const STANDARD_SCALES: Record<number, string> = {
  0: '0',
  0.5: '50',
  0.75: '75',
  0.9: '90',
  0.95: '95',
  1: '100',
  1.05: '105',
  1.1: '110',
  1.25: '125',
  1.5: '150',
  2: '200',
}

// Tailwind v4 supports all integer values as translate utilities (e.g., translate-y-30)
// so we just need to check if the value is a clean integer


function scaleClass(value: number): string {
  if (value === 1) return ''
  const standard = STANDARD_SCALES[value]
  if (standard !== undefined) return `scale-${standard}`
  return `scale-[${value}]`
}

function translateClass(axis: 'x' | 'y', value: number): string {
  if (value === 0) return ''
  const abs = Math.abs(value)
  const neg = value < 0 ? '-' : ''
  // Tailwind v4 supports any integer as a translate value
  if (Number.isInteger(abs)) {
    return `${neg}translate-${axis}-${abs}`
  }
  return `${neg}translate-${axis}-[${abs}]`
}

function fitClass(value: ObjectFit): string {
  return `object-${value}`
}

function positionClass(value: string): string {
  if (value === 'center') return ''
  const hyphenated = value.replace(/ /g, '-')
  const standard = ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right']
  if (standard.includes(hyphenated)) return `object-${hyphenated}`
  return `object-[${value.replace(/ /g, '_')}]`
}

function originClass(value: string): string {
  if (value === 'center') return ''
  const standard = ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right']
  if (standard.includes(value)) return `origin-${value}`
  return `origin-[${value.replace(/ /g, '_')}]`
}

interface FrameClasses {
  scale: string
  translateX: string
  translateY: string
  objectFit: string
  objectPosition: string
  transformOrigin: string
}

function getFrameClasses(frame: FrameState): FrameClasses {
  return {
    scale: scaleClass(frame.scale),
    translateX: translateClass('x', frame.translateX),
    translateY: translateClass('y', frame.translateY),
    objectFit: fitClass(frame.objectFit),
    objectPosition: positionClass(frame.objectPosition),
    transformOrigin: originClass(frame.transformOrigin),
  }
}

export function generateClassString(frames: FrameState[]): string {
  if (frames.length === 0) return ''

  const sorted = [...frames].sort((a, b) => {
    const order = BREAKPOINTS.map(bp => bp.name)
    return order.indexOf(a.breakpoint) - order.indexOf(b.breakpoint)
  })

  const baseFrame = sorted[0]
  const baseClasses = getFrameClasses(baseFrame)

  const parts: string[] = []

  // Emit base (unprefixed) classes
  for (const cls of Object.values(baseClasses)) {
    if (cls) parts.push(cls)
  }

  // Track effective state (what's inherited from previous breakpoints)
  let effective = { ...baseClasses }

  // Emit prefixed overrides for each subsequent breakpoint
  for (let i = 1; i < sorted.length; i++) {
    const frame = sorted[i]
    const bp = BREAKPOINTS.find(b => b.name === frame.breakpoint)
    if (!bp) continue

    const current = getFrameClasses(frame)
    const prefix = bp.prefix

    // Explicit default classes needed when resetting a property at a breakpoint
    const resetClass: Record<keyof FrameClasses, string> = {
      scale: 'scale-100',
      translateX: 'translate-x-0',
      translateY: 'translate-y-0',
      objectFit: 'object-cover',
      objectPosition: 'object-center',
      transformOrigin: 'origin-center',
    }

    for (const key of Object.keys(current) as (keyof FrameClasses)[]) {
      if (current[key] !== effective[key]) {
        const cls = current[key]
        if (cls) {
          parts.push(`${prefix}${cls}`)
        } else {
          // Property was reset to default — emit explicit reset class
          parts.push(`${prefix}${resetClass[key]}`)
        }
      }
    }

    // Update effective state
    effective = { ...effective, ...current }
  }

  return parts.join(' ')
}
