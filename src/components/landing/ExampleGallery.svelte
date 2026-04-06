<script lang="ts">
  import { galleryItems } from '../../lib/gallery-data'
  import { generateClassString } from '../../lib/class-generator'

  let activeIndex = $state(0)
  let intervalId: ReturnType<typeof setInterval>
  let transitioning = $state(false)

  const activeItem = $derived(galleryItems[activeIndex])
  const classString = $derived(generateClassString(activeItem.frames))

  $effect(() => {
    intervalId = setInterval(() => {
      transitionTo((activeIndex + 1) % galleryItems.length)
    }, 5000)
    return () => clearInterval(intervalId)
  })

  function transitionTo(index: number) {
    if (index === activeIndex) return
    transitioning = true
    setTimeout(() => {
      activeIndex = index
      transitioning = false
    }, 300)
  }

  function goTo(index: number) {
    transitionTo(index)
    clearInterval(intervalId)
    intervalId = setInterval(() => {
      transitionTo((activeIndex + 1) % galleryItems.length)
    }, 5000)
  }

  const displayBreakpoints = ['base', 'md', 'xl'] as const
  const bpLabels: Record<string, string> = { base: 'Mobile', md: 'Tablet', xl: 'Desktop' }
  const bpWidths: Record<string, number> = { base: 140, md: 280, xl: 420 }
  const bpAspects: Record<string, string> = { base: '9/16', md: '4/3', xl: '16/9' }
</script>

<section
  class="relative overflow-hidden rounded-2xl transition-all duration-700 anim-scale"
  style="animation-delay: 200ms"
  style:background="linear-gradient(160deg, {activeItem.gradient[0]}dd, {activeItem.gradient[1]}bb)"
>
  <div class="grain-overlay absolute inset-0 opacity-15 mix-blend-overlay pointer-events-none"></div>

  <div class="relative z-10 max-w-6xl mx-auto px-6 py-8 lg:py-10">
    <!-- Frames -->
    <div class="flex justify-center items-end gap-3 md:gap-6">
      {#each displayBreakpoints as bpName}
        {@const frame = activeItem.frames.find(f => f.breakpoint === bpName)}
        {#if frame}
          <div class="flex flex-col items-center gap-2">
            <span class="text-[10px] font-mono text-white/35 tracking-wider uppercase">{bpLabels[bpName]}</span>
            <div
              class="border border-white/15 rounded-lg overflow-hidden backdrop-blur-sm bg-black/20 transition-all duration-500 {transitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}"
              style:width="{bpWidths[bpName]}px"
            >
              <div class="overflow-hidden" style:aspect-ratio={bpAspects[bpName]}>
                <img
                  src={activeItem.image}
                  alt={activeItem.label}
                  draggable="false"
                  class="w-full h-full pointer-events-none transition-all duration-700"
                  style:object-fit={frame.objectFit}
                  style:object-position={frame.objectPosition}
                  style:transform="scale({frame.scale}) translate({frame.translateX * 4}px, {frame.translateY * 4}px)"
                  style:transform-origin={frame.transformOrigin}
                />
              </div>
            </div>
          </div>
        {/if}
      {/each}
    </div>

    <!-- Class string -->
    <div class="mt-6 max-w-3xl mx-auto transition-all duration-500 {transitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}">
      <pre class="text-[11px] font-mono text-white/40 bg-black/25 backdrop-blur-sm rounded-lg px-5 py-3.5 overflow-x-auto whitespace-nowrap border border-white/5">{classString}</pre>
    </div>

    <!-- Label + dots -->
    <div class="flex items-center justify-between mt-4">
      <div class="flex gap-2.5">
        {#each galleryItems as item, i}
          <button
            type="button"
            class="w-1.5 h-1.5 rounded-full transition-all duration-300 {i === activeIndex ? 'bg-white/80 scale-150' : 'bg-white/25 hover:bg-white/40'}"
            onclick={() => goTo(i)}
            aria-label="Show {item.label}"
          ></button>
        {/each}
      </div>
      <p class="text-[10px] text-white/25 font-mono tracking-wide transition-all duration-500 {transitioning ? 'opacity-0' : 'opacity-100'}">
        {activeItem.label}
      </p>
    </div>
  </div>
</section>
