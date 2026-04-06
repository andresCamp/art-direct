<script lang="ts">
  import { store } from '../../lib/store.svelte'

  interface PreviewDevice {
    id: string
    label: string
    width: number
    height: number
  }

  const presets: PreviewDevice[] = [
    { id: 'iphone-se', label: 'iPhone SE', width: 375, height: 667 },
    { id: 'iphone-15', label: 'iPhone 15 Pro', width: 393, height: 852 },
    { id: 'ipad-mini', label: 'iPad Mini', width: 744, height: 1133 },
    { id: 'ipad', label: 'iPad', width: 1024, height: 1366 },
    { id: 'laptop-13', label: 'Laptop 13"', width: 1280, height: 800 },
    { id: 'macbook-14', label: 'MacBook 14"', width: 1512, height: 982 },
    { id: '1080p', label: '1080p', width: 1920, height: 1080 },
  ]

  let activePreset = $state<string>('iphone-15')
  let width = $state(393)
  let height = $state(852)
  let isResizingX = $state(false)
  let isResizingY = $state(false)
  let resizeStart = $state({ x: 0, y: 0, w: 0, h: 0 })
  let imageDataUrl = $state<string>('')

  // Convert blob URL to data URL so the iframe can access it
  $effect(() => {
    if (!store.image) return
    fetch(store.image.blobUrl)
      .then(r => r.blob())
      .then(blob => {
        const reader = new FileReader()
        reader.onload = () => { imageDataUrl = reader.result as string }
        reader.readAsDataURL(blob)
      })
  })

  function selectPreset(preset: PreviewDevice) {
    activePreset = preset.id
    width = preset.width
    height = preset.height
  }

  function onResizeXDown(e: PointerEvent) {
    isResizingX = true
    resizeStart = { x: e.clientX, y: e.clientY, w: width, h: height }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onResizeYDown(e: PointerEvent) {
    isResizingY = true
    resizeStart = { x: e.clientX, y: e.clientY, w: width, h: height }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onResizeCornerDown(e: PointerEvent) {
    isResizingX = true
    isResizingY = true
    resizeStart = { x: e.clientX, y: e.clientY, w: width, h: height }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onResizeMove(e: PointerEvent) {
    if (!isResizingX && !isResizingY) return
    if (isResizingX) {
      const newW = Math.max(1, Math.round(resizeStart.w + (e.clientX - resizeStart.x) * 2))
      width = newW
    }
    if (isResizingY) {
      const newH = Math.max(0, Math.round(resizeStart.h + (e.clientY - resizeStart.y)))
      height = newH
    }
    activePreset = ''
  }

  function onResizeUp() {
    isResizingX = false
    isResizingY = false
  }

  const maxDisplayWidth = 900
  const maxDisplayHeight = 550
  const displayScale = $derived(
    Math.min(maxDisplayWidth / width, maxDisplayHeight / height, 1)
  )

  const iframeDoc = $derived(buildIframeDoc())

  function buildIframeDoc(): string {
    if (!imageDataUrl || !store.image) return ''

    // Generate CSS directly from frame data instead of relying on a Tailwind CDN.
    // The class generator produces Tailwind v4 classes, and there's no v4 CDN drop-in.
    const modifiedFrames = store.frames.filter(f => store.modifiedBreakpoints.has(f.breakpoint))
    const css = framesToCss(modifiedFrames)

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #000; width: 100vw; height: 100vh; overflow: hidden; position: relative; }
  img { width: 100%; height: 100%; display: block; object-fit: cover; }
  ${css}
</style>
</head>
<body>
<img src="${imageDataUrl}" alt="" />
</body>
</html>`
  }

  function framesToCss(frames: import('../../lib/types').FrameState[]): string {
    if (frames.length === 0) return ''

    const bpOrder: import('../../lib/types').BreakpointName[] = ['base', 'sm', 'md', 'lg', 'xl', '2xl']
    const bpMinWidths: Record<string, number> = { base: 0, sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 }

    const sorted = [...frames].sort((a, b) => bpOrder.indexOf(a.breakpoint) - bpOrder.indexOf(b.breakpoint))
    const rules: string[] = []

    for (const frame of sorted) {
      const declarations: string[] = []
      declarations.push(`object-fit: ${frame.objectFit}`)
      if (frame.objectPosition !== 'center') {
        declarations.push(`object-position: ${frame.objectPosition}`)
      }
      if (frame.scale !== 1 || frame.translateX !== 0 || frame.translateY !== 0) {
        declarations.push(`scale: ${frame.scale}`)
        declarations.push(`translate: ${frame.translateX * 4}px ${frame.translateY * 4}px`)
      }
      if (frame.transformOrigin !== 'center') {
        declarations.push(`transform-origin: ${frame.transformOrigin}`)
      }

      const block = `img { ${declarations.join('; ')}; }`
      const minW = bpMinWidths[frame.breakpoint]
      if (minW === 0) {
        rules.push(block)
      } else {
        rules.push(`@media (min-width: ${minW}px) { ${block} }`)
      }
    }

    return rules.join('\n  ')
  }
</script>

<svelte:window
  onpointermove={onResizeMove}
  onpointerup={onResizeUp}
/>

<div class="flex flex-col items-center gap-4 w-full h-full">
  <!-- Device presets + dimensions -->
  <div class="flex items-center gap-3 flex-shrink-0">
    {#each presets as preset}
      <button
        type="button"
        class="cursor-pointer text-[11px] font-mono transition-colors duration-200
          {activePreset === preset.id
            ? 'text-studio-text'
            : 'text-studio-muted/50 hover:text-studio-muted'}"
        onclick={() => selectPreset(preset)}
      >
        {preset.label}
      </button>
    {/each}
    <span class="text-[10px] font-mono text-studio-muted/40">{width} &times; {height}</span>
  </div>

  <!-- Preview container -->
  <div class="flex-1 flex items-center justify-center w-full">
    <div class="relative" style:width="{width * displayScale}px" style:height="{height * displayScale}px">
      <div
        class="border border-studio-border/30 rounded-sm overflow-hidden bg-black"
        style:width="{width * displayScale}px"
        style:height="{height * displayScale}px"
      >
        {#if imageDataUrl}
          <iframe
            srcdoc={iframeDoc}
            title="Preview"
            style:width="{width}px"
            style:height="{height}px"
            style:transform="scale({displayScale})"
            style:transform-origin="top left"
            class="border-0"
            sandbox="allow-scripts"
          ></iframe>
        {:else}
          <div class="w-full h-full flex items-center justify-center">
            <p class="text-xs font-mono text-studio-muted/50">Loading preview...</p>
          </div>
        {/if}
      </div>

      <!-- Right resize handle -->
      <div
        class="absolute top-1/2 -right-3 -translate-y-1/2 w-1.5 h-10 rounded-full bg-studio-border/60 hover:bg-art-400/60 cursor-ew-resize transition-colors"
        onpointerdown={onResizeXDown}
      ></div>

      <!-- Bottom resize handle -->
      <div
        class="absolute -bottom-3 left-1/2 -translate-x-1/2 h-1.5 w-10 rounded-full bg-studio-border/60 hover:bg-art-400/60 cursor-ns-resize transition-colors"
        onpointerdown={onResizeYDown}
      ></div>

      <!-- Corner resize handle -->
      <div
        class="absolute -bottom-2 -right-2 w-3 h-3 rounded-full bg-studio-border/60 hover:bg-art-400/60 cursor-nwse-resize transition-colors"
        onpointerdown={onResizeCornerDown}
      ></div>
    </div>
  </div>
</div>
