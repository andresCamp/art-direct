<script lang="ts">
  import { store } from '../../lib/store.svelte'
  import { BREAKPOINTS, DISPLAY_WIDTHS } from '../../lib/breakpoints'
  import { MediaQuery } from 'svelte/reactivity'
  import Frame from './Frame.svelte'
  import DevicePicker from './DevicePicker.svelte'
  import type { BreakpointName } from '../../lib/types'

  const mobileViewport = new MediaQuery('(max-width: 639px)')
  const compactViewport = new MediaQuery('(max-width: 767px)')

  const frameList = $derived(
    store.viewMode === 'device'
      ? store.activeDevices.map(({ category, device }) => {
          const frame = store.visibleFrames.find(f => f.breakpoint === device.breakpoint)
          const bp = BREAKPOINTS.find(b => b.name === device.breakpoint)
          return { frame, bp, category, device }
        }).filter(f => f.frame && f.bp)
      : store.frames.map((frame, i) => ({
          frame, bp: BREAKPOINTS[i], category: null, device: null
        }))
  )

  const hasSelection = $derived(
    frameList.some(f => f.frame?.breakpoint === store.activeBreakpoint)
  )

  // Click outside to deselect
  function handleWindowClick(e: MouseEvent) {
    if (!hasSelection) return
    const target = e.target as HTMLElement
    if (target.closest('[data-frame-wrapper]') || target.closest('[data-studio-control]')) return
    store.setActiveBreakpoint('' as any)
  }

  $effect(() => {
    if (hasSelection) {
      const timer = setTimeout(() => {
        window.addEventListener('click', handleWindowClick)
      }, 10)
      return () => {
        clearTimeout(timer)
        window.removeEventListener('click', handleWindowClick)
      }
    }
  })

  const FOCUS_BOOST = 1.4
  const SHRINK_FACTOR = 0.85
  const DESKTOP_MIN_COMPRESSION = 0.74
  const MIN_VERTICAL_COMPRESSION = 0.62
  const FRAME_HEADER_HEIGHT = 30
  const DEVICE_PICKER_HEIGHT = 28
  const ITEM_STACK_GAP = 12

  function getBaseWidth(bpName: BreakpointName, deviceWidth?: number): number {
    if (deviceWidth) {
      const base = deviceWidth < 600 ? 220 : deviceWidth < 1100 ? 320 : 480
      return mobileViewport.current ? Math.round(base * 0.55) : base
    }
    const w = DISPLAY_WIDTHS[bpName]
    return mobileViewport.current ? Math.round(w * 0.55) : w
  }

  function getRawAllocatedWidth(bpName: BreakpointName, isActive: boolean, deviceWidth?: number): number {
    const base = getBaseWidth(bpName, deviceWidth)
    if (!hasSelection) return base
    if (isActive) return Math.round(base * FOCUS_BOOST)
    return Math.round(base * SHRINK_FACTOR)
  }

  function getFrameHeightForWidth(width: number, deviceWidth?: number, deviceHeight?: number): number {
    if (deviceWidth && deviceHeight) {
      return Math.round(deviceHeight * (width / deviceWidth))
    }
    return Math.round(width * 9 / 16)
  }

  function getBaseGap(): number {
    return compactViewport.current ? 24 : 32
  }

  let containerWidth = $state(0)
  let containerHeight = $state(0)
  const compactLayout = $derived(compactViewport.current || (containerWidth > 0 && containerWidth < 768))
  const startAligned = $derived(
    store.viewMode === 'tailwind' || (store.viewMode === 'device' && (store.sidebarOpen || compactLayout))
  )
  const stripResetKey = $derived.by(() => {
    const layoutMode = store.viewMode
    const directionId = store.activeDirectionId ?? ''
    const sidebar = store.sidebarOpen ? 'open' : 'closed'
    const stripShape = layoutMode === 'device'
      ? store.activeDevices.map(({ device }) => device.breakpoint).join('|')
      : BREAKPOINTS.map(bp => bp.name).join('|')
    return `${directionId}:${layoutMode}:${sidebar}:${stripShape}`
  })

  const layoutCompression = $derived.by(() => {
    if (compactViewport.current || !containerWidth || frameList.length === 0) return 1
    if (store.viewMode !== 'device') return 1

    const gap = getBaseGap()
    const padding = 64
    let totalWidth = padding + gap * Math.max(frameList.length - 1, 0)

    for (const item of frameList) {
      if (!item.bp) continue
      const isActive = item.frame?.breakpoint === store.activeBreakpoint
      totalWidth += getRawAllocatedWidth(item.bp.name, isActive, item.device?.width)
    }

    const availableWidth = Math.max(containerWidth - 24, 0)
    if (totalWidth <= availableWidth) return 1

    return Math.max(DESKTOP_MIN_COMPRESSION, availableWidth / totalWidth)
  })

  const verticalCompression = $derived.by(() => {
    if (!containerHeight || frameList.length === 0) return 1

    let tallestItemHeight = 0
    for (const item of frameList) {
      if (!item.bp) continue
      const isActive = item.frame?.breakpoint === store.activeBreakpoint
      const frameWidth = getRawAllocatedWidth(item.bp.name, isActive, item.device?.width) * layoutCompression
      const frameHeight = getFrameHeightForWidth(frameWidth, item.device?.width, item.device?.height)
      const pickerHeight = store.viewMode === 'device' && item.category ? DEVICE_PICKER_HEIGHT + ITEM_STACK_GAP : 0
      tallestItemHeight = Math.max(tallestItemHeight, frameHeight + FRAME_HEADER_HEIGHT + pickerHeight)
    }

    const availableHeight = Math.max(containerHeight - 20, 0)
    if (!tallestItemHeight || tallestItemHeight <= availableHeight) return 1

    return Math.max(MIN_VERTICAL_COMPRESSION, availableHeight / tallestItemHeight)
  })

  const frameCompression = $derived(layoutCompression * verticalCompression)
  const stripGap = $derived(Math.max(16, Math.round(getBaseGap() * frameCompression)))
  const stripPadding = $derived(Math.max(20, Math.round(32 * frameCompression)))

  function getAllocatedWidth(bpName: BreakpointName, isActive: boolean, deviceWidth?: number): number {
    return Math.round(getRawAllocatedWidth(bpName, isActive, deviceWidth) * frameCompression)
  }

  // Reset pan when frame list changes (e.g. switching device/tailwind mode)
  $effect(() => {
    stripResetKey
    containerWidth
    containerHeight
    frameCompression
    startAligned
    // On mobile, start left-aligned so the first frame is visible
    if (startAligned && containerEl && stripEl) {
      requestAnimationFrame(() => {
        panX = getMaxPan()
      })
    } else {
      panX = 0
    }
  })

  // --- Horizontal panning (no overflow container) ---
  let panX = $state(0)
  let isPanning = $state(false)
  let panStart = $state({ x: 0, origin: 0 })
  let containerEl: HTMLElement | undefined = $state()
  let stripEl: HTMLElement | undefined = $state()

  function getMaxPan(): number {
    if (!containerEl || !stripEl) return 0
    const overflow = stripEl.scrollWidth - containerEl.clientWidth
    return Math.max(0, overflow / 2)
  }

  // Tracks whether the strip actually overflows the container so the
  // grab cursor only appears when panning would do something.
  let canPan = $state(false)
  $effect(() => {
    stripResetKey
    containerWidth
    containerHeight
    frameCompression
    if (!containerEl || !stripEl) return
    requestAnimationFrame(() => {
      if (containerEl && stripEl) {
        canPan = stripEl.scrollWidth > containerEl.clientWidth
      }
    })
  })

  function clampPan(val: number): number {
    const max = getMaxPan()
    return Math.max(-max, Math.min(max, val))
  }

  // Auto-center focused frame on mobile
  $effect(() => {
    const bp = store.activeBreakpoint
    if (!bp || store.viewMode !== 'device' || !compactLayout || !containerEl) return
    const idx = frameList.findIndex(f => f.frame?.breakpoint === bp)
    if (idx < 0) return
    // Compute the center of the target frame from allocated widths + gaps
    const gap = stripGap
    let offset = 0
    for (let i = 0; i < idx; i++) {
      const item = frameList[i]
      const w = item.bp ? getAllocatedWidth(item.bp.name, false, item.device?.width) : 0
      offset += w + gap
    }
    const activeItem = frameList[idx]
    const activeW = activeItem.bp ? getAllocatedWidth(activeItem.bp.name, true, activeItem.device?.width) : 0
    const frameCenter = offset + activeW / 2
    // Total strip width
    let totalWidth = 0
    for (let i = 0; i < frameList.length; i++) {
      const item = frameList[i]
      const w = item.bp ? getAllocatedWidth(item.bp.name, i === idx, item.device?.width) : 0
      totalWidth += w
    }
    totalWidth += gap * (frameList.length - 1)
    // The strip is centered in the container, so its natural center is at containerCenter
    const containerCenter = containerEl.clientWidth / 2
    const stripStart = containerCenter - totalWidth / 2
    const frameCenterAbsolute = stripStart + frameCenter
    // Pan to put frameCenterAbsolute at containerCenter
    const targetPan = containerCenter - frameCenterAbsolute
    panX = clampPan(targetPan)
  })

  function onBgPointerDown(e: PointerEvent) {
    // Only pan from background, not from frames; disable when a frame is focused
    if (hasSelection) return
    const target = e.target as HTMLElement
    if (target.closest('[data-frame-wrapper]')) return
    isPanning = true
    panStart = { x: e.clientX, origin: panX }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onBgPointerMove(e: PointerEvent) {
    if (!isPanning) return
    const dx = e.clientX - panStart.x
    panX = clampPan(panStart.origin + dx)
  }

  function onBgPointerUp() {
    isPanning = false
  }

  function onBgWheel(e: WheelEvent) {
    if (hasSelection) return
    // Horizontal scroll with mouse wheel (shift+wheel or trackpad horizontal)
    const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    const max = getMaxPan()
    if (max <= 0) return
    e.preventDefault()
    panX = clampPan(panX - dx)
  }
</script>

<div
  bind:this={containerEl}
  bind:clientWidth={containerWidth}
  bind:clientHeight={containerHeight}
  class="relative w-full h-full flex items-center justify-center"
  class:cursor-grab={canPan && !hasSelection && !isPanning}
  class:cursor-grabbing={isPanning}
  onpointerdown={onBgPointerDown}
  onpointermove={onBgPointerMove}
  onpointerup={onBgPointerUp}
  onwheel={onBgWheel}
>
  <div
    bind:this={stripEl}
    class={[
      'flex items-end transition-transform duration-300 ease-out',
      store.viewMode === 'device' && 'justify-center'
    ]}
    style={`transform: translateX(${panX}px); will-change: transform; gap: ${stripGap}px; padding-left: ${stripPadding}px; padding-right: ${stripPadding}px;`}
  >
    {#each frameList as item}
      {@const isActive = item.frame?.breakpoint === store.activeBreakpoint}
      {@const width = item.bp ? getAllocatedWidth(item.bp.name, isActive, item.device?.width) : 0}
      <div
        data-frame-wrapper
        class="flex flex-col items-center gap-3 flex-shrink-0 transition-all duration-300 ease-out"
        style:width="{width}px"
        style:opacity={hasSelection && !isActive ? 0.5 : 1}
      >
        {#if store.viewMode === 'device' && item.category}
          <DevicePicker category={item.category} deviceId={store.selectedDevices[item.category]} />
        {/if}
        {#if item.frame && item.bp}
          <Frame
            frame={item.frame}
            breakpointDef={item.bp}
            isActive={isActive}
            isModified={store.isModified(item.frame.breakpoint)}
            onActivate={() => { if (item.frame) store.setActiveBreakpoint(item.frame.breakpoint) }}
            deviceWidth={item.device?.width}
            deviceHeight={item.device?.height}
            widthOverride={width}
          />
        {/if}
      </div>
    {/each}
  </div>

  <!-- Fade edges to hint at off-screen content (mobile only) -->
  <div
    class="fixed left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-studio-bg to-transparent pointer-events-none z-10 transition-opacity duration-300 md:hidden"
    style:opacity={panX < -10 ? 0.6 : 0}
  ></div>
  <div
    class="fixed right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-studio-bg to-transparent pointer-events-none z-10 transition-opacity duration-300 md:hidden"
    style:opacity={panX > 10 ? 0.6 : 0}
  ></div>
</div>
