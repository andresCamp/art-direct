<script lang="ts">
  import { store } from '../../lib/store.svelte'
  import { DISPLAY_WIDTHS } from '../../lib/breakpoints'
  import { handleFilesForActiveDirection, handleClipboardPasteForActiveDirection } from '../../lib/upload'
  import type { BreakpointDef, FrameState, ObjectFit } from '../../lib/types'
  import FitToggle from './FitToggle.svelte'

  let fileInput: HTMLInputElement | undefined = $state()

  interface Props {
    frame: FrameState
    breakpointDef: BreakpointDef
    isActive: boolean
    isModified: boolean
    onActivate: () => void
    deviceWidth?: number
    deviceHeight?: number
    widthOverride?: number
  }

  let { frame, breakpointDef, isActive, isModified, onActivate, deviceWidth, deviceHeight, widthOverride }: Props = $props()

  // --- Drag state ---
  // Translate gestures (pointer drag, wheel pan) feel too fast at 1:1; scale them
  // down so the marching-ants border reads as a calmer companion to the cursor.
  // Zoom/scale gestures stay 1:1 — they already produce smaller magnitudes.
  const TRANSLATE_MARCH_SCALE = 0.25
  const SCALE_MARCH_SCALE = 0.35
  const WHEEL_DRAG_IDLE_MS = 1400
  const WHEEL_SCALE_SENSITIVITY = 0.0085
  const WHEEL_SCALE_DELTA_CAP = 0.12
  let isDragging = $state(false)
  let dragStart = $state({ x: 0, y: 0 })
  let dragOrigin = $state({ x: 0, y: 0 })
  let dragOriginPos = $state({ x: 50, y: 50 })
  let lastDragPos = $state({ x: 0, y: 0 })

  // --- Touch pinch-to-zoom state ---
  let isPinching = $state(false)
  let touchOrigin = $state({ dist: 0, scale: 1, tx: 0, ty: 0 })
  let lastTouchDist = 0
  let wheelScaleRaw = $state<number | null>(null)

  // --- Wheel debounce (no native begin/end events, so we synthesize them) ---
  let wheelEndTimer: ReturnType<typeof setTimeout> | undefined
  let wheelActive = false

  function pulseWheelDrag() {
    if (!wheelActive) {
      wheelActive = true
      wheelScaleRaw = null
      store.beginDrag()
    }
    clearTimeout(wheelEndTimer)
    wheelEndTimer = setTimeout(() => {
      wheelActive = false
      wheelScaleRaw = null
      store.updateFrame(frame.breakpoint, { scale: settleScale(frame.scale) })
      store.endDrag()
    }, WHEEL_DRAG_IDLE_MS)
  }

  $effect(() => () => clearTimeout(wheelEndTimer))

  function getTouchInfo(t1: Touch, t2: Touch) {
    return {
      dist: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY),
      midX: (t1.clientX + t2.clientX) / 2,
      midY: (t1.clientY + t2.clientY) / 2,
    }
  }

  function onTouchStart(e: TouchEvent) {
    if (!isActive || e.touches.length < 2) return
    // If a pointer drag was already in flight, end it cleanly before pivoting to pinch.
    if (isDragging && didDrag) store.endDrag()
    isPinching = true
    isDragging = false
    const info = getTouchInfo(e.touches[0], e.touches[1])
    lastTouchDist = info.dist
    store.beginDrag()
    if (isCover) {
      const converted = getContainEquivalentState()
      touchOrigin = { dist: info.dist, scale: converted.scale, tx: converted.translateX, ty: converted.translateY }
      return
    }
    touchOrigin = { dist: info.dist, scale: frame.scale, tx: frame.translateX, ty: frame.translateY }
  }

  function onTouchMove(e: TouchEvent) {
    if (!isPinching || e.touches.length < 2) return
    const info = getTouchInfo(e.touches[0], e.touches[1])
    // Pinch distance delta drives the marching-ants border (expand = CW, contract = CCW).
    store.addDragDelta((info.dist - lastTouchDist) * SCALE_MARCH_SCALE, 0)
    lastTouchDist = info.dist
    if (isCover) {
      const converted = getContainEquivalentState()
      const ratio = info.dist / touchOrigin.dist
      store.updateFrame(frame.breakpoint, {
        ...converted,
        scale: clampScale(converted.scale * ratio),
      })
      return
    }
    const ratio = info.dist / touchOrigin.dist
    const newScale = clampScale(touchOrigin.scale * ratio)
    store.updateFrame(frame.breakpoint, { scale: newScale })
  }

  function onTouchEnd(e: TouchEvent) {
    if (!isPinching) return
    if (e.touches.length < 2) {
      isPinching = false
      if (!isCover) store.updateFrame(frame.breakpoint, { scale: settleScale(frame.scale) })
      store.endDrag()
    }
  }

  // --- Ghost image visibility (hover-based) ---
  let isHovering = $state(false)
  let showOverflow = $state(false)
  let overflowTimer: ReturnType<typeof setTimeout> | undefined

  $effect(() => {
    if (!isActive) {
      clearTimeout(overflowTimer)
      showOverflow = false
      return
    }
    if (isHovering || isDragging || isScaling) {
      clearTimeout(overflowTimer)
      showOverflow = true
    } else {
      overflowTimer = setTimeout(() => { showOverflow = false }, 300)
    }
  })

  const isCover = $derived(frame.objectFit === 'cover')
  const showGhostOverflow = $derived(store.viewMode === 'device' && showOverflow)

  // --- Object position helpers ---
  function parseObjPos(pos: string): { x: number, y: number } {
    const named: Record<string, { x: number, y: number }> = {
      'center': { x: 50, y: 50 },
      'top': { x: 50, y: 0 }, 'bottom': { x: 50, y: 100 },
      'left': { x: 0, y: 50 }, 'right': { x: 100, y: 50 },
      'top left': { x: 0, y: 0 }, 'left top': { x: 0, y: 0 }, 'top-left': { x: 0, y: 0 },
      'top right': { x: 100, y: 0 }, 'right top': { x: 100, y: 0 }, 'top-right': { x: 100, y: 0 },
      'bottom left': { x: 0, y: 100 }, 'left bottom': { x: 0, y: 100 }, 'bottom-left': { x: 0, y: 100 },
      'bottom right': { x: 100, y: 100 }, 'right bottom': { x: 100, y: 100 }, 'bottom-right': { x: 100, y: 100 },
    }
    if (named[pos]) return named[pos]
    const parts = pos.replace(/%/g, '').trim().split(/\s+/)
    return { x: parseFloat(parts[0]) || 50, y: parseFloat(parts[1] ?? parts[0]) || 50 }
  }

  function toObjPos(x: number, y: number): string {
    x = Math.round(x)
    y = Math.round(y)
    if (x === 50 && y === 50) return 'center'
    if (x === 50 && y === 0) return 'top'
    if (x === 50 && y === 100) return 'bottom'
    if (x === 0 && y === 50) return 'left'
    if (x === 100 && y === 50) return 'right'
    if (x === 0 && y === 0) return 'top left'
    if (x === 100 && y === 0) return 'top right'
    if (x === 0 && y === 100) return 'bottom left'
    if (x === 100 && y === 100) return 'bottom right'
    return `${x}% ${y}%`
  }

  function roundScale(value: number) {
    return Math.round(value * 100) / 100
  }

  function settleScale(value: number) {
    return Math.round(value * 10) / 10
  }

  function roundTranslate(value: number) {
    return Math.round(value)
  }

  function clampScaleRaw(value: number) {
    return Math.max(0.1, Math.min(10, value))
  }

  function clampScale(value: number) {
    return roundScale(clampScaleRaw(value))
  }

  function getContainEquivalentState() {
    const W = displayWidth
    const H = frameH
    const imgAspect = store.image
      ? store.image.naturalWidth / store.image.naturalHeight
      : W / H
    const frameAspect = W / H
    const containBase = imgAspect > frameAspect
      ? { w: W, h: W / imgAspect }
      : { w: H * imgAspect, h: H }
    const coverWidth = imgBounds.right - imgBounds.left
    const coverHeight = imgBounds.bottom - imgBounds.top
    const scale = containBase.w > 0 ? coverWidth / containBase.w : 1
    const renderedWidth = containBase.w * scale
    const renderedHeight = containBase.h * scale
    const txPx = imgBounds.left - (W - renderedWidth) / 2
    const tyPx = imgBounds.top - (H - renderedHeight) / 2
    const unitScale = Math.max(scaleRatio * 4, 0.001)

    return {
      objectFit: 'contain' as const,
      objectPosition: 'center',
      transformOrigin: 'center',
      scale: clampScale(scale),
      translateX: roundTranslate(txPx / unitScale),
      translateY: roundTranslate(tyPx / unitScale),
    }
  }

  // --- Scale handles ---
  let isScaling = $state(false)
  let scaleOrigin = $state({ dist: 0, scale: 1, cx: 0, cy: 0 })
  let lastScaleDist = 0
  let frameEl: HTMLElement | undefined = $state()

  function onScaleDown(e: PointerEvent) {
    e.stopPropagation()
    onActivate()
    isScaling = true
    const rect = frameEl!.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dist = Math.hypot(e.clientX - cx, e.clientY - cy)
    scaleOrigin = { dist, scale: frame.scale, cx, cy }
    lastScaleDist = dist
    store.beginDrag()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onScaleMove(e: PointerEvent) {
    if (!isScaling) return
    const dist = Math.hypot(e.clientX - scaleOrigin.cx, e.clientY - scaleOrigin.cy)
    // Radial-distance delta drives the marching-ants border (out = CW, in = CCW).
    store.addDragDelta((dist - lastScaleDist) * SCALE_MARCH_SCALE, 0)
    lastScaleDist = dist
    const ratio = scaleOrigin.dist > 0 ? dist / scaleOrigin.dist : 1
    const newScale = clampScale(scaleOrigin.scale * ratio)
    store.updateFrame(frame.breakpoint, { scale: newScale })
  }

  function onScaleUp() {
    if (!isScaling) return
    isScaling = false
    store.updateFrame(frame.breakpoint, { scale: settleScale(frame.scale) })
    store.endDrag()
  }

  // --- Display dimensions ---
  const maxDisplayWidth = $derived(
    deviceWidth && deviceHeight
      ? (deviceWidth < 600 ? 220 : deviceWidth < 1100 ? 320 : 480)
      : DISPLAY_WIDTHS[frame.breakpoint]
  )

  const displayScale = $derived(
    deviceWidth ? Math.min(maxDisplayWidth / deviceWidth, 1) : 1
  )

  const displayWidth = $derived(
    widthOverride ?? (deviceWidth ? Math.round(deviceWidth * displayScale) : DISPLAY_WIDTHS[frame.breakpoint])
  )

  const displayHeight = $derived(
    widthOverride && deviceWidth && deviceHeight
      ? Math.round(deviceHeight * (widthOverride / deviceWidth))
      : deviceHeight ? Math.round(deviceHeight * displayScale) : undefined
  )

  const scaleRatio = $derived(
    widthOverride && deviceWidth
      ? widthOverride / deviceWidth
      : deviceWidth ? displayScale : (DISPLAY_WIDTHS[frame.breakpoint] / breakpointDef.minWidth || 1)
  )

  const frameH = $derived(displayHeight ?? Math.round(displayWidth * 9 / 16))

  // Full rendered image size at scale=1
  const imgRender = $derived.by(() => {
    const W = displayWidth
    const H = frameH
    if (!store.image) return { w: W, h: H }
    const imgAspect = store.image.naturalWidth / store.image.naturalHeight
    const frameAspect = W / H
    if (frame.objectFit === 'contain') {
      return imgAspect > frameAspect
        ? { w: W, h: W / imgAspect }
        : { w: H * imgAspect, h: H }
    }
    if (frame.objectFit === 'cover') {
      return imgAspect > frameAspect
        ? { w: H * imgAspect, h: H }
        : { w: W, h: W / imgAspect }
    }
    return { w: W, h: H }
  })

  // Visual bounds of the rendered image relative to the composition boundary
  const imgBounds = $derived.by(() => {
    if (isCover) {
      const pos = parseObjPos(frame.objectPosition)
      const left = (displayWidth - imgRender.w) * pos.x / 100
      const top = (frameH - imgRender.h) * pos.y / 100
      return { left, top, right: left + imgRender.w, bottom: top + imgRender.h }
    }
    const s = frame.scale
    const tx = frame.translateX * 4 * scaleRatio
    const ty = frame.translateY * 4 * scaleRatio
    const rw = imgRender.w * s
    const rh = imgRender.h * s
    return {
      left: (displayWidth - rw) / 2 + tx,
      top: (frameH - rh) / 2 + ty,
      right: (displayWidth + rw) / 2 + tx,
      bottom: (frameH + rh) / 2 + ty,
    }
  })

  // --- Pointer handlers ---
  // Click to activate, drag on active frame to manipulate image.
  // stopPropagation so parent horizontal scroll isn't hijacked.
  let didDrag = $state(false)

  function onPointerDown(e: PointerEvent) {
    if (!store.image) {
      e.stopPropagation()
      return
    }
    if (!isActive) {
      onActivate()
      return
    }
    // Active frame — start dragging
    e.stopPropagation()
    isDragging = true
    didDrag = false
    dragStart = { x: e.clientX, y: e.clientY }
    if (isCover) {
      dragOriginPos = parseObjPos(frame.objectPosition)
    } else {
      dragOrigin = { x: frame.translateX, y: frame.translateY }
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: PointerEvent) {
    if (!isDragging || isPinching) return
    if (!didDrag) {
      const dx = Math.abs(e.clientX - dragStart.x)
      const dy = Math.abs(e.clientY - dragStart.y)
      if (dx + dy > 3) {
        didDrag = true
        // Reset baseline so the marching-ants border starts smooth on its first frame.
        lastDragPos = { x: e.clientX, y: e.clientY }
        store.beginDrag()
      } else return
    }

    // Push raw screen-space delta to the global drag tracker (drives the
    // OutputPanel marching-ants border — speed = cursor velocity, sign = dominant axis).
    const rawDx = e.clientX - lastDragPos.x
    const rawDy = e.clientY - lastDragPos.y
    if (rawDx || rawDy) store.addDragDelta(rawDx * TRANSLATE_MARCH_SCALE, rawDy * TRANSLATE_MARCH_SCALE)
    lastDragPos = { x: e.clientX, y: e.clientY }

    if (isCover) {
      const dx = e.clientX - dragStart.x
      const dy = e.clientY - dragStart.y
      const overflowX = imgRender.w - displayWidth
      const overflowY = imgRender.h - frameH
      const newX = overflowX > 0 ? Math.max(0, Math.min(100, dragOriginPos.x - dx / overflowX * 100)) : 50
      const newY = overflowY > 0 ? Math.max(0, Math.min(100, dragOriginPos.y - dy / overflowY * 100)) : 50
      store.updateFrame(frame.breakpoint, { objectPosition: toObjPos(newX, newY) })
    } else {
      const dx = (e.clientX - dragStart.x) / scaleRatio
      const dy = (e.clientY - dragStart.y) / scaleRatio
      const unitX = roundTranslate((dragOrigin.x * 4 + dx) / 4)
      const unitY = roundTranslate((dragOrigin.y * 4 + dy) / 4)
      store.updateFrame(frame.breakpoint, { translateX: unitX, translateY: unitY })
    }
  }

  function onPointerUp() {
    if (!isDragging) return
    isDragging = false
    if (!didDrag) {
      // Click without drag on active frame — deselect
      store.setActiveBreakpoint('' as any)
      return
    }
    store.endDrag()
    if (!isCover) {
      store.updateFrame(frame.breakpoint, {
        translateX: Math.round(frame.translateX),
        translateY: Math.round(frame.translateY),
      })
    }
  }

  function onWheel(e: WheelEvent) {
    if (!isActive) return
    e.preventDefault()

    // Marching-ants tracker — wheel has no native begin/end, so debounce them.
    // Pan: photo-direction = negated wheel delta. Zoom: in = positive (CW), out = negative.
    pulseWheelDrag()
    if (e.ctrlKey || e.metaKey) {
      store.addDragDelta(-e.deltaY * SCALE_MARCH_SCALE, 0)
    } else {
      store.addDragDelta(-e.deltaX * TRANSLATE_MARCH_SCALE, -e.deltaY * TRANSLATE_MARCH_SCALE)
    }

    if (isCover) {
      const converted = getContainEquivalentState()
      if (e.ctrlKey || e.metaKey) {
        const baseScale = wheelScaleRaw ?? converted.scale
        const delta = Math.max(-WHEEL_SCALE_DELTA_CAP, Math.min(WHEEL_SCALE_DELTA_CAP, -e.deltaY * WHEEL_SCALE_SENSITIVITY))
        const nextScaleRaw = clampScaleRaw(baseScale + delta)
        wheelScaleRaw = nextScaleRaw
        store.updateFrame(frame.breakpoint, {
          ...converted,
          scale: roundScale(nextScaleRaw),
        })
        return
      }

      const dx = -e.deltaX / scaleRatio / 4
      const dy = -e.deltaY / scaleRatio / 4
      store.updateFrame(frame.breakpoint, {
        ...converted,
        translateX: roundTranslate(converted.translateX + dx),
        translateY: roundTranslate(converted.translateY + dy),
      })
      return
    }

    if (e.ctrlKey || e.metaKey) {
      // Pinch-to-zoom
      const baseScale = wheelScaleRaw ?? frame.scale
      const delta = Math.max(-WHEEL_SCALE_DELTA_CAP, Math.min(WHEEL_SCALE_DELTA_CAP, -e.deltaY * WHEEL_SCALE_SENSITIVITY))
      const nextScaleRaw = clampScaleRaw(baseScale + delta)
      wheelScaleRaw = nextScaleRaw
      store.updateFrame(frame.breakpoint, { scale: roundScale(nextScaleRaw) })
    } else {
      // Two-finger pan
      {
        const dx = -e.deltaX / scaleRatio / 4
        const dy = -e.deltaY / scaleRatio / 4
        const unitX = roundTranslate(frame.translateX + dx)
        const unitY = roundTranslate(frame.translateY + dy)
        store.updateFrame(frame.breakpoint, { translateX: unitX, translateY: unitY })
      }
    }
  }

  function onFitChange(fit: ObjectFit) {
    if (fit === 'cover') {
      store.updateFrame(frame.breakpoint, { objectFit: fit, scale: 1, translateX: 0, translateY: 0 })
    } else {
      store.updateFrame(frame.breakpoint, { objectFit: fit, objectPosition: 'center' })
    }
  }

  function resetFrame(e: MouseEvent) {
    e.stopPropagation()
    store.resetFrame(frame.breakpoint)
  }
</script>

<svelte:window onpointermove={onScaleMove} onpointerup={onScaleUp} />

<div
  class="flex-shrink-0 relative select-none transition-all duration-300 ease-out
    {isActive ? 'z-10' : ''}"
  style:width="{displayWidth}px"
  style:touch-action={isActive ? 'none' : undefined}
  class:cursor-pointer={!isActive && !!store.image}
  class:cursor-grab={isActive && !isDragging && !isScaling}
  class:cursor-grabbing={isDragging}
  role="application"
  aria-label="Art direction frame for {breakpointDef.label}"
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onwheel={onWheel}
  onmouseenter={() => { isHovering = true }}
  onmouseleave={() => { isHovering = false }}
  ontouchstart={onTouchStart}
  ontouchmove={onTouchMove}
  ontouchend={onTouchEnd}
>
  <!-- Header -->
  <div class="flex items-center justify-between mb-1.5 px-0.5 relative z-30">
    <span class="text-[10px] font-mono tracking-wider uppercase
      {isActive ? 'text-art-300' : isModified ? 'text-studio-text/70' : 'text-studio-text/50'}">
      {breakpointDef.label}
      {#if breakpointDef.minWidth > 0}
        <span class="{isActive ? 'text-art-300/60' : 'text-studio-muted/40'} ml-1">{breakpointDef.minWidth}</span>
      {/if}
    </span>
    <div class="flex items-center gap-1.5">
      {#if isModified}
        <button
          type="button"
          class="cursor-pointer text-[9px] font-mono {isActive ? 'text-art-300/50' : 'text-studio-muted/30'} hover:text-red-400/70 transition-colors"
          onclick={resetFrame}
          onpointerdown={(e) => e.stopPropagation()}
          title="Reset frame"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      {/if}
      <FitToggle value={frame.objectFit} onChange={onFitChange} {isActive} />
    </div>
  </div>

  <!-- Image area -->
  <div class="relative">
    {#if !store.image}
      <!-- Empty state — drop target -->
      <div
        bind:this={frameEl}
        class="rounded-lg border-2 border-dashed border-studio-border/40 transition-all duration-300 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-art-400/40 hover:bg-art-400/5"
        style:height={displayHeight ? `${displayHeight}px` : undefined}
        style:aspect-ratio={displayHeight ? undefined : '16/9'}
        role="button"
        tabindex="0"
        onclick={() => fileInput?.click()}
        ondragover={(e) => e.preventDefault()}
        ondrop={(e) => { e.preventDefault(); e.stopPropagation(); handleFilesForActiveDirection(e.dataTransfer?.files ?? null) }}
        onkeydown={(e) => { if (e.key === 'Enter') fileInput?.click() }}
      >
        <svg class="w-6 h-6 text-studio-muted/40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <span class="text-[10px] text-studio-muted/50 text-center px-2">Drop or browse</span>
        <button
          type="button"
          class="cursor-pointer text-[10px] text-art-400/60 hover:text-art-400 transition-colors"
          onclick={(e) => { e.stopPropagation(); handleClipboardPasteForActiveDirection() }}
        >Paste</button>
        <input
          bind:this={fileInput}
          type="file"
          accept="image/*"
          class="hidden"
          onchange={(e) => handleFilesForActiveDirection(e.currentTarget.files)}
        />
      </div>
    {:else}
    <!-- The composition boundary -->
    <div
      bind:this={frameEl}
      class="rounded-lg border transition-all duration-300
        {isActive
          ? 'border-art-400/50 shadow-[0_0_30px_rgba(37,99,235,0.2)]'
          : isModified
            ? 'border-studio-border/50'
            : 'border-studio-border/20'}"
      style:height={displayHeight ? `${displayHeight}px` : undefined}
      style:aspect-ratio={displayHeight ? undefined : '16/9'}
    >
      <!-- Ghost image — overflow visible, shown on hover -->
      <div
        class="absolute inset-0 overflow-visible transition-opacity duration-500"
        style:opacity={showGhostOverflow ? 0.3 : 0}
        style:pointer-events="none"
      >
        {#if store.image}
          {#if isCover}
            <img
              src={store.image.blobUrl}
              alt=""
              draggable="false"
              class="absolute"
              style:width="{imgRender.w}px"
              style:height="{imgRender.h}px"
              style:left="{imgBounds.left}px"
              style:top="{imgBounds.top}px"
            />
          {:else}
            <img
              src={store.image.blobUrl}
              alt=""
              draggable="false"
              class="absolute"
              style:width="{imgRender.w}px"
              style:height="{imgRender.h}px"
              style:left="50%"
              style:top="50%"
              style:margin-left="-{imgRender.w / 2}px"
              style:margin-top="-{imgRender.h / 2}px"
              style:scale={frame.scale}
              style:translate="{frame.translateX * 4 * scaleRatio}px {frame.translateY * 4 * scaleRatio}px"
              style:transform-origin="center"
            />
          {/if}
        {/if}
      </div>

      <!-- Inner content (clipped to boundary) -->
      <div class="absolute inset-0 rounded-lg overflow-hidden">
        {#if store.image}
          <img
            src={store.image.blobUrl}
            alt=""
            draggable="false"
            class="w-full h-full pointer-events-none"
            style:object-fit={frame.objectFit}
            style:object-position={frame.objectPosition}
            style:scale={isCover ? undefined : frame.scale}
            style:translate={isCover ? undefined : `${frame.translateX * 4 * scaleRatio}px ${frame.translateY * 4 * scaleRatio}px`}
            style:transform-origin={isCover ? undefined : frame.transformOrigin}
          />
        {/if}
      </div>
    </div>

    <!-- Corner scale handles (contain/fill only) -->
    {#if isActive && !isCover}
      {#each [
        { x: imgBounds.left, y: imgBounds.top, cursor: 'nwse-resize' },
        { x: imgBounds.right, y: imgBounds.top, cursor: 'nesw-resize' },
        { x: imgBounds.left, y: imgBounds.bottom, cursor: 'nesw-resize' },
        { x: imgBounds.right, y: imgBounds.bottom, cursor: 'nwse-resize' },
      ] as handle}
        <div
          class="absolute z-20 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center transition-opacity duration-500"
          style:left="{handle.x}px"
          style:top="{handle.y}px"
          style:width="24px"
          style:height="24px"
          style:cursor={handle.cursor}
          style:opacity={showOverflow ? 1 : 0}
          style:pointer-events={showOverflow ? 'auto' : 'none'}
          onpointerdown={onScaleDown}
        >
          <div class="w-3 h-3 rounded-full bg-white border-2 border-art-400"></div>
        </div>
      {/each}
    {/if}

    <!-- Indicator -->
    <div class="absolute bottom-2 right-2 z-10">
      {#if isCover}
        <span class="text-[10px] font-mono {isActive ? 'text-art-300/70' : isModified ? 'text-art-300/50' : 'text-studio-muted/20'}">{frame.objectPosition}</span>
      {:else}
        <span class="text-[10px] font-mono {isActive ? 'text-art-300/70' : isModified ? 'text-art-300/50' : 'text-studio-muted/20'}">{frame.scale.toFixed(1)}x</span>
      {/if}
    </div>
    {/if}
  </div>
</div>
