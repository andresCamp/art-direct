import { describe, it, expect } from 'vitest'
import { buildClassTokens, generateClassString } from '../class-generator'
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

  it('resets a larger default frame after a changed smaller breakpoint', () => {
    const result = generateClassString([
      frame('base'),
      frame('sm'),
      frame('md', { translateY: 30 }),
      frame('lg'),
      frame('xl'),
      frame('2xl'),
    ])

    expect(result).toBe('object-cover md:translate-y-30 lg:translate-y-0')
  })

  it('emits reset tokens for larger default frames after a changed base frame', () => {
    const result = generateClassString([
      frame('base', { scale: 2, objectFit: 'contain' }),
      frame('sm'),
      frame('md'),
      frame('lg'),
      frame('xl'),
      frame('2xl'),
    ])

    expect(result).toContain('object-contain')
    expect(result).toContain('scale-200')
    expect(result).toContain('sm:scale-100')
    expect(result).toContain('sm:object-cover')
  })

  it('builds stable semantic slot keys for emitted tokens', () => {
    const tokens = buildClassTokens([
      frame('base', { translateX: -10 }),
      frame('md', { translateX: 25 }),
    ])

    expect(tokens.map(token => token.slotKey)).toEqual([
      'base:translateX',
      'base:objectFit',
      'md:translateX',
    ])
    expect(tokens.map(token => token.text)).toEqual([
      '-translate-x-10',
      'object-cover',
      'md:translate-x-25',
    ])
  })
})
