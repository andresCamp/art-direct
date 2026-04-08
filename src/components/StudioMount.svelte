<script lang="ts">
  import { store } from '../lib/store.svelte'

  let showStudio = $state(false)
  let transitioning = $state(false)
  let Studio: any = $state(null)
  let initialLoad = true

  $effect(() => {
    if (store.image && !showStudio && !transitioning) {
      // If image is available on first render (gallery pre-loaded), skip the transition
      if (initialLoad) {
        initialLoad = false
        const landing = document.getElementById('landing')
        if (landing) landing.classList.add('hidden')
        ;(async () => {
          const mod = await import('./studio/Studio.svelte')
          Studio = mod.default
          showStudio = true
          window.posthog?.capture('studio_entered', {
            filename: store.image?.filename,
            image_width: store.image?.naturalWidth,
            image_height: store.image?.naturalHeight,
          })
        })()
        return
      }

      // Animated transition for subsequent uploads
      transitioning = true
      const landing = document.getElementById('landing')
      if (landing) {
        landing.classList.remove('opacity-100', 'scale-100')
        landing.classList.add('opacity-0', 'scale-[0.98]')
      }
      setTimeout(async () => {
        if (!Studio) {
          const mod = await import('./studio/Studio.svelte')
          Studio = mod.default
        }
        showStudio = true
        transitioning = false
        const landingEl = document.getElementById('landing')
        if (landingEl) landingEl.classList.add('hidden')
        window.posthog?.capture('studio_entered', {
          filename: store.image?.filename,
          image_width: store.image?.naturalWidth,
          image_height: store.image?.naturalHeight,
        })
      }, 400)
    }
    if (!store.image && showStudio) {
      transitioning = true
      showStudio = false
      const landing = document.getElementById('landing')
      if (landing) {
        landing.classList.remove('hidden')
        // Force reflow before removing transition classes
        landing.offsetHeight
        landing.classList.remove('opacity-0', 'scale-[0.98]')
        landing.classList.add('opacity-100', 'scale-100')
      }
      setTimeout(() => {
        transitioning = false
      }, 300)
    }
  })
</script>

{#if showStudio && Studio}
  <div class="animate-fade-in">
    <Studio />
  </div>
{/if}

<style>
  .animate-fade-in {
    animation: fadeIn 0.5s ease-out;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: scale(0.98); }
    to { opacity: 1; transform: scale(1); }
  }
</style>
