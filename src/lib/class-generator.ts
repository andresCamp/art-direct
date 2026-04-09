import { BREAKPOINTS } from './breakpoints'
import type { BreakpointName, FrameState, ObjectFit } from './types'

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

export type FrameClassField = keyof FrameClasses

export interface ClassToken {
  breakpoint: BreakpointName
  field: FrameClassField
  slotKey: `${BreakpointName}:${FrameClassField}`
  text: string
}

const FRAME_CLASS_FIELDS: FrameClassField[] = [
  'scale',
  'translateX',
  'translateY',
  'objectFit',
  'objectPosition',
  'transformOrigin',
]

const RESET_CLASS: Record<FrameClassField, string> = {
  scale: 'scale-100',
  translateX: 'translate-x-0',
  translateY: 'translate-y-0',
  objectFit: 'object-cover',
  objectPosition: 'object-center',
  transformOrigin: 'origin-center',
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

export function buildClassTokens(frames: FrameState[]): ClassToken[] {
  if (frames.length === 0) return []

  const sorted = [...frames].sort((a, b) => {
    const order = BREAKPOINTS.map(bp => bp.name)
    return order.indexOf(a.breakpoint) - order.indexOf(b.breakpoint)
  })

  const baseFrame = sorted[0]
  const baseClasses = getFrameClasses(baseFrame)
  const tokens: ClassToken[] = []

  for (const field of FRAME_CLASS_FIELDS) {
    const cls = baseClasses[field]
    if (!cls) continue
    tokens.push({
      breakpoint: baseFrame.breakpoint,
      field,
      slotKey: `${baseFrame.breakpoint}:${field}`,
      text: cls,
    })
  }

  let effective = { ...baseClasses }

  for (let i = 1; i < sorted.length; i++) {
    const frame = sorted[i]
    const bp = BREAKPOINTS.find(candidate => candidate.name === frame.breakpoint)
    if (!bp) continue

    const current = getFrameClasses(frame)
    for (const field of FRAME_CLASS_FIELDS) {
      if (current[field] === effective[field]) continue
      tokens.push({
        breakpoint: frame.breakpoint,
        field,
        slotKey: `${frame.breakpoint}:${field}`,
        text: `${bp.prefix}${current[field] || RESET_CLASS[field]}`,
      })
    }

    effective = { ...effective, ...current }
  }

  return tokens
}

export function generateClassString(frames: FrameState[]): string {
  return buildClassTokens(frames).map(token => token.text).join(' ')
}
