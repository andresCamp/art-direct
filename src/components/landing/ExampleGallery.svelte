<script lang="ts">
  import { galleryItems } from '../../lib/gallery-data'
  import { generateClassString } from '../../lib/class-generator'
  import { cubicOut } from 'svelte/easing'
  import { MediaQuery } from 'svelte/reactivity'

  const smallScreen = new MediaQuery('(max-width: 639px)')

  let activeIndex = $state(0)
  let intervalId: ReturnType<typeof setInterval>
  let directedTimerId: ReturnType<typeof setTimeout>
  let showDirected = $state(false)

  const activeItem = $derived(galleryItems[activeIndex])
  const classString = $derived(generateClassString(activeItem.frames))

  function startCycle() {
    // Start "without" → morph to "with" after 1.5s
    showDirected = false
    clearTimeout(directedTimerId)
    directedTimerId = setTimeout(() => { showDirected = true }, 2500)
  }

  $effect(() => {
    startCycle()
    intervalId = setInterval(() => {
      transitionTo((activeIndex + 1) % galleryItems.length)
    }, 8000)
    return () => {
      clearInterval(intervalId)
      clearTimeout(directedTimerId)
    }
  })

  function enableTransitions() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { mounted = true })
    })
  }

  function transitionTo(index: number) {
    if (index === activeIndex) return
    mounted = false
    activeIndex = index
    startCycle()
    enableTransitions()
  }

  function goTo(index: number) {
    window.posthog?.capture('gallery_example_navigated', {
      from_label: galleryItems[activeIndex]?.label,
      to_label: galleryItems[index]?.label,
      to_index: index,
    })
    transitionTo(index)
    clearInterval(intervalId)
    intervalId = setInterval(() => {
      transitionTo((activeIndex + 1) % galleryItems.length)
    }, 8000)
  }

  let mounted = $state(false)
  $effect(() => { enableTransitions() })

  function recede(_node: Element) {
    return {
      duration: 350, easing: cubicOut,
      css: (t: number) => `opacity: ${t}; transform: scale(${0.98 + 0.02 * t}); filter: blur(${(1 - t) * 1.5}px)`,
    }
  }

  function emerge(_node: Element) {
    return {
      duration: 400, delay: 250, easing: cubicOut,
      css: (t: number) => `opacity: ${t}; transform: scale(${0.98 + 0.02 * t})`,
    }
  }

  const displayBreakpoints = ['base', 'lg', 'xl'] as const
  const bpLabels: Record<string, string> = { base: 'Mobile', lg: 'Tablet', xl: 'Desktop' }
  const bpWidths = $derived(
    smallScreen.current
      ? { base: 140, lg: 220, xl: 280 }
      : { base: 140, lg: 280, xl: 420 }
  )
  const bpAspects: Record<string, string> = { base: '9/16', lg: '4/3', xl: '16/9' }
  // Typical viewport widths each breakpoint targets — used to scale translate values
  const bpViewports: Record<string, number> = { base: 393, lg: 1024, xl: 1280 }

  function scaleRatio(bpName: string): number {
    return bpWidths[bpName] / bpViewports[bpName]
  }
</script>

<section
  class="relative overflow-hidden rounded-2xl transition-all duration-700 anim-scale"
  style="animation-delay: 200ms"
  style:background="linear-gradient(160deg, {activeItem.gradient[0]}dd, {activeItem.gradient[1]}bb)"
>
  <div class="grain-overlay absolute inset-0 opacity-15 mix-blend-overlay pointer-events-none"></div>

  <div class="relative z-10 max-w-6xl mx-auto px-3 sm:px-6 py-6 lg:py-8">
    <div class="relative" style:min-height={smallScreen.current ? undefined : '390px'}>
    {#key activeIndex}
      <div
        class="{smallScreen.current ? '' : 'absolute inset-x-0 top-0'} will-change-[opacity,transform,filter]"
        in:emerge
        out:recede
      >
        <!-- Before/after label + progress -->
        <div class="flex flex-col items-center gap-2 mb-4">
          <span class="relative text-xs font-mono tracking-widest uppercase">
            <span class="transition-opacity duration-700 text-white/40 {showDirected ? 'opacity-0' : 'opacity-100'}">without art direct</span>
            <span class="absolute inset-0 transition-opacity duration-700 text-white/70 {showDirected ? 'opacity-100' : 'opacity-0'}">with art direct</span>
          </span>
          <div class="w-16 h-px bg-white/10 rounded-full overflow-hidden">
            <div class="h-full bg-white/40 rounded-full gallery-progress"></div>
          </div>
        </div>

        <!-- Frames -->
        <div class="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:items-end md:gap-6">
          {#each displayBreakpoints as bpName}
            {@const frame = activeItem.frames.find(f => f.breakpoint === bpName)}
            {#if frame}
              {@const sr = scaleRatio(bpName)}
              <div class="flex flex-col items-center gap-2">
                <span class="text-[10px] font-mono text-white/35 tracking-wider uppercase">{bpLabels[bpName]}</span>
                <div
                  class="relative border border-white/15 rounded-lg overflow-hidden backdrop-blur-sm bg-black/20"
                  style:width="{smallScreen.current ? '100%' : bpWidths[bpName] + 'px'}"
                  style:max-width="{bpWidths[bpName]}px"
                >
                  <div class="overflow-hidden" style:aspect-ratio={bpAspects[bpName]}>
                    <img
                      src={activeItem.image}
                      alt={activeItem.label}
                      draggable="false"
                      fetchpriority={bpName === 'base' ? 'high' : undefined}
                      class="w-full h-full pointer-events-none ease-out {mounted ? 'transition-all duration-2000' : ''}"
                      style:object-fit={frame.objectFit}
                      style:object-position={showDirected ? frame.objectPosition : 'center'}
                      style:scale={showDirected ? frame.scale : 1}
                      style:translate={showDirected ? `${frame.translateX * 4 * sr}px ${frame.translateY * 4 * sr}px` : '0px 0px'}
                      style:transform-origin={frame.transformOrigin}
                    />
                  </div>
                  {#if bpName === 'xl'}
                    <p class="absolute bottom-2 left-3 right-3 text-[9px] font-mono text-white/30 truncate">{activeItem.label}</p>
                  {/if}
                </div>
              </div>
            {/if}
          {/each}
        </div>

        <!-- Class string -->
        <div class="mt-6 max-w-3xl mx-auto">
          <pre class="text-[11px] font-mono text-white/40 bg-black/25 backdrop-blur-sm rounded-lg px-5 py-3.5 whitespace-pre-wrap break-all border border-white/5 line-clamp-2">{classString}</pre>
        </div>
      </div>
    {/key}
    </div>

  </div>
</section>

<style>
  .gallery-progress {
    transform-origin: left;
    animation: progress-fill 8s linear forwards;
    width: 100%;
    will-change: transform;
  }

  @keyframes progress-fill {
    from { transform: scaleX(0); }
    to { transform: scaleX(1); }
  }
</style>
