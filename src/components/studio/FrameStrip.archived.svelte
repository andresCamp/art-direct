<script lang="ts">
  import { store } from '../../lib/store.svelte'
  import { BREAKPOINTS } from '../../lib/breakpoints'
  import Frame from './Frame.svelte'
  import DevicePicker from './DevicePicker.svelte'

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

  const activeIdx = $derived(
    frameList.findIndex(f => f.frame?.breakpoint === store.activeBreakpoint)
  )

  const hasSelection = $derived(activeIdx >= 0)

  // Crossfade between row and focus
  let focusVisible = $state(false)
  let rowVisible = $state(true)

  $effect(() => {
    if (hasSelection) {
      rowVisible = false
      setTimeout(() => { focusVisible = true }, 200)
    } else {
      focusVisible = false
      setTimeout(() => { rowVisible = true }, 200)
    }
  })

  const STACK_GAP = 60

  // Click outside to deselect
  function handleWindowClick(e: MouseEvent) {
    if (!hasSelection) return
    const target = e.target as HTMLElement
    if (target.closest('[data-frame-wrapper]')) return
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

  function getFocusStyle(i: number): string {
    const offset = i - activeIdx
    const isActive = offset === 0
    const isLeft = offset < 0
    const n = frameList.length

    if (isActive) {
      return 'left:50%; top:50%; transform:translate(-50%,-50%) rotateY(0deg) scale(1); z-index:50;'
    }
    if (isLeft) {
      return `left:${20 + i * STACK_GAP}px; top:50%; transform:translateY(-50%) rotateY(55deg) scale(0.5); transform-origin:left center; z-index:${i + 1};`
    }
    const rightIdx = i - activeIdx - 1
    const rightCount = n - activeIdx - 1
    return `right:${20 + (rightCount - 1 - rightIdx) * STACK_GAP}px; top:50%; transform:translateY(-50%) rotateY(-55deg) scale(0.5); transform-origin:right center; z-index:${rightCount - rightIdx};`
  }
</script>

<div class="w-full h-full relative" style:perspective="1000px">
  <!-- Focus mode — always in DOM, opacity crossfade -->
  <div
    class="absolute inset-0 transition-opacity duration-200"
    style:opacity={focusVisible ? 1 : 0}
    style:pointer-events={focusVisible ? 'auto' : 'none'}
    style:visibility={focusVisible ? 'visible' : 'hidden'}
  >
    {#each frameList as item, i}
      {#if item.frame && item.bp}
        <div
          data-frame-wrapper
          class="absolute transition-all duration-500 ease-out {i !== activeIdx ? 'cursor-pointer' : ''}"
          style={getFocusStyle(i)}
        >
          <div class="flex flex-col items-center gap-3">
            {#if store.viewMode === 'device' && item.category && i === activeIdx}
              <DevicePicker category={item.category} deviceId={store.selectedDevices[item.category]} />
            {/if}
            <Frame
              frame={item.frame}
              breakpointDef={item.bp}
              isActive={i === activeIdx}
              isModified={store.isModified(item.frame.breakpoint)}
              onActivate={() => { if (item.frame) store.setActiveBreakpoint(item.frame.breakpoint) }}
              deviceWidth={item.device?.width}
              deviceHeight={item.device?.height}
            />
          </div>
        </div>
      {/if}
    {/each}
  </div>

  <!-- Row mode — always in DOM, opacity crossfade -->
  <div
    class={[
      'absolute inset-0 flex items-end gap-6 md:gap-8 overflow-x-auto studio-scroll px-8 py-4 transition-opacity duration-200',
      store.viewMode === 'device' && 'justify-center'
    ]}
    style:opacity={rowVisible ? 1 : 0}
    style:pointer-events={rowVisible ? 'auto' : 'none'}
    style:visibility={rowVisible ? 'visible' : 'hidden'}
  >
    {#each frameList as item}
      <div data-frame-wrapper class="flex flex-col items-center gap-3">
        {#if store.viewMode === 'device' && item.category}
          <DevicePicker category={item.category} deviceId={store.selectedDevices[item.category]} />
        {/if}
        {#if item.frame && item.bp}
          <Frame
            frame={item.frame}
            breakpointDef={item.bp}
            isActive={false}
            isModified={store.isModified(item.frame.breakpoint)}
            onActivate={() => { if (item.frame) store.setActiveBreakpoint(item.frame.breakpoint) }}
            deviceWidth={item.device?.width}
            deviceHeight={item.device?.height}
            rowMode={true}
          />
        {/if}
      </div>
    {/each}
  </div>
</div>
