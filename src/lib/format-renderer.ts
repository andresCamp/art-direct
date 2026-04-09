import { BREAKPOINTS } from './breakpoints'
import type { FrameState, OutputFormat } from './types'

const TAILWIND_SPACING_UNIT_PX = 4

export function renderOutput(
  classString: string,
  format: OutputFormat,
  filename: string,
  frames?: FrameState[],
): string {
  switch (format) {
    case 'img':
      return `<!-- art-direction: ${filename} -->\n<img src="${filename}" alt="" class="${classString}" />`

    case 'nextjs-image':
      return `<!-- art-direction: ${filename} -->\n<Image src={${toCamelCase(filename)}} alt="" fill className="${classString}" />`

    case 'bg-div':
      return `<!-- art-direction: ${filename} -->\n<div class="bg-[url('/${filename}')] bg-no-repeat ${classString}" />`

    case 'css':
      return renderCss(frames ?? [])

    case 'agent-instruction': {
      return `Apply the following responsive art direction to the image ${filename}:\n\nTailwind classes: ${classString}\n\nPaste these classes onto the image element's class attribute. The classes handle responsive behavior across all breakpoints using Tailwind's mobile-first approach.`
    }
  }
}

function toCamelCase(filename: string): string {
  const name = filename.replace(/\.[^.]+$/, '')
  return name.replace(/[-_.](\w)/g, (_, c) => c.toUpperCase())
}

function frameToCssProps(frame: FrameState): Record<string, string> {
  const props: Record<string, string> = {}

  props['object-fit'] = frame.objectFit
  if (frame.objectPosition !== 'center') {
    props['object-position'] = frame.objectPosition
  }

  if (frame.scale !== 1) {
    props['scale'] = `${frame.scale}`
  }

  if (frame.translateX !== 0 || frame.translateY !== 0) {
    props.translate = `${frame.translateX * TAILWIND_SPACING_UNIT_PX}px ${frame.translateY * TAILWIND_SPACING_UNIT_PX}px`
  }

  if (frame.transformOrigin !== 'center') {
    props['transform-origin'] = frame.transformOrigin
  }

  return props
}

export function renderCss(frames: FrameState[]): string {
  if (frames.length === 0) return ''

  const sorted = [...frames].sort((a, b) => {
    const order = BREAKPOINTS.map(bp => bp.name)
    return order.indexOf(a.breakpoint) - order.indexOf(b.breakpoint)
  })

  const blocks: string[] = []

  // Track effective state to only emit diffs at each breakpoint
  let effective: Record<string, string> = {}

  for (const frame of sorted) {
    const bp = BREAKPOINTS.find(b => b.name === frame.breakpoint)!
    const props = frameToCssProps(frame)

    // For the first (base) breakpoint, emit all props
    // For subsequent breakpoints, emit only what changed
    let propsToEmit: Record<string, string>
    if (blocks.length === 0) {
      propsToEmit = props
    } else {
      propsToEmit = {}
      // Emit changed props
      for (const [key, value] of Object.entries(props)) {
        if (effective[key] !== value) propsToEmit[key] = value
      }
      // Emit resets for props that were active but are now default
      for (const key of Object.keys(effective)) {
        if (!(key in props)) {
          // Reset to default
          const defaults: Record<string, string> = {
            'object-fit': 'cover',
            'object-position': 'center',
            'scale': '1',
            'translate': '0 0',
            'transform-origin': 'center',
          }
          if (defaults[key]) propsToEmit[key] = defaults[key]
        }
      }
    }

    if (Object.keys(propsToEmit).length === 0) continue

    const cssBody = Object.entries(propsToEmit)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join('\n')

    if (bp.minWidth === 0) {
      blocks.push(`.art-directed {\n${cssBody}\n}`)
    } else {
      blocks.push(`@media (min-width: ${bp.minWidth}px) {\n  .art-directed {\n  ${cssBody}\n  }\n}`)
    }

    effective = { ...effective, ...props }
    // Remove keys that returned to default (no longer in props)
    for (const key of Object.keys(effective)) {
      if (!(key in props)) delete effective[key]
    }
  }

  return blocks.join('\n\n')
}
