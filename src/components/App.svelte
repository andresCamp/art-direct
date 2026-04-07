<script lang="ts">
  import { store } from '../lib/store.svelte'
  import { handleFiles } from '../lib/upload'
  import Hero from './landing/Hero.svelte'
  import UploadBox from './landing/UploadBox.svelte'
  import ExampleGallery from './landing/ExampleGallery.svelte'
  import Studio from './studio/Studio.svelte'

  let showStudio = $state(false)
  let transitioning = $state(false)
  let pageDragging = $state(false)
  let dragCounter = $state(0)

  $effect(() => {
    if (store.image && !showStudio) {
      transitioning = true
      setTimeout(() => {
        showStudio = true
        transitioning = false
        window.posthog?.capture('studio_entered', {
          filename: store.image?.filename,
          image_width: store.image?.naturalWidth,
          image_height: store.image?.naturalHeight,
        })
      }, 400)
    }
    if (!store.image && showStudio) {
      transitioning = true
      setTimeout(() => {
        showStudio = false
        transitioning = false
      }, 300)
    }
  })

  function onPageDrop(e: DragEvent) {
    e.preventDefault()
    dragCounter = 0
    pageDragging = false
    handleFiles(e.dataTransfer?.files ?? null)
  }

  function onPageDragOver(e: DragEvent) {
    e.preventDefault()
  }

  function onPageDragEnter() {
    dragCounter++
    pageDragging = true
  }

  function onPageDragLeave() {
    dragCounter--
    if (dragCounter <= 0) {
      dragCounter = 0
      pageDragging = false
    }
  }
</script>

<div
  class="relative"
  ondrop={showStudio ? undefined : onPageDrop}
  ondragover={showStudio ? undefined : onPageDragOver}
  ondragenter={showStudio ? undefined : onPageDragEnter}
  ondragleave={showStudio ? undefined : onPageDragLeave}
>
  {#if pageDragging}
    <div class="drag-overlay fixed inset-0 z-50 pointer-events-none border-2 border-dashed border-art-500/20 rounded-xl m-3"></div>
  {/if}

  {#if showStudio}
    <div class="animate-fade-in">
      <Studio />
    </div>
  {:else}
    <div class={transitioning ? 'opacity-0 scale-98 transition-all duration-400' : 'opacity-100 scale-100 transition-all duration-400'}>
      <main class="h-[100dvh] flex flex-col max-w-7xl mx-auto w-full px-10 lg:px-16 xl:px-20">
        <!-- Top: Hero copy + Upload CTA, vertically centered in their space -->
        <div class="flex flex-col md:flex-row md:items-center gap-6 md:gap-8 lg:gap-10 pt-[8vh] md:pt-[12vh] pb-[4vh] md:pb-[6vh]">
          <Hero />
          <UploadBox {pageDragging} />
        </div>

        <!-- Bottom: Example gallery card, auto-sized -->
        <div class="pb-6">
          <ExampleGallery />
        </div>
      </main>
    </div>
  {/if}
</div>

<style>
  .animate-fade-in {
    animation: fadeIn 0.5s ease-out;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: scale(0.98); }
    to { opacity: 1; transform: scale(1); }
  }
</style>
