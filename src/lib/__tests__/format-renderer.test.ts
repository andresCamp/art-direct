import { describe, expect, it } from 'vitest'
import { renderCss } from '../format-renderer'
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

describe('renderCss', () => {
  it('renders Tailwind-equivalent scale and translate properties', () => {
    const css = renderCss([
      frame('base', {
        objectFit: 'contain',
        scale: 3.6,
        translateX: 25,
        translateY: -10,
        transformOrigin: 'right',
      }),
    ])

    expect(css).toContain('object-fit: contain;')
    expect(css).toContain('scale: 3.6;')
    expect(css).toContain('translate: 100px -40px;')
    expect(css).toContain('transform-origin: right;')
    expect(css).not.toContain('transform:')
  })

  it('resets transform properties at larger breakpoints', () => {
    const css = renderCss([
      frame('base', {
        objectFit: 'contain',
        scale: 2,
        translateY: 30,
      }),
      frame('md'),
    ])

    expect(css).toContain('.art-directed {\n  object-fit: contain;\n  scale: 2;\n  translate: 0px 120px;')
    expect(css).toContain('@media (min-width: 768px)')
    expect(css).toContain('object-fit: cover;')
    expect(css).toContain('scale: 1;')
    expect(css).toContain('translate: 0 0;')
  })
})
