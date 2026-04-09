<script lang="ts">
  import { store } from '../../lib/store.svelte'
  import { renderCss } from '../../lib/format-renderer'
  import { previewState } from '../../lib/preview-state.svelte'
  import { MediaQuery } from 'svelte/reactivity'

  const narrowViewport = new MediaQuery('(max-width: 639px)')
  let isResizingX = $state(false)
  let isResizingY = $state(false)
  let resizeStart = $state({ x: 0, y: 0, w: 0, h: 0 })
  let imageDataUrl = $state<string>('')
  const width = $derived(previewState.width)
  const height = $derived(previewState.height)

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
    let nextWidth = width
    let nextHeight = height
    if (isResizingX) {
      nextWidth = Math.max(1, Math.round(resizeStart.w + (e.clientX - resizeStart.x) * 2))
    }
    if (isResizingY) {
      nextHeight = Math.max(0, Math.round(resizeStart.h + (e.clientY - resizeStart.y)))
    }
    previewState.setCustomSize(nextWidth, nextHeight)
  }

  function onResizeUp() {
    isResizingX = false
    isResizingY = false
  }

  const maxDisplayWidth = $derived(narrowViewport.current ? 340 : 900)
  const maxDisplayHeight = $derived(narrowViewport.current ? 400 : 550)
  const displayScale = $derived(
    Math.min(maxDisplayWidth / width, maxDisplayHeight / height, 1)
  )

  const iframeDoc = $derived(buildIframeDoc())

  function buildIframeDoc(): string {
    if (!imageDataUrl || !store.image) return ''

    // Generate CSS directly from frame data instead of relying on a Tailwind CDN.
    // The class generator produces Tailwind v4 classes, and there's no v4 CDN drop-in.
    const css = store.modifiedBreakpoints.size > 0 ? renderCss(store.frames) : ''

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
  body { position: relative; }
  img { width: 100%; height: 100%; display: block; object-fit: cover; }
  ${css}
</style>
</head>
<body>
<img src="${imageDataUrl}" alt="" class="art-directed" />
</body>
</html>`
  }
</script>

<svelte:window
  onpointermove={onResizeMove}
  onpointerup={onResizeUp}
/>

<div class="relative w-full h-full">
  <!-- Preview container -->
  <div class="flex h-full w-full items-center justify-center">
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
            class="border-0 block"
            scrolling="no"
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
