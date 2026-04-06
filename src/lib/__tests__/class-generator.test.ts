import { describe, it, expect } from 'vitest'
import { generateClassString } from '../class-generator'
import type { FrameState } from '../types'

function frame(breakpoint: string, overrides: Partial<FrameState> = {}): FrameState {
  return {
    breakpoint: breakpoint as FrameState['breakpoint'],
    scale: 1,
    translateX: 0,
    translateY: 0,
    objectFit: 'cover',
    objectPosition: 'center',
    transformOrigin: 'center',
    ...overrides,
  }
}

describe('generateClassString', () => {
  it('returns empty string for empty frames', () => {
    expect(generateClassString([])).toBe('')
  })

  it('generates base-only classes with no overrides', () => {
    const result = generateClassString([frame('base')])
    expect(result).toBe('object-cover')
  })

  it('generates overrides only where values differ', () => {
    const result = generateClassString([
      frame('base', { objectFit: 'contain', scale: 2, translateY: 30, transformOrigin: 'right' }),
      frame('md', { objectFit: 'cover', scale: 1, translateY: 0, transformOrigin: 'right' }),
    ])
    expect(result).toContain('object-contain')
    expect(result).toContain('scale-200')
    expect(result).toContain('translate-y-30')
    expect(result).toContain('origin-right')
    expect(result).toContain('md:object-cover')
    expect(result).toContain('md:scale-100')
  })

  it('uses arbitrary values for non-standard scales', () => {
    const result = generateClassString([
      frame('base', { scale: 2.9 }),
    ])
    expect(result).toContain('scale-[2.9]')
  })

  it('handles negative translate values', () => {
    const result = generateClassString([
      frame('base', { translateX: -10 }),
    ])
    expect(result).toContain('-translate-x-10')
  })

  it('handles object-position with standard values', () => {
    const result = generateClassString([
      frame('base', { objectPosition: 'right' }),
    ])
    expect(result).toContain('object-right')
  })

  it('handles object-position with arbitrary values', () => {
    const result = generateClassString([
      frame('base', { objectPosition: '75% 100%' }),
    ])
    expect(result).toContain('object-[75%_100%]')
  })

  it('skips md overrides that match inherited base values', () => {
    const result = generateClassString([
      frame('base', { scale: 1, objectFit: 'cover' }),
      frame('md', { scale: 1, objectFit: 'cover' }),
    ])
    // md should contribute nothing since it matches base
    expect(result).toBe('object-cover')
  })

  it('cascade: md inherits from base, lg only differs from effective md', () => {
    const result = generateClassString([
      frame('base', { scale: 2, objectFit: 'contain' }),
      frame('md', { scale: 1, objectFit: 'cover' }),
      frame('lg', { scale: 1, objectFit: 'cover' }), // same as md, no lg prefix needed
    ])
    expect(result).not.toContain('lg:')
  })

  it('matches osis example: contain + scale + translate + md override', () => {
    const result = generateClassString([
      frame('base', {
        objectFit: 'contain',
        scale: 2.9,
        translateY: 30,
        transformOrigin: 'right',
      }),
      frame('md', {
        objectFit: 'cover',
        scale: 1,
        translateY: 0,
        transformOrigin: 'right',
        objectPosition: 'right',
      }),
    ])
    expect(result).toContain('object-contain')
    expect(result).toContain('scale-[2.9]')
    expect(result).toContain('origin-right')
    expect(result).toContain('translate-y-30')
    expect(result).toContain('md:scale-100')
    expect(result).toContain('md:object-cover')
    expect(result).toContain('md:object-right')
  })
})
